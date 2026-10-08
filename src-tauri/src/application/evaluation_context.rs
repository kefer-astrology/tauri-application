//! A request-scoped, bounded cache of body position/motion evaluations,
//! shared by `event_search`'s root-finders and `configuration_search`'s
//! edge search within one `compute_transit_events` call.
//!
//! Two distinct problems this closes, both confirmed by direct tracing
//! (not assumed) before this module existed:
//!
//! 1. Every probe rebuilt the whole position-provider stack from scratch —
//!    `compute_positions` called `backend_for_chart(chart)` fresh every
//!    call, which re-resolved the ephemeris catalog (directory scans,
//!    manifest file reads, per-path metadata stats) on *every single probe*,
//!    not once per request. `EvaluationContext` builds the backend exactly
//!    once, at construction, and reuses it for every evaluation its own
//!    lifetime spans.
//! 2. There was no (body, epoch) level cache, only the per-edge memoization
//!    `configuration_search::EdgeSearchKey` already provides. A body shared
//!    by several edges (e.g. one body appearing in several Grand-Trine
//!    candidate trios) had its position recomputed once per edge even when
//!    two edges' independent `discover_roots` coarse scans shared the exact
//!    same `[start, end]`/`discovery_step` grid and therefore the exact same
//!    epochs. This module adds that cache.
//!
//! Deliberately **not** a persistent, cross-request cache: one
//! `EvaluationContext` is constructed per `compute_transit_events`/
//! `search_configuration` call and dropped with it. See its own doc comment
//! for why the cache key does not need to include chart settings.

use std::cell::RefCell;
use std::collections::{HashMap, VecDeque};

use chrono::{DateTime, Utc};

use crate::domain::astrology::resolve_body_selection;
use crate::infrastructure::position_provider::{
    backend_for_chart, AstronomyBackend, AstronomyMotion, RequiredQuantities,
};
use crate::workspace::models::{AstroModel, ChartInstance};

/// Bounded, not persistent: this cache lives only as long as the
/// `EvaluationContext` that owns it (one request), and a fresh request
/// starts with a fresh, empty cache regardless of this bound.
///
/// Sized from a real measurement, not a guess — and the measurement itself
/// needs unpacking, since a naive read of the numbers below is misleading:
///
/// An initial, much smaller choice here (matching
/// `EventSearchLimits::default().max_probes`'s own order of magnitude) was
/// tested against the 5-body/3-year Grand Trine configuration-search
/// benchmark (`configuration_search_benchmark`) and measured a **0.1% hit
/// rate**: `cache_stats()` reported `hits=666, misses=704_900,
/// entries=20_000` (pinned at the old cap). That 704,900 is **not** the
/// number of distinct (body, epoch) pairs the search needed — re-running
/// with this module's current, much larger cap (so eviction never
/// triggers) measured `entries=91_661` for the *identical* search, with
/// `misses` exactly equal to `entries` (zero `upgrades`, meaning every
/// distinct pair was computed exactly once). The true, ground-truth working
/// set is therefore 91,661, not ~700,000 — a number that is itself an
/// invariant of the search algorithm (which edges/epochs it probes),
/// independent of cache size. The old 20,000-entry cap was so far under
/// that true working set that most of the 704,900 "misses" were the *same*
/// handful of popular entries (bodies shared across several edges) being
/// evicted and recomputed repeatedly — on average, each of the 91,661
/// distinct pairs was recomputed roughly 704,900/91,661 ≈ 7.7 times before
/// this cache's bound was corrected.
///
/// This value (2,000,000) is set with a wide margin above that measured
/// 91,661-entry true working set — over 20x — not tightly matched to it,
/// since a different request shape (more candidate bodies, more edges with
/// less mutual sharing) could plausibly need more.
/// `DEFAULT_TOTAL_EVENT_SEARCH_PROBES` in `application::transit` (the
/// production-wide total probe ceiling shared across one whole
/// `compute_transit_events` call) is 300,000, and this benchmark's own
/// `generous_limits()` test helper (200,000, deliberately larger than that
/// production default, specifically to force every search to reach
/// `complete: true` for the benchmark) only produced 91,661 unique entries
/// in practice — so 2,000,000 is a deliberately generous, not tightly
/// reverse-engineered, ceiling. It remains a genuine, finite bound (not
/// unbounded) for a truly pathological request: at the *measured*
/// `APPROX_BYTES_PER_ENTRY` (see below), 2,000,000 entries is roughly
/// 450-480 MB in the worst case the cap allows — a real cost, not nothing,
/// but a bounded and rarely-approached one (this benchmark's own real peak
/// was 91,661 entries, about 21 MB).
const MAX_CACHE_ENTRIES: usize = 2_000_000;

