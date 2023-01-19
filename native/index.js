import { memo, useCallback, useMemo, useRef, useState, createElement, useEffect } from 'react';
import { PanResponder, Animated, StyleSheet } from 'react-native';

/**
 * @template State
 * @typedef {{
 * state: State,
 * isFocused: boolean,
 * children: React.ReactNode
 * }} ScreenProps
 */

/**
 * @typedef {(value: Animated.Value)
 * => Animated.WithAnimatedValue<import('react-native').ViewStyle>} Animation
 */

/** @type {(onSwipeBack: () => void) => import('react-native').GestureResponderHandlers} */
const getSwipeBackPanHandlers = (onSwipeBack) => {
  const HORIZONTAL_VELOCITY_THRESHOLD = 2;
  const VERTICAL_DISTANCE_THRESHOLD = 80;
  const PRESS_AREA_SIZE = 5;

  /** @type {(gesture: import('react-native').PanResponderGestureState) => boolean} */
  const isSwipeBack = ({ dx, dy, vx }) =>
    Math.abs(vx) > HORIZONTAL_VELOCITY_THRESHOLD &&
    Math.abs(dy) < VERTICAL_DISTANCE_THRESHOLD &&
    dx > 0;

  /** @type {import('react-native').PanResponderCallbacks['onStartShouldSetPanResponder']} */
  const onSwipeStartOrMove = (event, gesture) =>
    event.nativeEvent.touches.length === 1 &&
    (Math.abs(gesture.dx) >= PRESS_AREA_SIZE || Math.abs(gesture.dy) >= PRESS_AREA_SIZE) &&
    isSwipeBack(gesture);

  /** @type {import('react-native').PanResponderCallbacks['onPanResponderRelease']} */
  const onSwipeFinish = (_, gesture) => isSwipeBack(gesture) && onSwipeBack && onSwipeBack();

  return PanResponder.create({
    onStartShouldSetPanResponder: onSwipeStartOrMove,
    onMoveShouldSetPanResponder: onSwipeStartOrMove,
    onPanResponderRelease: onSwipeFinish,
    onPanResponderTerminate: onSwipeFinish,
  }).panHandlers;
};

/**
 * GouterNative
 * @type {React.FC<{
 * state: import('..').default<any>['state']
 * encodePath: import('..').default<any>['encodePath']
 * screenMap: Partial<Record<string, React.ComponentType<any>>>
 * animationDuration: number
 * defaultAnimation?: Animation
 * animationMap?: Record<string, Animation>
 * isStale?: boolean
 * onMount?: (state: import('..').default<any>['state']) => void
 * onUnmount?: (state: import('..').default<any>['state']) => void
 * onSwipeBack?: () => void
 * isFocused?: boolean
 * }>}
 */
const GouterNative = memo(
  ({
    state,
    encodePath,
    screenMap,
    animationDuration,
    defaultAnimation,
    animationMap,
    isStale,
    onMount,
    onUnmount,
    onSwipeBack,
    isFocused = true,
  }) => {
    const [, updateCounter] = useState(0);

    const emptyStack = useRef(/** @type {(typeof state)[]} */ ([])).current;
    const nextStack = state.stack || emptyStack;

    const prevStackRef = useRef(nextStack || emptyStack);
    const stackDiff = prevStackRef.current.filter((prevState) => {
      const prevPath = encodePath(prevState.name, prevState.params);
      return !nextStack.find(
        (nextState) => prevPath === encodePath(nextState.name, nextState.params),
      );
    });
    prevStackRef.current = nextStack;

    const staleStackRef = useRef(/** @type {typeof nextStack} */ ([]));
    if (stackDiff.length > 0) {
      staleStackRef.current = [...staleStackRef.current, ...stackDiff];
    }
    const staleStack = staleStackRef.current;

    const stack = useMemo(() => [...nextStack, ...staleStack], [nextStack, staleStack]);

    /** @type {(subState: typeof state) => void} */
    const onSubStateUnmount = useCallback((subState) => {
      const subPath = encodePath(subState.name, subState.params);
      staleStackRef.current = staleStackRef.current.filter(
        (staleState) => subPath !== encodePath(staleState.name, staleState.params),
      );
      updateCounter((counter) => (counter + 1) % 1e9);
    }, []);

    const animatedValue = useMemo(() => new Animated.Value(0), []);

    const customAnimation = animationMap ? animationMap[state.name] : null;

    const animatedStyle = useMemo(
      () => [
        StyleSheet.absoluteFill,
        customAnimation
          ? customAnimation(animatedValue)
          : defaultAnimation
          ? defaultAnimation(animatedValue)
          : null,
      ],
      [customAnimation, animatedValue, defaultAnimation],
    );

    const dateRef = useRef(0);

    /** @type {Animated.EndCallback} */
    const mount = useCallback(
      ({ finished }) => finished && onMount && onMount(state),
      [onMount, state],
    );

    /** @type {Animated.EndCallback} */
    const unmount = useCallback(
      ({ finished }) => finished && onUnmount && onUnmount(state),
      [onUnmount, state],
    );

    const onAnimation = useCallback(() => {
      const date = Date.now();
      const dateDiff = date - dateRef.current;
      Animated.timing(animatedValue, {
        useNativeDriver: true,
        toValue: isStale ? 0 : 1,
        duration: dateRef.current && dateDiff < animationDuration ? dateDiff : animationDuration,
      }).start(isStale ? unmount : mount);
      dateRef.current = date;
    }, [animatedValue, isStale, animationDuration, unmount, mount]);

    useEffect(onAnimation, [onAnimation, isStale]);

    const panHandlers = useMemo(
      () => (onSwipeBack ? getSwipeBackPanHandlers(onSwipeBack) : null),
      [onSwipeBack],
    );

    const Screen = screenMap[state.name];

    const children = useMemo(
      () =>
        stack.map((subState, index) =>
          createElement(GouterNative, {
            key: encodePath(subState.name, subState.params),
            state: subState,
            encodePath,
            defaultAnimation,
            animationDuration,
            screenMap,
            isStale: index >= nextStack.length,
            onUnmount: onSubStateUnmount,
            onSwipeBack,
            isFocused: index === nextStack.length - 1,
          }),
        ),
      [
        defaultAnimation,
        animationDuration,
        nextStack.length,
        onSubStateUnmount,
        onSwipeBack,
        screenMap,
        stack,
      ],
    );

    const key = encodePath(state.name, state.params);

    return createElement(Animated.View, {
      key,
      ...panHandlers,
      style: animatedStyle,
      children: Screen ? createElement(Screen, { state, isFocused, children }) : null,
    });
  },
);

export default GouterNative;
