import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { listEnter } from '@/components/motion';

const HOLD_MS = 240;
const MENU_MS = 500;
const DRAG_WINDOW_MS = 800;
const GAP = 8;
const MOVE_PX = 8;

function moveItem(items, from, to) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function SortableSection({ items, onReorder, onHold, renderItem, enabled }) {
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const dragY = useSharedValue(0);
  const [lifted, setLifted] = useState(null);
  const origins = useSharedValue({});
  const overlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  const handleHold = useCallback(
    (index) => {
      dragY.value = 0;
      setLifted(null);
      const item = itemsRef.current[index];
      if (item) onHold?.(item);
    },
    [dragY, onHold]
  );

  const handleLift = useCallback(
    (index, top) => {
      dragY.value = 0;
      setLifted({ index, y: top });
    },
    [dragY]
  );

  const handleRelease = useCallback(
    (from, translationY, didDrag) => {
      const list = itemsRef.current;
      const item = list[from];
      const pitch = (origins.value[item?.id] ?? 96) + GAP;
      const to = Math.max(0, Math.min(list.length - 1, from + Math.round(translationY / pitch)));
      dragY.value = 0;
      setLifted(null);
      if (didDrag && item && from !== to) onReorder(moveItem(list, from, to));
    },
    [dragY, onReorder, origins]
  );

  const liftedItem = lifted ? items[lifted.index] : null;

  return (
    <View>
      {items.map((item, index) => (
        <SortableRow
          key={item.id}
          index={index}
          itemId={item.id}
          hidden={lifted?.index === index}
          origins={origins}
          dragY={dragY}
          enabled={enabled}
          onHold={handleHold}
          onLift={handleLift}
          onRelease={handleRelease}>
          {renderItem(item, index)}
        </SortableRow>
      ))}
      {liftedItem ? (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', left: 0, right: 0, top: lifted.y, zIndex: 30 },
            overlayStyle,
          ]}>
          {renderItem(liftedItem, lifted.index)}
        </Animated.View>
      ) : null}
    </View>
  );
}

function SortableRow({ index, itemId, hidden, origins, dragY, enabled, onHold, onLift, onRelease, children }) {
  const y = useSharedValue(0);
  const dragging = useSharedValue(false);
  const menuShown = useSharedValue(false);
  const indexRef = useRef(index);
  indexRef.current = index;
  const onHoldRef = useRef(onHold);
  onHoldRef.current = onHold;
  const onLiftRef = useRef(onLift);
  onLiftRef.current = onLift;
  const onReleaseRef = useRef(onRelease);
  onReleaseRef.current = onRelease;
  const menuTimer = useRef(null);

  const clearMenuTimer = useCallback(() => {
    if (menuTimer.current) {
      clearTimeout(menuTimer.current);
      menuTimer.current = null;
    }
  }, []);

  const hold = useCallback(() => {
    onHoldRef.current(indexRef.current);
  }, []);

  const lift = useCallback(() => {
    onLiftRef.current(indexRef.current, y.value);
  }, [y]);

  const release = useCallback((translationY, didDrag) => {
    onReleaseRef.current(indexRef.current, translationY, didDrag);
  }, []);

  const armMenu = useCallback(() => {
    clearMenuTimer();
    menuTimer.current = setTimeout(() => {
      menuTimer.current = null;
      if (dragging.value) return;
      menuShown.value = true;
      hold();
    }, DRAG_WINDOW_MS);
  }, [clearMenuTimer, dragging, hold, menuShown]);

  const gesture = useMemo(() => {
    const menu = Gesture.LongPress()
      .minDuration(MENU_MS)
      .maxDistance(MOVE_PX)
      .cancelsTouchesInView(true)
      .onStart(() => {
        runOnJS(hold)();
      });

    if (!enabled) return menu;

    const drag = Gesture.Pan()
      .maxPointers(1)
      .activateAfterLongPress(HOLD_MS)
      .cancelsTouchesInView(true)
      .onStart(() => {
        dragging.value = false;
        menuShown.value = false;
        dragY.value = 0;
        runOnJS(armMenu)();
      })
      .onUpdate((event) => {
        if (menuShown.value) return;
        if (Math.abs(event.translationY) <= MOVE_PX && !dragging.value) return;
        if (!dragging.value) {
          dragging.value = true;
          runOnJS(clearMenuTimer)();
          runOnJS(lift)();
        }
        dragY.value = event.translationY;
      })
      .onEnd((event) => {
        const didDrag = dragging.value;
        dragging.value = false;
        runOnJS(clearMenuTimer)();
        runOnJS(release)(event.translationY, didDrag);
      })
      .onFinalize(() => {
        dragging.value = false;
        runOnJS(clearMenuTimer)();
      });

    return drag;
  }, [armMenu, clearMenuTimer, dragY, dragging, enabled, hold, lift, menuShown, release]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        entering={listEnter(index)}
        onLayout={(event) => {
          const { y: top, height } = event.nativeEvent.layout;
          y.value = top;
          origins.value = { ...origins.value, [itemId]: height };
        }}
        style={{ marginBottom: GAP }}>
        <View style={{ opacity: hidden ? 0 : 1 }}>{children}</View>
      </Animated.View>
    </GestureDetector>
  );
}
