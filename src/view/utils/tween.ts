// Minimal tween utility for frame-based animations with easing and cancellation.
// Keeps allocation low and avoids external deps.

export type CancelAnimation = () => void;

export type EasingFn = (t: number) => number;

export const Easing = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  // Overshoot easing for bounce-like effects
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export interface AnimateOptions {
  easing?: EasingFn;
  onComplete?: () => void;
}

export function animate(
  durationMs: number,
  onUpdate: (t: number) => void,
  opts?: AnimateOptions
): CancelAnimation {
  const easing = opts?.easing ?? ((t: number) => t);
  let rafId: number | undefined;
  let start: number | undefined;
  let cancelled = false;

  // Guard against non-positive durations: complete immediately
  if (durationMs <= 0) {
    onUpdate(easing(1));
    opts?.onComplete?.();
    return () => {};
  }

  const step = (now: number) => {
    if (cancelled) {
      rafId = undefined;
      return;
    }
    if (start === undefined) {
      start = now;
    }
    const elapsed = now - start;
    const t = Math.min(1, elapsed / durationMs);
    onUpdate(easing(t));
    if (t >= 1) {
      rafId = undefined;
      opts?.onComplete?.();
      return;
    }
    rafId = requestAnimationFrame(step);
  };

  rafId = requestAnimationFrame(step);

  return () => {
    cancelled = true;
    if (rafId !== undefined) {
      cancelAnimationFrame(rafId);
      rafId = undefined;
    }
  };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
