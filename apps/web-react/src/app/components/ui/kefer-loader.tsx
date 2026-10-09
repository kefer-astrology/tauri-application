import { useEffect, useRef, useState } from 'react';

/** Geometry ratios from the reference "Kefer Solilunar Loader" design — a circular card with a
 *  Sun fixed at 12 o'clock and a Moon sweeping clockwise around the same orbit, proportional to
 *  progress, with a fading blue trail arc between them. */
const CONTAINER_RATIO = 0.38;
const ORBIT_RATIO = 0.72;
const SUN_RATIO = 0.11;
const MIN_SUN_RADIUS = 14;
const MOON_RATIO = 0.85;
const START_ANGLE = -Math.PI / 2;

/** Asymptotic climb while the real operation is still in flight — always looks like it's working,
 *  never finishes on its own. Once the operation resolves, a fast catch-up to exactly 100%. */
const CLIMB_CAP = 92;
const CLIMB_RATE = 0.02;
const COMPLETE_RATE = 0.3;
const HOLD_AT_100_MS = 300;
const FADE_OUT_MS = 300;

function drawLoader(ctx: CanvasRenderingContext2D, size: number, progress: number) {
	const width = size;
	const height = size;
	const cx = width / 2;
	const cy = height / 2;

	ctx.clearRect(0, 0, width, height);

	const containerR = Math.min(width, height) * CONTAINER_RATIO;
	const orbitR = containerR * ORBIT_RATIO;
	const sunR = Math.max(MIN_SUN_RADIUS, containerR * SUN_RATIO);
	const moonR = sunR * MOON_RATIO;

	ctx.save();
	ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
	ctx.shadowBlur = 24;
	ctx.shadowOffsetX = 0;
	ctx.shadowOffsetY = 8;
	const cardGrad = ctx.createLinearGradient(cx, cy - containerR, cx, cy + containerR);
	cardGrad.addColorStop(0, '#FFFFFF');
	cardGrad.addColorStop(1, '#F8FAFD');
	ctx.fillStyle = cardGrad;
	ctx.beginPath();
	ctx.arc(cx, cy, containerR, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	const sweepAngle = (progress / 100) * Math.PI * 2;
	const moonAngle = START_ANGLE + sweepAngle;

	if (sweepAngle > 0.005) {
		const steps = Math.max(16, Math.floor(sweepAngle * 25));
		const stepAngle = sweepAngle / steps;
		ctx.lineWidth = 3.5;
		ctx.lineCap = 'round';
		for (let i = 0; i < steps; i += 1) {
			const a1 = START_ANGLE + i * stepAngle;
			const a2 = START_ANGLE + (i + 1) * stepAngle;
			const alpha = (i + 1) / steps;
			ctx.strokeStyle = `rgba(26, 115, 232, ${alpha})`;
			ctx.beginPath();
			ctx.arc(cx, cy, orbitR, a1, a2);
			ctx.stroke();
		}
	}

	const sunX = cx;
	const sunY = cy - orbitR;
	ctx.fillStyle = '#FFFFFF';
	ctx.strokeStyle = '#000000';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();

	const moonX = cx + orbitR * Math.cos(moonAngle);
	const moonY = cy + orbitR * Math.sin(moonAngle);
	ctx.fillStyle = '#000000';
	ctx.beginPath();
	ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
	ctx.fill();

	const fontSize = Math.max(24, Math.round(containerR * 0.32));
	ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
	ctx.fillStyle = '#1F1F1F';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(`${Math.round(progress)}%`, cx, cy);
}

/** Full-window "Kefer Solilunar Loader" overlay — appears above everything (including Dialog/
 *  Sheet's `z-50`) while `active` is true, climbing smoothly without ever finishing on its own,
 *  then snapping to 100% and fading out once `active` goes false. No real progress source exists
 *  for either caller (initial app boot, transit computation are single opaque async calls), so
 *  this is a deliberate "feels alive" animation, not a literal work-done percentage. */
export function KeferLoaderOverlay({ active }: { active: boolean }) {
	const [mounted, setMounted] = useState(active);
	const [fadeOut, setFadeOut] = useState(false);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const phaseRef = useRef<'climbing' | 'completing'>('climbing');
	const progressRef = useRef(0);
	const rafRef = useRef<number | null>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (active) {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
			setFadeOut(false);
			phaseRef.current = 'climbing';
			setMounted(true);
		} else if (phaseRef.current === 'climbing') {
			phaseRef.current = 'completing';
		}
	}, [active]);

	useEffect(() => {
		if (!mounted) return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const size = 260;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = size * dpr;
		canvas.height = size * dpr;
		canvas.style.width = `${size}px`;
		canvas.style.height = `${size}px`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const tick = () => {
			if (phaseRef.current === 'climbing') {
				progressRef.current += (CLIMB_CAP - progressRef.current) * CLIMB_RATE;
			} else {
				progressRef.current += (100 - progressRef.current) * COMPLETE_RATE;
				if (progressRef.current > 99.5 && !timeoutRef.current) {
					progressRef.current = 100;
					timeoutRef.current = setTimeout(() => {
						setFadeOut(true);
						timeoutRef.current = setTimeout(() => setMounted(false), FADE_OUT_MS);
					}, HOLD_AT_100_MS);
				}
			}
			drawLoader(ctx, size, progressRef.current);
			rafRef.current = requestAnimationFrame(tick);
		};
		rafRef.current = requestAnimationFrame(tick);

		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [mounted]);

	useEffect(
		() => () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		},
		[]
	);

	if (!mounted) return null;

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-sm transition-opacity duration-300"
			style={{ opacity: fadeOut ? 0 : 1 }}
			role="status"
			aria-live="polite"
		>
			<canvas ref={canvasRef} />
		</div>
	);
}
