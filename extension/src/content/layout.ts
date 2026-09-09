/** How close to the edge of the window anything we draw may come. */
export const EDGE = 8;

/** `min` wins when the bounds cross: the window is too short for what is being placed. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
