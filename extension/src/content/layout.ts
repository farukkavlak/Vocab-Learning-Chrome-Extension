/** How close to the edge of the window anything we draw may come. */
export const EDGE = 8;

/**
 * Keeps a coordinate inside the window. `min` wins when the two bounds cross, which is
 * what a window too short for what is being placed in it comes down to.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
