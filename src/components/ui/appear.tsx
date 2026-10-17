import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

export interface AppearProps {
  children: ReactNode;
  /** Position in a list; each item starts a beat after the one before. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/** Caps the stagger so item 30 in a long list does not wait two seconds. */
const MAX_STAGGERED = 8;

/**
 * Content that rises gently into place when it first renders.
 *
 * Used on cards and list rows so a screen assembles itself rather than
 * popping in all at once. Follows the system Reduce Motion setting: with it on,
 * content simply appears.
 */
export function Appear({ children, index = 0, style }: AppearProps) {
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.duration(420)
        .delay(Math.min(index, MAX_STAGGERED) * 55)
        .springify()
        .damping(18)
        .reduceMotion(ReduceMotion.System)}
    >
      {children}
    </Animated.View>
  );
}
