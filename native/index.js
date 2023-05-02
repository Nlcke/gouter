import { memo, useCallback, useMemo, useRef, useState, createElement } from 'react';
import { PanResponder, Animated, StyleSheet, Dimensions } from 'react-native';

/** @typedef {import('..').default<any>} Gouter */

/** @typedef {Gouter['state']} State */

/**
 * @template State
 * @typedef {{
 * state: State,
 * isFocused: boolean,
 * isStale: boolean,
 * children: React.ReactNode
 * }} ScreenProps
 */

/** @typedef {Animated.WithAnimatedValue<import('react-native').ViewStyle>} AnimatedStyle */

/**
 * @typedef {(props: {index: Animated.AnimatedSubtraction<number>, size: Animated.ValueXY, focused: Animated.Value, bounce: Animated.Value})
 * => AnimatedStyle | [AnimatedStyle, AnimatedStyle]} Animation
 */

/**
 * @template ScreenConfig
 * @template {State} ScreenState
 * @typedef {ScreenConfig | ((state: ScreenState) => ScreenConfig)} Flexible
 */

/**
 * @typedef {{
 * component: React.ComponentType<ScreenProps<any>>
 * stackAnimation: Animation
 * stackAnimationDuration: number
 * stackSwipeGesture?: 'horizontal' | 'vertical' | 'none'
 * }} ScreenConfig
 */

/**
 * @template {State} ScreenState
 * @typedef {{[Name in ScreenState['name']]: Flexible<
 * ScreenConfig, ScreenState & {name: Name}
 * >}} ScreenConfigMap
 */

/**
 * @template {State} ScreenState
 * @typedef {{[Name in ScreenState['name']]: React.FC<ScreenProps<ScreenState & {name: Name}>>}} ScreenMap
 */

/**
 * Joins previous and next stacks together
 * @type {(
 * prevStack: State[],
 * nextStack: State[],
 * encodePath: (state: State) => string
 * )=> State[]}
 */
const getJoinedStack = (prevStack, nextStack, encodePath) => {
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
};

const swipeStartThreshold = 5;
const swipeCancelThreshold = 20;

/** @type {(event: any, gestureState: any) => void} */
const defaultOnPanResponderFinish = () => {};

/** @type {ScreenConfig} */
const defaultScreenConfig = {
  component: () => null,
  stackAnimation: () => ({}),
  stackAnimationDuration: 0,
};

/** @type {State[]} */
const emptyStack = [];

const defaultAnimatedValue = new Animated.Value(0);

const defaultSize = {
  width: Dimensions.get('window').width,
  height: Dimensions.get('window').height,
};

const defaultStackRef = { current: /** @type {State[]} */ ([]) };

let panRespondersBlocked = false;

const defaultAnimatedSize = new Animated.ValueXY();

const defaultBounceRef = { current: 0 };

const defaultAnimatedBounce = new Animated.Value(0);

const defaultAnimationDurationRef = { current: 0 };

const defaultStackSwipeGestureRef = { current: undefined };

/**
 * @type {React.FC<{
 * state: State
 * screenConfigMap: ScreenConfigMap<any>
 * encodePath: Gouter['encodePath']
 * goTo: Gouter['goTo']
 * isStale: boolean
 * isFocused: boolean
 * animatedFocusedIndex: Animated.Value
 * index: number
 * stackRef: React.MutableRefObject<State[]>
 * stackAnimation?: Animation
 * size: {width: number, height: number}
 * animatedSize: Animated.ValueXY
 * bounceRef: React.MutableRefObject<number>
 * animatedBounce: Animated.Value
 * animationDurationRef: React.MutableRefObject<number>
 * stackSwipeGestureRef: React.MutableRefObject<ScreenConfig['stackSwipeGesture']>
 * }>}
 */
