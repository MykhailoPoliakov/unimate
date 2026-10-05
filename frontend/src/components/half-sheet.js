import { useCallback, useEffect } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { GlassCircleButton } from '@/components/glass-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

const HIDE_Y = Dimensions.get('window').height;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const OPEN_MS = 340;
const CLOSE_MS = 280;

export function HalfSheet({ visible, title, onClose, children }) {
  const theme = useTheme();
  const dragY = useSharedValue(HIDE_Y);

  useEffect(() => {
    if (!visible) return undefined;
    dragY.value = HIDE_Y;
    const frame = requestAnimationFrame(() => {
      dragY.value = withTiming(0, { duration: OPEN_MS, easing: EASE });
    });
    return () => cancelAnimationFrame(frame);
  }, [dragY, visible]);

  const hide = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const animateClose = useCallback(() => {
    dragY.value = withTiming(HIDE_Y, { duration: CLOSE_MS, easing: EASE }, (finished) => {
      if (finished) runOnJS(hide)();
    });
  }, [dragY, hide]);

  const gesture = Gesture.Pan()
    .activeOffsetY(12)
    .onUpdate((event) => {
      dragY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 80 || event.velocityY > 800) {
        dragY.value = withTiming(HIDE_Y, { duration: CLOSE_MS, easing: EASE }, (finished) => {
          if (finished) runOnJS(hide)();
        });
        return;
      }
      dragY.value = withTiming(0, { duration: 220, easing: EASE });
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [0, HIDE_Y * 0.55], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={animateClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View pointerEvents="none" style={[styles.overlay, overlayStyle]} />
        <Pressable onPress={animateClose} style={StyleSheet.absoluteFill} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <GestureDetector gesture={gesture}>
            <Animated.View
              style={[
                styles.sheet,
                { backgroundColor: theme.background },
                sheetStyle,
              ]}>
              <ThemedView className="items-center pt-two bg-transparent">
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: theme.border,
                  }}
                />
              </ThemedView>
              <ThemedView className="flex-row items-center gap-three px-four pt-two pb-three bg-transparent">
                <GlassCircleButton onPress={animateClose} icon="close" accessibilityLabel="Close" />
                <ThemedText type="smallBold">{title}</ThemedText>
              </ThemedView>
              <ThemedView className="flex-1 px-four bg-transparent">{children}</ThemedView>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '50%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
});
