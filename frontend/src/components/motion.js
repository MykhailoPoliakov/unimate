import { Pressable } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  ReduceMotion,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

function motion(anim) {
  return anim.reduceMotion(ReduceMotion.System);
}

export function listEnter(index = 0) {
  return motion(FadeInDown.duration(280).delay(Math.min(index, 5) * 40));
}

export const fadeIn = motion(FadeIn.duration(280));
export const fadeInDown = motion(FadeInDown.duration(320));
export const checkIn = motion(ZoomIn.duration(160));

export function PressScale({ children, style, contentStyle, pressedScale = 0.98, ...props }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      {...props}
      style={style}
      onPressIn={(event) => {
        scale.value = withTiming(pressedScale, { duration: 90 });
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withTiming(1, { duration: 140 });
        props.onPressOut?.(event);
      }}>
      <Animated.View style={[{ alignSelf: 'stretch' }, contentStyle, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