const GouterNativeStack = memo(
  ({
    state,
    screenConfigMap,
    encodePath,
    goTo,
    isStale,
    isFocused,
    animatedFocusedIndex,
    index,
    stackRef,
    stackAnimation,
    size,
    animatedSize,
    bounceRef,
    animatedBounce,
    animationDurationRef,
    stackSwipeGestureRef,
  }) => {
    const [, updateState] = useState([]);

    const nextStack = state.stack || emptyStack;

    const nextStackRef = useRef(nextStack);
    nextStackRef.current = nextStack;

    const prevStackRef = useRef(nextStack);
    const prevStack = prevStackRef.current;

    const stack = useMemo(
      () => getJoinedStack(prevStack, nextStack, encodePath),
      [encodePath, nextStack, prevStack],
    );

    prevStackRef.current = stack;

    const focusedFreshIndex = state.index !== undefined ? state.index : nextStack.length - 1;
    const focusedIndex = stack.indexOf(nextStack[focusedFreshIndex]);

    const thisAnimatedFocusedIndex = useRef(new Animated.Value(focusedIndex)).current;

    const maybeScreenConfig = screenConfigMap[state.name];
    const thisScreenConfig =
      typeof maybeScreenConfig === 'function'
        ? maybeScreenConfig(state)
        : maybeScreenConfig || defaultScreenConfig;

    const thisAnimationDurationRef = useRef(thisScreenConfig.stackAnimationDuration);
    thisAnimationDurationRef.current = thisScreenConfig.stackAnimationDuration;

    const indexRef = useRef(index);
    const prevIndex = indexRef.current;
    indexRef.current = index;

    const animatedIndex = useRef(new Animated.Value(index)).current;

    if (index !== prevIndex) {
      animatedIndex.stopAnimation(() =>
        Animated.timing(animatedIndex, {
          toValue: index,
          useNativeDriver: true,
          duration: animationDurationRef.current,
        }).start(),
      );
    }

    const animatedValue = useMemo(
      () => Animated.subtract(animatedIndex, animatedFocusedIndex),
      [animatedFocusedIndex, animatedIndex],
    );

    const thisAnimatedSize = useRef(new Animated.ValueXY()).current;

    const animatedIsFocused = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
    const prevIsFocusedRef = useRef(isFocused);
    if (isFocused !== prevIsFocusedRef.current) {
      animatedIsFocused.setValue(isFocused ? 1 : 0);
    }
    prevIsFocusedRef.current = isFocused;

    const animatedStyleOrStyles = useMemo(
      () =>
        stackAnimation
          ? stackAnimation({
              index: animatedValue,
              size: animatedSize,
              focused: animatedIsFocused,
              bounce: animatedBounce,
            })
          : null,
      [stackAnimation, animatedValue, animatedSize, animatedIsFocused, animatedBounce],
    );
    const animatedStyle = Array.isArray(animatedStyleOrStyles)
      ? animatedStyleOrStyles[1]
      : animatedStyleOrStyles;
    const style = useMemo(() => [StyleSheet.absoluteFill, animatedStyle], [animatedStyle]);
    const overlayStyle = Array.isArray(animatedStyleOrStyles) ? animatedStyleOrStyles[0] : null;

    const focusedIndexRef = useRef(focusedIndex);
    const prevFocusedIndex = focusedIndexRef.current;
    focusedIndexRef.current = focusedIndex;

    const focusedFreshIndexRef = useRef(focusedFreshIndex);
    const prevFocusedFreshIndex = focusedFreshIndexRef.current;
    focusedFreshIndexRef.current = focusedFreshIndex;

    const onIndexChange = useCallback(
      (/** @type {number} */ currentIndex) => {
        const duration =
          thisAnimationDurationRef.current *
          Math.min(1, Math.abs(currentIndex - focusedIndexRef.current));
        if (duration === 0) {
          prevStackRef.current = nextStackRef.current;
          thisAnimatedFocusedIndex.setValue(focusedIndexRef.current);
          updateState([]);
        } else {
          Animated.timing(thisAnimatedFocusedIndex, {
            useNativeDriver: true,
            toValue: focusedIndexRef.current,
            duration,
          }).start(({ finished }) => {
            if (finished) {
              prevStackRef.current = nextStackRef.current;
              updateState([]);
            }
          });
        }
      },
      [thisAnimatedFocusedIndex],
    );

    if (focusedIndex !== prevFocusedIndex || focusedFreshIndex !== prevFocusedFreshIndex) {
      thisAnimatedFocusedIndex.stopAnimation(onIndexChange);
    }

    const thisBounceRef = useRef(0);
    const thisAnimatedBounce = useRef(new Animated.Value(0)).current;

    const Screen = thisScreenConfig.component;
    const thisStackRef = useRef(stack);
    thisStackRef.current = stack;
    const thisSize = useRef({ width: 0, height: 0 }).current;
    const thisStackAnimation = thisScreenConfig.stackAnimation;
    const thisStackSwipeGestureRef = useRef(thisScreenConfig.stackSwipeGesture);
    thisStackSwipeGestureRef.current = thisScreenConfig.stackSwipeGesture;

    const children = useMemo(
      () =>
        stack.map((subState, subIndex) =>
          createElement(GouterNativeStack, {
            key: encodePath(subState),
            state: subState,
            encodePath,
            goTo,
            screenConfigMap,
            isStale: nextStack.indexOf(subState) === -1,
            isFocused: subIndex === focusedIndex,
            animatedFocusedIndex: thisAnimatedFocusedIndex,
            index: subIndex,
            stackRef: thisStackRef,
            stackAnimation: thisStackAnimation,
            size: thisSize,
            animatedSize: thisAnimatedSize,
            bounceRef: thisBounceRef,
            animatedBounce: thisAnimatedBounce,
            animationDurationRef: thisAnimationDurationRef,
            stackSwipeGestureRef: thisStackSwipeGestureRef,
          }),
        ),
      [
        stack,
        encodePath,
        goTo,
        screenConfigMap,
        nextStack,
        focusedIndex,
        thisAnimatedFocusedIndex,
        thisStackAnimation,
        thisSize,
        thisAnimatedSize,
        thisAnimatedBounce,
      ],
    );

    const valueSyncedRef = useRef(false);
    const animationShouldBeSyncedRef = useRef(false);
    const valueRef = useRef(0);
    const onPanResponderFinishRef = useRef(defaultOnPanResponderFinish);
    const onValue = useCallback((/** @type {number} */ value) => {
      valueSyncedRef.current = true;
      valueRef.current = value;
      if (animationShouldBeSyncedRef.current) {
        onPanResponderFinishRef.current({}, { dx: 0, vx: 0, dy: 0, vy: 0 });
        animationShouldBeSyncedRef.current = false;
      }
    }, []);

    const stateRef = useRef(state);
    stateRef.current = state;

    /** @type {NonNullable<import('react-native').PanResponderCallbacks['onMoveShouldSetPanResponder']>} */
    const onMoveShouldSetPanResponder = useCallback(
      (event, { dx, dy }) => {
        const stackSwipeGesture = stackSwipeGestureRef.current;
        if (panRespondersBlocked || !stackSwipeGesture || stackSwipeGesture === 'none') {
          return false;
        }
        const isHorizontal = stackSwipeGesture === 'horizontal';
        const shouldSet =
          event.nativeEvent.touches.length === 1 &&
          Math.abs(isHorizontal ? dx : dy) > swipeStartThreshold &&
          Math.abs(isHorizontal ? dy : dx) < swipeCancelThreshold;
        if (shouldSet) {
          panRespondersBlocked = true;
          valueSyncedRef.current = false;
          animatedFocusedIndex.stopAnimation(onValue);
        }
        return shouldSet;
      },
      [animatedFocusedIndex, onValue, stackSwipeGestureRef],
    );

    const bounceAnimation = useMemo(
      () => Animated.spring(animatedBounce, { toValue: 0, useNativeDriver: true }),
      [animatedBounce],
    );
    const bounceOffsetRef = useRef(0);
    const bounceCallback = useCallback(
      (/** @type {number} */ currentValue) => {
        const bounceRaw = currentValue + bounceOffsetRef.current;
        const maxIndex = stackRef.current.length - 1;
        bounceRef.current = Math.max(Math.min(bounceRaw, maxIndex + 1), -1);
        animatedBounce.setValue(bounceRef.current);
        bounceAnimation.start();
      },
      [animatedBounce, bounceAnimation, bounceRef, stackRef],
    );

    /** @type {NonNullable<import('react-native').PanResponderCallbacks['onPanResponderMove']>} */
    const onPanResponderMove = useCallback(
      (_, { dx, dy }) => {
        const isHorizontal = stackSwipeGestureRef.current === 'horizontal';
        const delta = isHorizontal ? dx : dy;
        const side = isHorizontal ? size.width : size.height;
        const offset = delta / side || 0;
        const valueRaw = valueRef.current - offset;
        const maxIndex = stackRef.current.length - 1;
        const value = valueRaw < 0 ? 0 : valueRaw > maxIndex ? maxIndex : valueRaw;
        if (value !== valueRaw) {
          valueRef.current = (valueRaw > maxIndex ? maxIndex : 0) + offset;
          bounceOffsetRef.current = valueRaw - value;
          animatedBounce.stopAnimation(bounceCallback);
        }
        animatedFocusedIndex.setValue(value);
      },
      [animatedBounce, animatedFocusedIndex, bounceCallback, size, stackRef, stackSwipeGestureRef],
    );

    /** @type {NonNullable<import('react-native').PanResponderCallbacks['onPanResponderRelease']>} */
    const onPanResponderReleaseOrTerminate = useCallback(
      (_, { dx, vx, dy, vy }) => {
        if (!valueSyncedRef.current) {
          animationShouldBeSyncedRef.current = true;
          return;
        }

        panRespondersBlocked = false;
        const isHorizontal = stackSwipeGestureRef.current === 'horizontal';
        const delta = isHorizontal ? dx : dy;

        const velocity = isHorizontal ? vx : vy;
        const side = isHorizontal ? size.width : size.height;

        const offset = delta / side || 0;
        const velocityOffset = Math.max(Math.min(0.5, 0.25 * velocity), -0.5);

        const valueRaw = valueRef.current - offset - velocityOffset;
        const maxIndex = stackRef.current.length - 1;
        const value = valueRaw < 0 ? 0 : valueRaw > maxIndex ? maxIndex : valueRaw;
        const nextPossibleIndex = Math.round(value);
        const nextState = stackRef.current[nextPossibleIndex] || stateRef.current;
        const nextIndex = nextState === stateRef.current ? indexRef.current : nextPossibleIndex;

        const diff = Math.abs(nextIndex - value);
        const duration = animationDurationRef.current * diff;

        Animated.timing(animatedFocusedIndex, {
          toValue: nextIndex,
          useNativeDriver: true,
          duration,
        }).start(({ finished }) => {
          if (finished) {
            goTo(nextState.name, nextState.params, nextState.stack);
          }
        });
      },
      [animatedFocusedIndex, animationDurationRef, goTo, size, stackRef, stackSwipeGestureRef],
    );

    onPanResponderFinishRef.current = onPanResponderReleaseOrTerminate;

    const panHandlers = useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder,
          onPanResponderMove,
          onPanResponderRelease: onPanResponderReleaseOrTerminate,
          onPanResponderTerminate: onPanResponderReleaseOrTerminate,
          onPanResponderTerminationRequest: () => false,
        }).panHandlers,
      [onMoveShouldSetPanResponder, onPanResponderMove, onPanResponderReleaseOrTerminate],
    );

    const layoutChild = useMemo(
      () =>
        createElement(Animated.View, {
          key: '',
          style: { ...StyleSheet.absoluteFillObject, opacity: 0 },
          pointerEvents: 'none',
          onLayout: ({ nativeEvent }) => {
            const { width, height } = nativeEvent.layout;
            const shouldUpdate = thisSize.width === 0 || thisSize.height === 0;
            thisSize.width = width;
            thisSize.height = height;
            thisAnimatedSize.setValue({ x: width, y: height });
            if (shouldUpdate) {
              updateState([]);
            }
          },
        }),
      [thisAnimatedSize, thisSize],
    );

    const overlayChild = useMemo(
      () =>
        overlayStyle
          ? createElement(Animated.View, {
              key: '',
              style: { ...StyleSheet.absoluteFillObject, opacity: 0, ...overlayStyle },
              pointerEvents: 'none',
            })
          : null,
      [overlayStyle],
    );

    const hasSize = size.width > 0 && size.height > 0;

    const extendedChildren = useMemo(
      () => (hasSize ? [layoutChild, ...children] : layoutChild),
      [hasSize, layoutChild, children],
    );

    return createElement(Animated.View, {
      key: encodePath(state),
      ...panHandlers,
      style,
      children: [
        Screen
          ? createElement(Screen, {
              key: encodePath(state),
              state,
              isFocused,
              isStale,
              children: extendedChildren,
            })
          : null,
        overlayChild,
      ],
    });
  },
);

/**
 * @type {React.FC<{
 * state: State
 * screenConfigMap: ScreenConfigMap<any>
 * encodePath: (state: {name: any, params: Record<string, any>}) => string
 * goTo: (name: any, params: Record<string, any>, stack?: any) => void
 * }>}
 */
const GouterNative = memo((props) =>
  createElement(GouterNativeStack, {
    isStale: false,
    isFocused: true,
    animatedFocusedIndex: defaultAnimatedValue,
    index: 0,
    stackRef: defaultStackRef,
    stackAnimation: defaultScreenConfig.stackAnimation,
    size: defaultSize,
    animatedSize: defaultAnimatedSize,
    bounceRef: defaultBounceRef,
    animatedBounce: defaultAnimatedBounce,
    animationDurationRef: defaultAnimationDurationRef,
    stackSwipeGestureRef: defaultStackSwipeGestureRef,
    ...props,
  }),
);

export default GouterNative;
