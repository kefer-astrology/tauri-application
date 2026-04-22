---
title: "Discussion summary"
description: "Historical architecture discussion notes from the earlier UI phase."
weight: 90
---

# Architecture Discussion Summary

> Historical planning notes from the earlier UI phase.
> Keep this page as background only.
> For the current migration state, use [MIGRATION.md](MIGRATION.md) and [spice-backend](./spice-backend/).

## Your Key Requirements

1. ✅ **User defines initial conditions** → UI forms → Tauri commands → compute routing
2. ✅ **Python can handle computation** → optional sidecar with CLI interface
3. ✅ **Persistent local storage** → DuckDB + Parquet for time series
4. ✅ **YAML compatibility** → Keep workspace/charts in YAML (same as Python package)
5. ✅ **2-chart relations** → Primary use case (transits, synastry)
6. ✅ **3-body relations** → Future-proof schema design
7. ✅ **Query-optimized** → DuckDB indexes and Parquet partitioning

## Architecture Decisions

### Storage Strategy: Hybrid YAML + DuckDB

**Why this approach:**

- **YAML for metadata**: Charts, subjects, workspace config are human-readable and match Python package
- **DuckDB for computed data**: Fast queries on time series, efficient storage, SQL interface
- **Parquet for archival**: Long-term storage, columnar format, compression

**Structure:**

```
workspace/
├── workspace.yaml          # Metadata (compatible with Python)
├── charts/*.yaml          # Chart definitions
└── data/
    ├── workspace.db      # DuckDB (positions, relations)
    └── positions/*.parquet  # Partitioned time series
```

### Python Sidecar Performance

**Performance considerations:**

- **Async communication**: Tauri commands are async, Python runs in background
- **Minimal overhead**: Only serialization/deserialization cost
- **Background processing**: Long computations don't block UI
- **Caching**: Store results in DuckDB, avoid recomputation

**When to consider Rust port:**

- If computation becomes bottleneck (>100ms per chart)
- If you need real-time updates (every second)
- If binary size is critical

**Historical recommendation**: Start with Python sidecar, measure performance, port only if needed.

**Current preferred direction**: keep Python optional, keep computation provenance explicit, and avoid tying chart semantics to a single backend implementation.

### Relation Structure

**2-Chart Relations (Primary):**

```sql
relations table:
  - source_chart_id: Base chart (natal/event)
  - target_chart_id: Transit chart (current time)
  - relation_type: 'transit', 'synastry', 'progression'
```

**3-Body Relations (Future):**

```sql
relations table:
  - source_chart_id: Chart 1
  - target_chart_id: Chart 2
  - third_chart_id: Chart 3 (optional)
  - relation_type: 'composite_transit', 'triple_synastry', etc.
```

**Aspect Computation:**

- Aspects are computed on demand from stored positions
- No aspect tables or Parquet files are persisted

### Main Date Table Structure

**Core table: `computed_positions`**

- Primary key: `(chart_id, datetime, object_id)`
- Indexes: `(chart_id, datetime)`, `(object_id)`
- Stores: longitude, latitude, distance, speed, retrograde

**Relation table: `relations`**

- Links charts together
- Stores configuration snapshots (JSONB)
- Tracks computation settings (engine, ephemeris file)

**Aspect data**

- Derived at query time from `computed_positions`

### Date Format Handling

**Storage:**

- All dates stored as ISO 8601 strings or TIMESTAMP in DuckDB
- Original format preserved in chart YAML

**Query:**

- DuckDB handles timezone conversions
- Can query by any time format (converted to TIMESTAMP)

**Example:**

```sql
-- Store with original format metadata
INSERT INTO relations (..., original_date_format)
VALUES (..., 'julian_day', 2459845.5);

-- Query converts automatically
SELECT * FROM computed_positions
WHERE datetime >= '2024-01-01'::TIMESTAMP;
```

### Source File Set (JPL/swisseph)

**Storage:**

- `engine` column: 'jpl', 'swisseph', 'jyotish', 'custom'
- `ephemeris_file` column: Path to BSP file (for JPL)
- Stored per relation (can mix engines in same workspace)

**Query:**

```sql
-- Find all computations using de421.bsp
SELECT * FROM relations
WHERE engine = 'jpl' AND ephemeris_file LIKE '%de421%';

-- Get positions computed with specific engine
SELECT * FROM computed_positions
WHERE chart_id IN (
    SELECT chart_id FROM relations WHERE engine = 'jpl'
);
```