/// Measured, not a guess: `measures_real_per_entry_memory_cost` (this
/// module's own test, Linux `/proc/self/status` VmRSS delta over 500,000
/// synthetic entries, half holding `Some(motion)`) repeatably measured
/// ~234-236 bytes/entry — notably more than a naive hand-count of the
/// `CachedEval`/`CacheKey` struct sizes alone (~40-50 bytes) would suggest,
/// because that hand count misses `PositionCache`'s own duplicate key
/// storage in `order` (a second owned `String` per entry, for FIFO
/// eviction) and the hash table's own capacity/control-byte overhead.
/// Rounded up from the measurement for a small safety margin, not an
/// independent estimate. Test-only: feeds [`CacheStats::approx_bytes`].
#[cfg(test)]
const APPROX_BYTES_PER_ENTRY: usize = 240;

type CacheKey = (String, i64, u32);

fn cache_key(body_id: &str, at: DateTime<Utc>) -> CacheKey {
    (
        body_id.to_string(),
        at.timestamp(),
        at.timestamp_subsec_nanos(),
    )
}

fn sampled_chart_at(chart: &ChartInstance, at: DateTime<Utc>) -> ChartInstance {
    let mut sample = chart.clone();
    sample.subject.event_time = Some(at);
    sample
}

#[derive(Debug, Clone)]
struct CachedEval {
    longitude: f64,
    motion: Option<AstronomyMotion>,
}

impl CachedEval {
    fn satisfies(&self, tier: RequiredQuantities) -> bool {
        match tier {
            RequiredQuantities::LongitudeOnly => true,
            RequiredQuantities::LongitudeAndMotion => self.motion.is_some(),
        }
    }
}

/// Cache hit/miss/upgrade counters and a bounded-cache size estimate —
/// exposed for benchmarking and diagnostics, not part of any Tauri command's
/// wire response. Test-only (`#[cfg(test)]`): nothing in production reads
/// cache performance, so neither the counters nor this summary of them
/// carry any runtime cost in a release build.
#[cfg(test)]
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    /// A cache hit whose stored tier was insufficient (e.g. cached at
    /// `LongitudeOnly`, now needed at `LongitudeAndMotion`) and had to be
    /// recomputed at the richer tier — tracked separately from a cold
    /// `misses` so a benchmark can distinguish "never seen before" from
    /// "seen before, but needed more."
    pub upgrades: u64,
    pub entries: usize,
    pub approx_bytes: usize,
}

struct PositionCache {
    entries: HashMap<CacheKey, CachedEval>,
    /// Bounded FIFO eviction order. Deliberately simple (not a true LRU):
    /// the dominant access pattern is a forward march through coarse-grid
    /// epochs shared across edges, where recency and insertion order mostly
    /// coincide, so the extra bookkeeping a real LRU needs is not justified
    /// here. An entry is pushed once, on its first-ever insertion; a later
    /// tier upgrade overwrites the value in place without re-pushing (so it
    /// is not "renewed" against eviction — a deliberate simplification).
    order: VecDeque<CacheKey>,
    /// Not always `MAX_CACHE_ENTRIES`: a smaller value lets tests exercise
    /// eviction deterministically and cheaply rather than needing to insert
    /// millions of entries to observe it.
    capacity: usize,
    #[cfg(test)]
    hits: u64,
    #[cfg(test)]
    misses: u64,
    #[cfg(test)]
    upgrades: u64,
}

impl PositionCache {
    fn new(capacity: usize) -> Self {
        Self {
            entries: HashMap::new(),
            order: VecDeque::new(),
            capacity,
            #[cfg(test)]
            hits: 0,
            #[cfg(test)]
            misses: 0,
            #[cfg(test)]
            upgrades: 0,
        }
    }

