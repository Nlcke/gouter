import { memo, useCallback, useMemo, useRef, useState, createElement } from 'react';
import { PanResponder, Animated, StyleSheet, Dimensions } from 'react-native';

/** @typedef {import('..').default<any>} Gouter */

/** @typedef {Gouter['state']} State */

/**
 * @typedef {{
 * index: Animated.AnimatedSubtraction<number>,
 * width: EnhancedAnimatedValue,
 * height: EnhancedAnimatedValue,
 * focused: EnhancedAnimatedValue,
 * bounce: EnhancedAnimatedValue
 * }} AnimationProps
 */

/**
 * @template State
 * @typedef {{
 * state: State
 * isFocused: boolean
 * isStale: boolean
 * animationProps: AnimationProps
 * children: React.ReactNode
 * }} ScreenProps
 */

/** @typedef {Animated.WithAnimatedValue<import('react-native').ViewStyle>} AnimatedStyle */

/** @typedef {Animated.Value & {value: number}} EnhancedAnimatedValue */

/**
 * @typedef {(props: AnimationProps) => AnimatedStyle | [AnimatedStyle, AnimatedStyle]} Animation
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
 * stackSwipeLeftAndTopSize?: number | string
 * stackSwipeRightAndBottomSize?: number | string
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

const swipeStartThreshold = 5;
const swipeCancelThreshold = 20;

/** @type {ScreenConfig} */
const defaultScreenConfig = {
  component: () => null,
  stackAnimation: () => ({}),
  stackAnimationDuration: 0,
};

const defaultScreenConfigRef = { current: defaultScreenConfig };

/** @type {State[]} */
const emptyStack = [];

const defaultAnimatedValue = /** @type {EnhancedAnimatedValue} */ (new Animated.Value(0));
defaultAnimatedValue.value = 0;
defaultAnimatedValue.addListener(({ value }) => {
  defaultAnimatedValue.value = value;
});

const defaultStackRef = { current: /** @type {State[]} */ ([]) };

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

/** @type {(initialValue: number) => EnhancedAnimatedValue} */
const useEnhancedAnimatedValue = (initialValue) => {
  const animatedValueRef = useRef(defaultAnimatedValue);
  const isDefault = animatedValueRef.current === defaultAnimatedValue;
  if (isDefault) {
    const animatedValue = /** @type {EnhancedAnimatedValue} */ (new Animated.Value(initialValue));
    animatedValueRef.current = animatedValue;
    animatedValue.value = initialValue;
    animatedValue.addListener(({ value }) => {
      animatedValue.value = value;
    });
  }
  return animatedValueRef.current;
};

