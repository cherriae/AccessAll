/**
 * Raw accelerometer readings (gravity included) for the ramp slope meter.
 * Phones use expo-sensors; the web build uses the browser API directly
 * (`motion.web.ts`).
 */
import { Accelerometer } from 'expo-sensors';

import type { Acceleration } from '@/lib/slope';

export async function isMotionAvailable(): Promise<boolean> {
  return Accelerometer.isAvailableAsync();
}

/** Native apps need no permission for the accelerometer. */
export async function requestMotionPermission(): Promise<boolean> {
  return true;
}

/** Calls `onReading` every `intervalMs` until the returned function is called. */
export function watchAcceleration(onReading: (reading: Acceleration) => void, intervalMs: number): () => void {
  Accelerometer.setUpdateInterval(intervalMs);
  const subscription = Accelerometer.addListener(onReading);
  return () => subscription.remove();
}