    fn insert(&mut self, key: CacheKey, eval: CachedEval) {
        let existed = self.entries.insert(key.clone(), eval).is_some();
        if existed {
            #[cfg(test)]
            {
                self.upgrades += 1;
            }
        } else {
            #[cfg(test)]
            {
                self.misses += 1;
            }
            self.order.push_back(key);
        }
        while self.entries.len() > self.capacity {
            match self.order.pop_front() {
                Some(oldest) => {
                    self.entries.remove(&oldest);
                }
                None => break,
            }
        }
    }
}

/// Request-scoped shared evaluation context. Construct one per
/// `compute_transit_events`/`search_configuration` call and thread it
/// through every exact-aspect, station, and configuration-search probe that
/// call performs — never share one across requests (that would make the
/// cache persistent, which is explicitly out of scope).
pub(crate) struct EvaluationContext<'a> {
    chart: &'a ChartInstance,
    model: &'a AstroModel,
    backend: Box<dyn AstronomyBackend + Send + Sync>,
    cache: RefCell<PositionCache>,
}

impl<'a> EvaluationContext<'a> {
    /// Builds the backend exactly once (the single biggest win here — see
    /// the module doc comment) via the same `backend_for_chart` every other
    /// call path already uses.
    pub(crate) fn new(chart: &'a ChartInstance, model: &'a AstroModel) -> Self {
        Self {
            chart,
            model,
            backend: backend_for_chart(chart),
            cache: RefCell::new(PositionCache::new(MAX_CACHE_ENTRIES)),
        }
    }

    /// Longitude only, for one body — the common case for an aspect/orb
    /// root-finder probe.
    pub(crate) fn longitude(&self, body_id: &str, at: DateTime<Utc>) -> Result<f64, String> {
        self.ensure(&[body_id], at, RequiredQuantities::LongitudeOnly)?;
        self.cache
            .borrow()
            .entries
            .get(&cache_key(body_id, at))
            .map(|eval| eval.longitude)
            .ok_or_else(|| format!("{body_id}_unavailable"))
    }

    /// Longitude *and* motion for one body — a station search probe.
    pub(crate) fn longitude_and_motion(
        &self,
        body_id: &str,
        at: DateTime<Utc>,
    ) -> Result<(f64, AstronomyMotion), String> {
        self.ensure(&[body_id], at, RequiredQuantities::LongitudeAndMotion)?;
        let cache = self.cache.borrow();
        let eval = cache
            .entries
            .get(&cache_key(body_id, at))
            .ok_or_else(|| format!("{body_id}_unavailable"))?;
        let motion = eval
            .motion
            .clone()
            .ok_or_else(|| format!("{body_id}_motion_unavailable"))?;
        Ok((eval.longitude, motion))
    }

    /// Longitudes for several bodies at the same instant, batched into at
    /// most one backend call for whichever of them aren't already cached —
    /// preserves the one-call-for-both-bodies efficiency a mutual-aspect
    /// probe already relied on before this cache existed.
    pub(crate) fn longitudes(
        &self,
        body_ids: &[&str],
        at: DateTime<Utc>,
    ) -> Result<HashMap<String, f64>, String> {
        self.ensure(body_ids, at, RequiredQuantities::LongitudeOnly)?;
        let cache = self.cache.borrow();
        let mut out = HashMap::with_capacity(body_ids.len());
        for id in body_ids {
            if let Some(eval) = cache.entries.get(&cache_key(id, at)) {
                out.insert((*id).to_string(), eval.longitude);
            }
        }
        Ok(out)
    }