/**
 * @type {React.FC<{
 * state: State
 * screenConfigMap: ScreenConfigMap<any>
 * encodePath: Gouter['encodePath']
 * goTo: Gouter['goTo']
 * isStale: boolean
 * isFocused: boolean
 * index: number
 * stackRef: React.MutableRefObject<State[]>
 * screenConfigRef: React.MutableRefObject<ScreenConfig>
 * animatedFocusedIndex: EnhancedAnimatedValue
 * animatedWidth: EnhancedAnimatedValue
 * animatedHeight: EnhancedAnimatedValue
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
    index,
    stackRef,
    screenConfigRef,
    animatedFocusedIndex,
    animatedWidth,
    animatedHeight,
  }) => {
    const [, updateState] = useState([]);

    const nextStack = state.stack || emptyStack;

    const nextStackRef = useRef(nextStack);
    nextStackRef.current = nextStack;

    const prevStackRef = useRef(nextStack);
    const prevStack = prevStackRef.current;

    /** @type {Animated.EndCallback} */
    const updateStack = useCallback(({ finished }) => {
      if (finished) {
        prevStackRef.current = nextStackRef.current;
        updateState([]);
      }
    }, []);

    const stack = useMemo(
      () => getJoinedStack(prevStack, nextStack, encodePath),
      [encodePath, nextStack, prevStack],
    );

    prevStackRef.current = stack;

    const thisStackRef = useRef(stack);
    thisStackRef.current = stack;

    const focusedFreshIndex = state.index !== undefined ? state.index : nextStack.length - 1;
    const focusedIndex = stack.indexOf(nextStack[focusedFreshIndex]);
    const thisAnimatedFocusedIndex = useEnhancedAnimatedValue(focusedIndex);

    const animatedIndex = useEnhancedAnimatedValue(index);

    const indexRef = useRef(index);
    const prevIndex = indexRef.current;
    indexRef.current = index;

    if (index !== prevIndex) {
      Animated.timing(animatedIndex, {
        toValue: index,
        useNativeDriver: true,
        duration: screenConfigRef.current.stackAnimationDuration,
      }).start();
    }

    const animatedValue = useMemo(
      () => Animated.subtract(animatedIndex, animatedFocusedIndex),
      [animatedFocusedIndex, animatedIndex],
    );

    const thisAnimatedBounce = useEnhancedAnimatedValue(0);
    const thisAnimatedWidth = useEnhancedAnimatedValue(0);
    const thisAnimatedHeight = useEnhancedAnimatedValue(0);
    const animatedIsFocused = useEnhancedAnimatedValue(isFocused ? 1 : 0);

    const prevIsFocusedRef = useRef(isFocused);
    if (isFocused !== prevIsFocusedRef.current) {
      animatedIsFocused.setValue(isFocused ? 1 : 0);
    }
    prevIsFocusedRef.current = isFocused;

    const animationProps = useMemo(
      () => ({
        index: animatedValue,
        width: animatedWidth,
        height: animatedHeight,
        focused: animatedIsFocused,
        bounce: thisAnimatedBounce,
      }),
      [animatedValue, animatedWidth, animatedHeight, animatedIsFocused, thisAnimatedBounce],
    );

    const { stackAnimation } = screenConfigRef.current;

    const animatedStyleOrStyles = useMemo(
      () => (stackAnimation ? stackAnimation(animationProps) : null),
      [animationProps, stackAnimation],
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

    const maybeScreenConfig = screenConfigMap[state.name];
    const thisScreenConfig =
      typeof maybeScreenConfig === 'function'
        ? maybeScreenConfig(state)
        : maybeScreenConfig || defaultScreenConfig;
    const thisScreenConfigRef = useRef(thisScreenConfig);
    thisScreenConfigRef.current = thisScreenConfig;

    if (focusedIndex !== prevFocusedIndex || focusedFreshIndex !== prevFocusedFreshIndex) {
      const duration =
        thisScreenConfig.stackAnimationDuration *
        Math.min(1, Math.abs(thisAnimatedFocusedIndex.value - focusedIndex));
      if (duration === 0) {
        thisAnimatedFocusedIndex.setValue(focusedIndex);
        updateStack({ finished: true });
      } else {
        Animated.timing(thisAnimatedFocusedIndex, {
          useNativeDriver: true,
          toValue: focusedIndex,
          duration,
        }).start(updateStack);
      }
    }

    const valueRef = useRef(0);

    const stateRef = useRef(state);
    stateRef.current = state;

    const bounceAnimation = useMemo(
      () => Animated.spring(thisAnimatedBounce, { toValue: 0, useNativeDriver: true, delay: 32 }),
      [thisAnimatedBounce],
    );

    const panResponderStartBlockedRef = useRef(false);

    /** @type {NonNullable<import('react-native').PanResponderCallbacks['onStartShouldSetPanResponder']>} */
    const onStartShouldSetPanResponder = useCallback(
      (event) => {
        event.stopPropagation();
        const { stackSwipeGesture, stackSwipeLeftAndTopSize, stackSwipeRightAndBottomSize } =
          screenConfigRef.current;
        if (!stackSwipeGesture || stackSwipeGesture === 'none') {
          return false;
        }
        const isHorizontal = stackSwipeGesture === 'horizontal';
        const side = isHorizontal ? animatedWidth.value : animatedHeight.value;
        const startValue =
          (typeof stackSwipeLeftAndTopSize === 'string'
            ? 0.01 * parseFloat(stackSwipeLeftAndTopSize) * side
            : stackSwipeLeftAndTopSize) || 0;
        const endValue =
          (typeof stackSwipeRightAndBottomSize === 'string'
            ? 0.01 * parseFloat(stackSwipeRightAndBottomSize) * side
            : stackSwipeRightAndBottomSize) || 0;
        const { locationX, locationY } = event.nativeEvent;
        const locationValue = isHorizontal ? locationX : locationY;
        const panResponderStartBlocked =
          locationValue > startValue && locationValue < side - endValue;
        panResponderStartBlockedRef.current = panResponderStartBlocked;
        return false;
      },
      [animatedHeight, animatedWidth, screenConfigRef],
    );

    /** @type {NonNullable<import('react-native').PanResponderCallbacks['onMoveShouldSetPanResponder']>} */
    const onMoveShouldSetPanResponder = useCallback(
      (event, { dx, dy }) => {
        event.stopPropagation();
        if (panResponderStartBlockedRef.current) {
          return false;
        }
        const { stackSwipeGesture } = screenConfigRef.current;
        if (!stackSwipeGesture || stackSwipeGesture === 'none') {
          return false;
        }
        const isHorizontal = stackSwipeGesture === 'horizontal';
        const shouldSet =
          event.nativeEvent.touches.length === 1 &&
          Math.abs(isHorizontal ? dx : dy) > swipeStartThreshold &&
          Math.abs(isHorizontal ? dy : dx) < swipeCancelThreshold;
        if (shouldSet) {
          valueRef.current = animatedFocusedIndex.value;
        }
        return shouldSet;
      },
      [animatedFocusedIndex, screenConfigRef],
    );

    /** @type {NonNullable<import('react-native').PanResponderCallbacks['onPanResponderMove']>} */
    const onPanResponderMove = useCallback(
      (event, { dx, dy }) => {
        event.stopPropagation();
        const isHorizontal = screenConfigRef.current.stackSwipeGesture === 'horizontal';
        const delta = isHorizontal ? dx : dy;
        const side = isHorizontal ? animatedWidth.value : animatedHeight.value;
        const offset = delta / side || 0;
        const valueRaw = valueRef.current - offset;
        const maxIndex = stackRef.current.length - 1;
        const value = valueRaw < 0 ? 0 : valueRaw > maxIndex ? maxIndex : valueRaw;
        if (value !== valueRaw) {
          valueRef.current = (valueRaw > maxIndex ? maxIndex : 0) + offset;
          const bounceRaw = thisAnimatedBounce.value + valueRaw - value;
          const bounce = Math.max(Math.min(bounceRaw, maxIndex + 1), -1);
          thisAnimatedBounce.setValue(bounce);
          bounceAnimation.start();
        }
        animatedFocusedIndex.setValue(value);
      },
      [
        animatedFocusedIndex,
        animatedHeight,
        animatedWidth,
        bounceAnimation,
        screenConfigRef,
        stackRef,
        thisAnimatedBounce,
      ],
    );

    /** @type {NonNullable<import('react-native').PanResponderCallbacks['onPanResponderRelease']>} */
    const onPanResponderReleaseOrTerminate = useCallback(
      (event, { dx, vx, dy, vy }) => {
        event.stopPropagation();
        const isHorizontal = screenConfigRef.current.stackSwipeGesture === 'horizontal';
        const delta = isHorizontal ? dx : dy;
        const velocity = isHorizontal ? vx : vy;
        const side = isHorizontal ? animatedWidth.value : animatedHeight.value;
        const offset = delta / side || 0;
        const velocityOffset = Math.max(Math.min(0.5, 0.5 * velocity), -0.5);
        const valueRaw = valueRef.current - offset - velocityOffset;
        const maxIndex = stackRef.current.length - 1;
        const value = valueRaw < 0 ? 0 : valueRaw > maxIndex ? maxIndex : valueRaw;
        const nextPossibleIndex = Math.round(value);
        const nextState = stackRef.current[nextPossibleIndex] || stateRef.current;
        const nextIndex = nextState === stateRef.current ? indexRef.current : nextPossibleIndex;
        const diff = Math.abs(nextIndex - value);
        const duration = Math.max(100, 500 * diff);
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
      [animatedFocusedIndex, goTo, animatedWidth, animatedHeight, stackRef, screenConfigRef],
    );

    const panHandlers = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder,
          onMoveShouldSetPanResponder,
          onPanResponderMove,
          onPanResponderRelease: onPanResponderReleaseOrTerminate,
          onPanResponderTerminate: onPanResponderReleaseOrTerminate,
          onPanResponderTerminationRequest: () => false,
        }).panHandlers,
      [
        onMoveShouldSetPanResponder,
        onPanResponderMove,
        onPanResponderReleaseOrTerminate,
        onStartShouldSetPanResponder,
      ],
    );

    const layoutChild = useMemo(
      () =>
        createElement(Animated.View, {
          key: '',
          style: { ...StyleSheet.absoluteFillObject, opacity: 0 },
          pointerEvents: 'none',
          onLayout: ({ nativeEvent }) => {
            const { width, height } = nativeEvent.layout;
            const shouldUpdate = thisAnimatedWidth.value === 0 && thisAnimatedHeight.value === 0;
            thisAnimatedWidth.setValue(width);
            thisAnimatedHeight.setValue(height);
            if (shouldUpdate) {
              updateState([]);
            }
          },
        }),
      [thisAnimatedWidth, thisAnimatedHeight],
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

    const hasSize = animatedWidth.value > 0 && animatedHeight.value > 0;

    const Screen = thisScreenConfig.component;

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
            animatedWidth: thisAnimatedWidth,
            animatedHeight: thisAnimatedHeight,
            screenConfigRef: thisScreenConfigRef,
          }),
        ),
      [
        encodePath,
        focusedIndex,
        goTo,
        nextStack,
        screenConfigMap,
        stack,
        thisAnimatedFocusedIndex,
        thisAnimatedHeight,
        thisAnimatedWidth,
        thisScreenConfigRef,
      ],
    );

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
              animationProps,
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
    index: 0,
    stackRef: defaultStackRef,
    screenConfigRef: defaultScreenConfigRef,
    animatedFocusedIndex: useEnhancedAnimatedValue(0),
    animatedWidth: useEnhancedAnimatedValue(Dimensions.get('window').width),
    animatedHeight: useEnhancedAnimatedValue(Dimensions.get('window').height),
    ...props,
  }),
);

export default GouterNative;
