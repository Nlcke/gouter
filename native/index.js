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
 * encodePath: (state: {name: any, params: Record<string, any>}) => string
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
    const prevStack = prevStackRef.current;
    prevStackRef.current = nextStack;

    const stack = useMemo(() => {
      if (prevStack === nextStack || prevStack.length === 0) {
        return nextStack;
      }

      const prevPaths = prevStack.map(encodePath);
      const nextPaths = nextStack.map(encodePath);

      let lastPath = null;

      for (let prevIndex = prevPaths.length - 1; prevIndex >= 0; prevIndex -= 1) {
        const prevPath = prevPaths[prevIndex];
        if (nextPaths.indexOf(prevPath) >= 0) {
          lastPath = prevPath;
          break;
        }
      }

      const joinedPaths = lastPath === null ? [...prevPaths] : [];

      for (let nextIndex = 0; nextIndex < nextPaths.length; nextIndex += 1) {
        const nextPath = nextPaths[nextIndex];
        const prevIndex = prevPaths.indexOf(nextPath);
        if (prevIndex === -1) {
          joinedPaths[joinedPaths.length] = nextPath;
        } else {
          for (let index = 0; index <= prevIndex; index += 1) {
            const path = prevPaths[index];
            if (joinedPaths.indexOf(path) === -1 && nextPaths.indexOf(path, nextIndex + 1) === -1) {
              joinedPaths[joinedPaths.length] = path;
            }
          }
        }
        if (nextPath === lastPath) {
          const lastIndex = prevPaths.indexOf(lastPath);
          for (let index = lastIndex + 1; index < prevPaths.length; index += 1) {
            const path = prevPaths[index];
            joinedPaths[joinedPaths.length] = path;
          }
        }
      }

      const joinedStack = joinedPaths.map(
        (path) => nextStack[nextPaths.indexOf(path)] || prevStack[prevPaths.indexOf(path)],
      );

      return joinedStack;
    }, [nextStack, prevStack]);

    /** @type {(subState: typeof state) => void} */
    const onSubStateUnmount = useCallback(
      (subState) => {
        const subPath = encodePath(subState);
        prevStackRef.current = prevStackRef.current.filter(
          (prevState) => subPath !== encodePath(prevState),
        );
        updateCounter((counter) => (counter + 1) % 1e9);
      },
      [encodePath],
    );

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

    useEffect(onAnimation, [onAnimation]);

    const panHandlers = useMemo(
      () => (onSwipeBack ? getSwipeBackPanHandlers(onSwipeBack) : null),
      [onSwipeBack],
    );

    const Screen = screenMap[state.name];

    const children = useMemo(
      () =>
        stack.map((subState, index) =>
          createElement(GouterNative, {
            key: encodePath(subState),
            state: subState,
            encodePath,
            defaultAnimation,
            animationDuration,
            screenMap,
            isStale: nextStack.indexOf(subState) === -1,
            onUnmount: onSubStateUnmount,
            onSwipeBack,
            isFocused: index === nextStack.length - 1,
          }),
        ),
      [
        defaultAnimation,
        animationDuration,
        nextStack,
        onSubStateUnmount,
        onSwipeBack,
        screenMap,
        stack,
        encodePath,
      ],
    );

    return createElement(Animated.View, {
      key: encodePath(state),
      ...panHandlers,
      style: animatedStyle,
      children: Screen ? createElement(Screen, { state, isFocused, children }) : null,
    });
  },
);

export default GouterNative;