    /// Motion for several bodies at the same instant — e.g. a found event's
    /// reported motion, which may concern one body (a station, a
    /// fixed-point aspect hit) or two (a mutual aspect hit). Bodies with no
    /// motion available (an unavailable or degenerate state) are simply
    /// absent from the result rather than failing the whole call, matching
    /// this cache's own earlier behavior.
    pub(crate) fn motions(
        &self,
        body_ids: &[&str],
        at: DateTime<Utc>,
    ) -> Result<HashMap<String, AstronomyMotion>, String> {
        self.ensure(body_ids, at, RequiredQuantities::LongitudeAndMotion)?;
        let cache = self.cache.borrow();
        let mut out = HashMap::with_capacity(body_ids.len());
        for id in body_ids {
            if let Some(eval) = cache.entries.get(&cache_key(id, at)) {
                if let Some(motion) = eval.motion.clone() {
                    out.insert((*id).to_string(), motion);
                }
            }
        }
        Ok(out)
    }

    /// Longitudes for several bodies at this context's own resolved chart's
    /// natal moment (`chart.subject.event_time`, unmodified) rather than an
    /// arbitrary resampled instant — for a configuration-search role
    /// evaluated against the radix instead of being resampled over the
    /// search window.
    pub(crate) fn radix_longitudes(
        &self,
        body_ids: &[&str],
    ) -> Result<HashMap<String, f64>, String> {
        let radix_time = self
            .chart
            .subject
            .event_time
            .ok_or_else(|| "Chart has no subject.event_time".to_string())?;
        self.longitudes(body_ids, radix_time)
    }

    #[cfg(test)]
    pub(crate) fn cache_stats(&self) -> CacheStats {
        let cache = self.cache.borrow();
        CacheStats {
            hits: cache.hits,
            misses: cache.misses,
            upgrades: cache.upgrades,
            entries: cache.entries.len(),
            approx_bytes: cache.entries.len() * APPROX_BYTES_PER_ENTRY,
        }
    }

