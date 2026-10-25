/**
 * Simulates colour vision deficiency, for the Empathy Lens.
 *
 * Uses the Machado, Oliveira & Fernandes (2009) model at full severity: a 3×3
 * matrix applied in *linear* RGB. Applying it to raw sRGB values (a common
 * shortcut) gets the brightness of the result wrong.
 *
 * Working on hex strings, rather than a screen filter, means the simulation
 * runs identically on iOS, Android and the web.
 */

export type ColorVision = 'typical' | 'deuteranopia' | 'protanopia';

type Matrix = readonly [number, number, number, number, number, number, number, number, number];

const MATRICES: Record<Exclude<ColorVision, 'typical'>, Matrix> = {
  // No working green cones; red-green colour blindness affects about 1 in 12 men.
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
};

function toLinear(channel: number) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function toSrgb(linear: number) {
  const c = Math.min(1, Math.max(0, linear));
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(v * 255);
}

export function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16)) as [number, number, number];
}

function toHex(rgb: readonly number[]) {
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function simulateColor(hex: string, vision: ColorVision): string {
  if (vision === 'typical') return hex;
  const m = MATRICES[vision];
  const [r, g, b] = parseHex(hex).map(toLinear);
  return toHex([
    toSrgb(m[0] * r + m[1] * g + m[2] * b),
    toSrgb(m[3] * r + m[4] * g + m[5] * b),
    toSrgb(m[6] * r + m[7] * g + m[8] * b),
  ]);
}

/** Straight-line distance between two colours in sRGB, 0 (same) to ~441 (black vs white). */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

/** Mixes `hex` toward `toward` by `amount` (0–1): used to wash out contrast for low vision. */
export function mixColor(hex: string, toward: string, amount: number): string {
  const a = parseHex(hex);
  const b = parseHex(toward);
  return toHex(a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount)));
}
