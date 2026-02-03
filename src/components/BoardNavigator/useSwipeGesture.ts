/**
 * Swipe Gesture Hook
 * Detects horizontal swipe gestures for zone navigation
 */

import { useRef, useCallback } from "react";

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

const SWIPE_THRESHOLD = 50; // Minimum distance in pixels
const SWIPE_VELOCITY_THRESHOLD = 0.3; // Minimum velocity (px/ms)
const MAX_VERTICAL_RATIO = 0.75; // Max vertical/horizontal ratio to count as horizontal swipe

export function useSwipeGesture({ onSwipeLeft, onSwipeRight }: SwipeHandlers) {
  const touchState = useRef<TouchState | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchState.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchState.current.startX;
      const deltaY = touch.clientY - touchState.current.startY;
      const deltaTime = Date.now() - touchState.current.startTime;

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const velocity = absX / deltaTime;

      // Check if this is a horizontal swipe
      const isHorizontal = absY / absX < MAX_VERTICAL_RATIO;
      const hasEnoughDistance = absX > SWIPE_THRESHOLD;
      const hasEnoughVelocity = velocity > SWIPE_VELOCITY_THRESHOLD;

      if (isHorizontal && hasEnoughDistance && hasEnoughVelocity) {
        if (deltaX < 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
      }

      touchState.current = null;
    },
    [onSwipeLeft, onSwipeRight]
  );

  const onTouchCancel = useCallback(() => {
    touchState.current = null;
  }, []);

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
  };
}