    /// Ensures every id in `body_ids` is cached at `at` with at least
    /// `tier`'s quantities, issuing at most one batched `compute_minimal`
    /// call for whichever ids are missing or tier-insufficient.
    ///
    /// # Why the cache key doesn't need chart settings
    ///
    /// `self.chart`/`self.model` (and therefore position mode, override
    /// ephemeris, house system, engine, ayanamsa, ...) are invariant for this
    /// context's entire lifetime — one context is built from one resolved
    /// chart for one request. A settings change can only happen by
    /// constructing a *new* `EvaluationContext` (and therefore starting from
    /// a fresh, empty cache), never by mutating this one. So "source and
    /// correction settings" are already pinned by the context's own
    /// identity; the only things that vary *within* a request are the body
    /// id and the epoch, which `CacheKey` captures directly. Epochs are
    /// never rounded: the dominant hit case is two edges' independent
    /// coarse scans sharing the same `[start, end]`/`discovery_step`, whose
    /// grid points are bit-identical by construction, not merely close.
    fn ensure(
        &self,
        body_ids: &[&str],
        at: DateTime<Utc>,
        tier: RequiredQuantities,
    ) -> Result<(), String> {
        let mut missing: Vec<String> = Vec::new();
        {
            let cache = self.cache.borrow();
            for id in body_ids {
                match cache.entries.get(&cache_key(id, at)) {
                    Some(eval) if eval.satisfies(tier) => {}
                    _ => missing.push((*id).to_string()),
                }
            }
        }
        #[cfg(test)]
        {
            let mut cache = self.cache.borrow_mut();
            cache.hits += (body_ids.len() - missing.len()) as u64;
        }
        if missing.is_empty() {
            return Ok(());
        }

        let selection = resolve_body_selection(
            &self.model.body_definitions,
            &missing,
            self.backend.backend_id(),
        );
        let sample = sampled_chart_at(self.chart, at);
        let minimal = self
            .backend
            .compute_minimal(&sample, &selection.ids, tier)?;

        let mut cache = self.cache.borrow_mut();
        for (id, longitude) in &minimal.positions {
            let key = cache_key(id, at);
            let motion = minimal.motion.get(id).cloned();
            cache.insert(
                key,
                CachedEval {
                    longitude: *longitude,
                    motion,
                },
            );
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn eval(longitude: f64) -> CachedEval {
        CachedEval {
            longitude,
            motion: None,
        }
    }

    /// Direct, deterministic proof that eviction actually bounds the cache
    /// at `capacity` and drops the *oldest* entry first — the end-to-end
    /// benchmark only ever demonstrated this indirectly (as a measured 0.1%
    /// hit rate when the bound was too small), which shows the *effect* but
    /// not, on its own, that the mechanism is FIFO rather than some other
    /// eviction order.
    #[test]
    fn eviction_is_bounded_and_drops_the_oldest_entry_first() {
        let mut cache = PositionCache::new(3);
        cache.insert(("a".to_string(), 1, 0), eval(10.0));
        cache.insert(("b".to_string(), 1, 0), eval(20.0));
        cache.insert(("c".to_string(), 1, 0), eval(30.0));
        assert_eq!(cache.entries.len(), 3);
        assert_eq!(cache.misses, 3);

        // A 4th distinct entry must evict "a" (the oldest), not "b" or "c".
        cache.insert(("d".to_string(), 1, 0), eval(40.0));
        assert_eq!(
            cache.entries.len(),
            3,
            "cache must stay bounded at capacity, not grow unbounded"
        );
        assert!(
            !cache.entries.contains_key(&("a".to_string(), 1, 0)),
            "the oldest entry must be the one evicted"
        );
        assert!(cache.entries.contains_key(&("b".to_string(), 1, 0)));
        assert!(cache.entries.contains_key(&("c".to_string(), 1, 0)));
        assert!(cache.entries.contains_key(&("d".to_string(), 1, 0)));
        assert_eq!(cache.misses, 4);
    }

    #[test]
    fn eviction_never_grows_past_capacity_across_many_inserts() {
        let mut cache = PositionCache::new(10);
        for i in 0..10_000i64 {
            cache.insert((format!("body{}", i % 7), i, 0), eval(i as f64));
        }
        assert!(
            cache.entries.len() <= 10,
            "cache must never exceed its configured capacity, got {}",
            cache.entries.len()
        );
    }

    fn read_vm_rss_kb() -> Option<u64> {
        let status = std::fs::read_to_string("/proc/self/status").ok()?;
        for line in status.lines() {
            if let Some(rest) = line.strip_prefix("VmRSS:") {
                return rest.split_whitespace().next()?.parse().ok();
            }
        }
        None
    }

    /// Real, measured per-entry memory cost (Linux `/proc/self/status`
    /// VmRSS delta), not the hand-estimated `APPROX_BYTES_PER_ENTRY` —
    /// exists specifically to check that estimate against reality rather
    /// than trusting an unverified guess. Populates a throwaway cache first
    /// and drops it, so the measured growth below reflects this cache's own
    /// steady-state cost, not one-time allocator arena/page-table setup.
    /// `#[ignore]`: reads process-wide RSS, which is noisy under parallel
    /// test execution — run alone, manually.
    #[test]
    #[ignore = "diagnostic memory measurement; reads /proc/self/status, Linux-only, run alone"]
    fn measures_real_per_entry_memory_cost() {
        const WARMUP: i64 = 50_000;
        const MEASURED: i64 = 500_000;

        {
            let mut warmup = PositionCache::new(WARMUP as usize);
            for i in 0..WARMUP {
                warmup.insert((format!("warmup-body-{i}"), i, 0), eval(i as f64));
            }
        }

        let before = read_vm_rss_kb().expect("/proc/self/status should be readable on Linux");
        let mut cache = PositionCache::new(MEASURED as usize);
        for i in 0..MEASURED {
            cache.insert(
                (format!("body{}", i % 20), i, 0),
                CachedEval {
                    longitude: i as f64,
                    motion: Some(AstronomyMotion {
                        speed: 1.0,
                        retrograde: false,
                    }),
                },
            );
        }
        let after = read_vm_rss_kb().expect("/proc/self/status should be readable on Linux");
        assert_eq!(cache.entries.len(), MEASURED as usize);

        let delta_kb = after.saturating_sub(before);
        let measured_bytes_per_entry = (delta_kb * 1024) as f64 / MEASURED as f64;
        println!(
            "measured per-entry memory cost: {measured_bytes_per_entry:.1} bytes/entry \
             (RSS delta {delta_kb} KiB over {MEASURED} entries, half with Some(motion)); \
             documented estimate (APPROX_BYTES_PER_ENTRY) = {APPROX_BYTES_PER_ENTRY} bytes/entry"
        );
    }
}
