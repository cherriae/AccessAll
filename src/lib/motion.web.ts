/**
 * Browser version of `motion.ts`, on the `devicemotion` event.
 *
 * expo-sensors' web Accelerometer cannot be used: it has no `addListener`,
 * and it reports orientation angles rather than acceleration.
 */
import type { Acceleration } from '@/lib/slope';

/** iOS Safari 13+ adds this, and only fires motion events once it resolves 'granted'. */
type MotionEventWithPermission = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

export async function isMotionAvailable(): Promise<boolean> {
  // Desktop browsers define the event too, but never fire it; the meter
  // notices that separately when no reading arrives.
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
}

/** Must run inside a tap handler on iOS, or Safari refuses without asking. */
export async function requestMotionPermission(): Promise<boolean> {
  const MotionEvent = DeviceMotionEvent as MotionEventWithPermission;
  if (typeof MotionEvent.requestPermission !== 'function') return true;
  try {
    return (await MotionEvent.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

export function watchAcceleration(onReading: (reading: Acceleration) => void, intervalMs: number): () => void {
  let last = 0;
  const handle = (event: DeviceMotionEvent) => {
    const g = event.accelerationIncludingGravity;
    if (g?.x == null || g.y == null || g.z == null) return;
    // Browsers fire at 60 Hz; match the native sampling rate.
    if (event.timeStamp - last < intervalMs) return;
    last = event.timeStamp;
    onReading({ x: g.x, y: g.y, z: g.z });
  };
  window.addEventListener('devicemotion', handle);
  return () => window.removeEventListener('devicemotion', handle);
}