## Implementation Phases

### Phase 1: Basic Chart Creation (Week 1-2)

- [ ] Tauri command: `create_chart()`
- [ ] Python CLI: `compute_positions`
- [ ] DuckDB schema setup
- [ ] Store single-timepoint positions
- [ ] Svelte UI: Chart creation form

### Phase 2: Transit Computation (Week 3-4)

- [ ] Tauri command: `compute_transit_series()`
- [ ] Python CLI: `compute_transit_series`
- [ ] Background job tracking
- [ ] Store time series in DuckDB
- [ ] Svelte UI: Transit computation panel

### Phase 3: Data Browsing (Week 5-6)

- [ ] Tauri commands: `query_positions()`, `query_aspects()` (derived from positions)
- [ ] DuckDB query optimization
- [ ] Svelte UI: Data tables, charts, filters
- [ ] Export functionality

### Phase 4: Background Service (Week 7-8)

- [ ] Tauri background task system
- [ ] Job queue management
- [ ] Progress tracking
- [ ] Error handling and retry

### Phase 5: Advanced Features (Week 9+)

- [ ] 3-body relations
- [ ] Parquet archival
- [ ] Performance optimization
- [ ] Rust porting (if needed)

## Open Questions

### 1. Time Granularity

**Question**: What's the minimum time step for transit computations?

**Options:**

- **Hourly**: Good for short-term transits (days/weeks)
- **Daily**: Good for long-term transits (months/years)
- **Adaptive**: Hourly for near-future, daily for far-future

**Recommendation**: Start with daily, add hourly option later.

### 2. Storage Limits

**Question**: How much historical data to keep?

**Options:**

- **Unlimited**: Store everything (requires good partitioning)
- **Time-based**: Keep last N years, archive older
- **Size-based**: Keep until database reaches X GB

**Recommendation**: Start unlimited, add archival later if needed.

### 3. Real-time Updates

**Question**: Should transits update in real-time or on-demand?

**Options:**

- **On-demand**: Compute when user requests
- **Scheduled**: Background service computes daily/hourly
- **Hybrid**: On-demand for new ranges, scheduled for updates

**Recommendation**: On-demand initially, add scheduled updates later.

### 4. Multi-workspace

**Question**: Support multiple workspaces simultaneously?

**Options:**

- **Single**: One workspace at a time (simpler)
- **Multiple**: Switch between workspaces (more complex)

**Recommendation**: Single workspace initially, add multi-workspace later.

### 5. Export Formats

**Question**: What formats for exporting computed data?

**Options:**

- **CSV**: Simple, universal
- **JSON**: Structured, easy to parse
- **Parquet**: Efficient, preserves types
- **PDF**: Human-readable reports

**Recommendation**: Start with CSV and JSON, add others as needed.

## Next Steps

1. **Review this architecture** - Does it match your vision?
2. **Answer open questions** - Make decisions on granularity, storage, etc.
3. **Start Phase 1** - Implement basic chart creation
4. **Iterate** - Build incrementally, test with real data

## Key Files to Create

### Rust (Tauri)

- `src-tauri/src/commands/compute.rs` - Computation commands
- `src-tauri/src/commands/workspace.rs` - Workspace management
- `src-tauri/src/storage/duckdb.rs` - DuckDB integration
- `src-tauri/src/storage/parquet.rs` - Parquet file handling

### Python

- `external_package/module/cli.py` - CLI interface for Tauri
- `external_package/module/storage.py` - DuckDB helpers (optional)

### TypeScript/Svelte

- `src/lib/stores/computations.ts` - Computation state
- `src/lib/stores/data.ts` - Data querying
- `src/lib/components/TransitComputation.svelte` - UI component
- `src/lib/components/DataBrowser.svelte` - Data browsing UI

## Questions for You

1. **Time granularity preference?** (hourly, daily, adaptive)
2. **Storage limits?** (unlimited, time-based, size-based)
3. **Real-time vs on-demand?** (preference for transit updates)
4. **Multi-workspace needed?** (now or later)
5. **Export format priority?** (CSV, JSON, PDF, Parquet)

Once you answer these, we can finalize the architecture and start implementation!
