import React, { useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { Animated, PanResponder, ViewStyle } from 'react-native';

/** @typedef {Object} AnimatedTransformation
 * @property {Animated.AnimatedInterpolation} [translateX]
 * @property {Animated.AnimatedInterpolation} [translateY]
 * @property {Animated.AnimatedInterpolation} [scale]
 * @property {Animated.AnimatedInterpolation} [scaleX]
 * @property {Animated.AnimatedInterpolation} [scaleY]
 * @property {Animated.AnimatedInterpolation} [rotate]
 * @property {Animated.AnimatedInterpolation} [rotateX]
 * @property {Animated.AnimatedInterpolation} [rotateY]
 * @property {Animated.AnimatedInterpolation} [rotateZ]
 * @property {Animated.AnimatedInterpolation} [perspective]
 */

/** @typedef {Object} AnimatedStyle
 * @property {Animated.AnimatedInterpolation} [opacity]
 * @property {Animated.AnimatedInterpolation} [borderRadius]
 * @property {Animated.AnimatedInterpolation} [borderBottomEndRadius]
 * @property {Animated.AnimatedInterpolation} [borderBottomLeftRadius]
 * @property {Animated.AnimatedInterpolation} [borderBottomRightRadius]
 * @property {Animated.AnimatedInterpolation} [borderBottomStartRadius]
 * @property {Animated.AnimatedInterpolation} [borderTopEndRadius]
 * @property {Animated.AnimatedInterpolation} [borderTopLeftRadius]
 * @property {Animated.AnimatedInterpolation} [borderTopRightRadius]
 * @property {Animated.AnimatedInterpolation} [borderTopStartRadius]
 * @property {Animated.AnimatedInterpolation} [zIndex]
 * @property {Animated.AnimatedInterpolation} [elevation] Android only
 * @property {Animated.AnimatedInterpolation} [shadowOpacity] iOS only
 * @property {Animated.AnimatedInterpolation} [shadowRadius] iOS only
 * @property {Array<AnimatedTransformation>} [transform]
 */

/** @typedef {(value: Animated.Value) => AnimatedStyle} Animation */

const HORIZONTAL_VELOCITY_THRESHOLD = 2;
const VERTICAL_DISTANCE_THRESHOLD = 80;
const PRESS_AREA_SIZE = 5;

const { abs } = Math;

const isSwipeBack = ({ dx, dy, vx }) =>
  abs(vx) > HORIZONTAL_VELOCITY_THRESHOLD &&
  abs(dy) < VERTICAL_DISTANCE_THRESHOLD &&
  dx > 0;

const onSwipeStartOrMove = (event, gesture) =>
  event.nativeEvent.touches.length === 1 &&
  (abs(gesture.dx) >= PRESS_AREA_SIZE || abs(gesture.dy) >= PRESS_AREA_SIZE) &&
  isSwipeBack(gesture);

/**
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {boolean} props.isReverse
 * @param {number} props.duration
 * @param {any} props.state
 * @param {(state: any) => void} props.onSwipeBack
 * @param {ViewStyle} props.style
 * @param {Animation} props.animation
 * @param {(state: any) => void} [props.onMount]
 * @param {(state: any) => void} [props.onUnmount]
 */
const StackCard = ({
  isReverse,
  duration,
  state,
  onSwipeBack,
  style,
  animation,
  children,
  onMount,
  onUnmount,
}) => {
  const onSwipeBackRef = useRef(null);
  onSwipeBackRef.current = onSwipeBack;

  const onSwipeFinishRef = useRef(null);
  onSwipeFinishRef.current =
    onSwipeFinishRef.current ||
    ((_, gesture) =>
      isSwipeBack(gesture) &&
      onSwipeBackRef.current &&
      onSwipeBackRef.current());

  const panResponderRef = useRef(null);
  panResponderRef.current =
    panResponderRef.current ||
    PanResponder.create({
      onStartShouldSetPanResponder: onSwipeStartOrMove,
      onMoveShouldSetPanResponder: onSwipeStartOrMove,
      onPanResponderRelease: onSwipeFinishRef.current,
      onPanResponderTerminate: onSwipeFinishRef.current,
    });

  const animatedValueRef = useRef(null);
  animatedValueRef.current = animatedValueRef.current || new Animated.Value(0);

  const animatedStyle = useMemo(
    () => [style, animation ? animation(animatedValueRef.current) : null],
    [style, animation],
  );

  const dateRef = useRef(0);

  const mount = useCallback(
    ({ finished }) => finished && onMount && onMount(state),
    [onMount, state],
  );
  const unmount = useCallback(
    ({ finished }) => finished && onUnmount && onUnmount(state),
    [onUnmount, state],
  );

  const onAnimation = useCallback(() => {
    const date = Date.now();
    const dateDiff = date - dateRef.current;
    Animated.timing(animatedValueRef.current, {
      useNativeDriver: true,
      toValue: isReverse ? 0 : 1,
      duration: dateRef.current && dateDiff < duration ? dateDiff : duration,
    }).start(isReverse ? unmount : mount);
    dateRef.current = date;
  }, [isReverse, duration, unmount, mount]);

  useEffect(onAnimation, [onAnimation, isReverse]);

  return (
    <Animated.View
      {...panResponderRef.current.panHandlers}
      style={animatedStyle}
      children={children}
    />
  );
};

export default memo(StackCard);
