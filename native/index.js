import { memo, useCallback, useMemo, useRef, useState, createElement } from 'react';
import { PanResponder, Animated, StyleSheet, Dimensions } from 'react-native';

/** @typedef {import('..').default<any>} Gouter */

/** @typedef {Gouter['rootState']} State */

/**
 * @typedef {{
 * index: Animated.AnimatedSubtraction<number>
 * width: EnhancedAnimatedValue
 * height: EnhancedAnimatedValue
 * focused: EnhancedAnimatedValue
 * bounce: EnhancedAnimatedValue
 * parentIndexes: Animated.AnimatedSubtraction<number>[]
 * }} AnimationProps
 */

/**
 * @template {State} ScreenState
 * @typedef {{
 * state: ScreenState
 * isFocused: boolean
 * isStale: boolean
 * animationProps: AnimationProps
 * scrollProps: import('react-native').ScrollViewProps
 * children: React.ReactNode
 * }} ScreenProps
 */

/** @typedef {Animated.WithAnimatedValue<import('react-native').ViewStyle>} AnimatedStyle */

/** @typedef {Animated.Value & {value: number}} EnhancedAnimatedValue */

/** @typedef {(props: AnimationProps) => AnimatedStyle | [AnimatedStyle, AnimatedStyle]} Animation */

/**
 * @typedef {{
 * animation: Animation
 * animationDuration: number
 * swipeDetection?: 'horizontal' | 'vertical' | 'top' | 'right' | 'bottom' | 'left' | 'none'
 * swipeDetectionSize?: number | string
 * }} StackSettings
 */

/**
 * @typedef {{
 * component: React.ComponentType<ScreenProps<any>>
 * stackSettings?: StackSettings
 * }} ScreenConfig
 */

/**
 * @template {State} ScreenState
 * @typedef {{[Name in ScreenState['name']]: ScreenConfig}} ScreenConfigMap
 */

/**
 * @template {State} ScreenState
 * @typedef {{[Name in ScreenState['name']]: React.FC<ScreenProps<ScreenState & {name: Name}>>}} ScreenMap
 */

const swipeStartThreshold = 5;
const swipeCancelThreshold = 20;
const minReleaseAnimationDuration = 100;
const maxReleaseAnimationDuration = 500;
const releaseVelocityMultiplier = 1;

/** @type {StackSettings} */
const defaultStackSettings = {
  animation: () => ({}),
  animationDuration: 0,
};

/** @type {ScreenConfig} */
const defaultScreenConfig = {
  component: () => null,
};

const defaultStackSettingsRef = { current: defaultStackSettings };

/** @type {State[]} */
const emptyStack = [];

const defaultAnimatedValue = /** @type {EnhancedAnimatedValue} */ (new Animated.Value(0));
defaultAnimatedValue.value = 0;
defaultAnimatedValue.addListener(({ value }) => {
  defaultAnimatedValue.value = value;
});

const defaultStackRef = { current: /** @type {State[]} */ ([]) };

/** @type {Animated.AnimatedSubtraction<number>[]} */
const defaultAnimatedParentIndexes = [];

const horizontalSwipeSet = new Set(
  /** @type {StackSettings['swipeDetection'][]} */ (['horizontal', 'left', 'right']),
);

const defaultPanHandlers = PanResponder.create({
  onMoveShouldSetPanResponder: (e) => {
    e.stopPropagation();
    return false;
  },
  onPanResponderMove: (e) => e.stopPropagation(),
  onPanResponderRelease: (e) => e.stopPropagation(),
  onPanResponderReject: (e) => e.stopPropagation(),
}).panHandlers;

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

let panRespondersBlocked = false;

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
 * stackSettingsRef: React.MutableRefObject<StackSettings>
 * animatedFocusedIndex: EnhancedAnimatedValue
 * animatedWidth: EnhancedAnimatedValue
 * animatedHeight: EnhancedAnimatedValue
 * animatedParentIndexes: Animated.AnimatedSubtraction<number>[]
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
    stackSettingsRef,
    animatedFocusedIndex,
    animatedWidth,
    animatedHeight,
    animatedParentIndexes,
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

    const animatedRawIndex = useEnhancedAnimatedValue(index);

    const indexRef = useRef(index);
    const prevIndex = indexRef.current;
    indexRef.current = index;

    if (index !== prevIndex) {
      Animated.timing(animatedRawIndex, {
        toValue: index,
        useNativeDriver: true,
        duration: stackSettingsRef.current.animationDuration,
      }).start();
    }

    /** @type {Animated.AnimatedSubtraction<number>} */
    const animatedIndex = useMemo(
      () => Animated.subtract(animatedRawIndex, animatedFocusedIndex),
      [animatedFocusedIndex, animatedRawIndex],
    );

    const thisAnimatedBounce = useEnhancedAnimatedValue(0);
    const thisAnimatedWidth = useEnhancedAnimatedValue(0);
    const thisAnimatedHeight = useEnhancedAnimatedValue(0);
    const animatedFocused = useEnhancedAnimatedValue(isFocused ? 1 : 0);

    const prevIsFocusedRef = useRef(isFocused);
    if (isFocused !== prevIsFocusedRef.current) {
      animatedFocused.setValue(isFocused ? 1 : 0);
    }
    prevIsFocusedRef.current = isFocused;

    const thisAnimatedParentIndexes = useMemo(
      () => [animatedIndex, ...animatedParentIndexes],
      [animatedIndex, animatedParentIndexes],
    );

    /** @type {AnimationProps} */
    const animationProps = useMemo(
      () => ({
        index: animatedIndex,
        width: animatedWidth,
        height: animatedHeight,
        focused: animatedFocused,
        bounce: thisAnimatedBounce,
        parentIndexes: animatedParentIndexes,
      }),
      [
        animatedIndex,
        animatedParentIndexes,
        animatedWidth,
        animatedHeight,
        animatedFocused,
        thisAnimatedBounce,
      ],
    );

    const { animation } = stackSettingsRef.current;

    const animatedStyleOrStyles = useMemo(
      () => (animation ? animation(animationProps) : null),
      [animationProps, animation],
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

    const thisScreenConfig = screenConfigMap[state.name] || defaultScreenConfig;

    const thisStackSettings = thisScreenConfig.stackSettings || defaultStackSettings;
    const thisStackSettingsRef = useRef(thisStackSettings);
    thisStackSettingsRef.current = thisStackSettings;

    if (focusedIndex !== prevFocusedIndex || focusedFreshIndex !== prevFocusedFreshIndex) {
      const duration =
        thisStackSettings.animationDuration *
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

    /** @type {NonNullable<import('react-native').PanResponderCallbacks['onMoveShouldSetPanResponder']>} */
    const onMoveShouldSetPanResponder = useCallback(
      (event, { dx, dy, moveX, moveY }) => {
        if (panRespondersBlocked) {
          event.stopPropagation();
          return false;
        }
        const { swipeDetection, swipeDetectionSize } = stackSettingsRef.current;
        if (!swipeDetection || swipeDetection === 'none') {
          return false;
        }
        const isHorizontal = horizontalSwipeSet.has(swipeDetection);
        const locationValue = isHorizontal ? moveX : moveY;
        const side = isHorizontal ? animatedWidth.value : animatedHeight.value;
        if (locationValue < 0 || locationValue > side) {
          return false;
        }
        if (swipeDetectionSize !== undefined) {
          const size =
            typeof swipeDetectionSize === 'string'
              ? 0.01 * (parseFloat(swipeDetectionSize) || 0) * side
              : swipeDetectionSize;
          if (swipeDetection === 'horizontal' || swipeDetection === 'vertical') {
            if (locationValue > size && locationValue < side - size) {
              return false;
            }
          } else if (swipeDetection === 'left' || swipeDetection === 'top') {
            if (locationValue > size) {
              return false;
            }
          } else if (locationValue < side - size) {
            return false;
          }
        }
        const shouldSet =
          event.nativeEvent.touches.length === 1 &&
          Math.abs(isHorizontal ? dx : dy) > swipeStartThreshold &&
          Math.abs(isHorizontal ? dy : dx) < swipeCancelThreshold;
        if (shouldSet) {
          panRespondersBlocked = true;
          event.stopPropagation();
          valueRef.current = animatedFocusedIndex.value;
        }
        return shouldSet;
      },
      [animatedFocusedIndex, animatedHeight, animatedWidth, stackSettingsRef],
    );

    /** @type {NonNullable<import('react-native').PanResponderCallbacks['onPanResponderMove']>} */
    const onPanResponderMove = useCallback(
      (event, { dx, dy }) => {
        event.stopPropagation();
        const { swipeDetection } = stackSettingsRef.current;
        const isHorizontal = horizontalSwipeSet.has(swipeDetection);
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
        stackSettingsRef,
        stackRef,
        thisAnimatedBounce,
      ],
    );

    /** @type {NonNullable<import('react-native').PanResponderCallbacks['onPanResponderRelease']>} */
    const onPanResponderReleaseOrTerminate = useCallback(
      (event, { dx, dy, vx, vy }) => {
        panRespondersBlocked = false;
        event.stopPropagation();
        const { swipeDetection } = stackSettingsRef.current;
        const isHorizontal = horizontalSwipeSet.has(swipeDetection);
        const delta = isHorizontal ? dx : dy;
        const velocity = isHorizontal ? vx : vy;
        const side = isHorizontal ? animatedWidth.value : animatedHeight.value;
        const offset = delta / side || 0;
        const velocityOffset = Math.max(
          Math.min(0.5, 0.5 * releaseVelocityMultiplier * velocity),
          -0.5,
        );
        const valueRaw = valueRef.current - offset - velocityOffset;
        const maxIndex = stackRef.current.length - 1;
        const value = valueRaw < 0 ? 0 : valueRaw > maxIndex ? maxIndex : valueRaw;
        const nextPossibleIndex = Math.round(value);
        const nextState = stackRef.current[nextPossibleIndex] || stateRef.current;
        const nextIndex = nextState === stateRef.current ? indexRef.current : nextPossibleIndex;
        const indexDelta = Math.abs(nextIndex - value);
        const duration = Math.max(
          minReleaseAnimationDuration,
          maxReleaseAnimationDuration * indexDelta,
        );
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
      [animatedFocusedIndex, goTo, animatedWidth, animatedHeight, stackRef, stackSettingsRef],
    );

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

    /** @type {ScreenProps<any>['scrollProps']} */
    const scrollProps = useMemo(() => {
      /** @type {(e: import('react-native').GestureResponderEvent) => number} */
      const getValue = (e) => {
        const { swipeDetection } = stackSettingsRef.current;
        const isHorizontal = horizontalSwipeSet.has(swipeDetection);
        const { pageX, pageY } = e.nativeEvent;
        return isHorizontal ? pageX : pageY;
      };

      const minPruneTime = 50;
      const maxPruneTime = 1000;

      let gestureBlocked = false;
      let initialValue = 0;
      let scrollEnabled = true;
      let listenerId = '';

      const moveQueue = /** @type {number[]} */ ([]);
      const timeQueue = /** @type {number[]} */ ([]);

      /** @type {(ms: number) => void} */
      const pruneQueue = (ms) => {
        const threshold = Date.now() - ms;
        while (timeQueue.length && timeQueue[0] < threshold) {
          moveQueue.shift();
          timeQueue.shift();
        }
      };

      return {
        ...defaultPanHandlers,
        pointerEvents: 'box-only',
        onTouchStart: (event) => {
          initialValue = getValue(event);

          moveQueue.push(0);
          timeQueue.push(Date.now());

          panRespondersBlocked = true;
          valueRef.current = animatedFocusedIndex.value;
        },
        onTouchMove: (event) => {
          const value = getValue(event);
          const delta = value - initialValue;

          pruneQueue(minPruneTime);
          moveQueue.push(delta);
          timeQueue.push(Date.now());

          if (gestureBlocked) {
            initialValue = value;
            valueRef.current = animatedFocusedIndex.value;
          } else {
            onPanResponderMove(
              event,
              /** @type {import('react-native').PanResponderGestureState} */ ({
                dx: delta,
                dy: delta,
              }),
            );
          }
        },
        onTouchEnd: (event) => {
          if (animatedFocusedIndex.value < 1 && listenerId) {
            pruneQueue(maxPruneTime);
            const value = getValue(event);
            const delta = value - initialValue;

            moveQueue.push(delta);
            timeQueue.push(Date.now());
            const m = timeQueue.length - 1;
            const dist = moveQueue[m] - moveQueue[0];
            const time = timeQueue[m] - timeQueue[0];
            const velocity = m <= 1 ? 0 : dist / time;

            moveQueue.length = 0;
            timeQueue.length = 0;

            onPanResponderReleaseOrTerminate(
              event,
              /** @type {import('react-native').PanResponderGestureState} */ ({
                dx: delta,
                dy: delta,
                vx: velocity,
                vy: velocity,
              }),
            );
          }
        },
        onScroll: (event) => {
          const { swipeDetection } = stackSettingsRef.current;
          const isHorizontal = horizontalSwipeSet.has(swipeDetection);
          const offset = isHorizontal
            ? event.nativeEvent.contentOffset.x
            : event.nativeEvent.contentOffset.y;
          gestureBlocked = offset > 0;
        },
        /** @type {(scrollView: import('react-native').ScrollView?) => void} */
        ref: (scrollView) => {
          if (listenerId) {
            animatedFocusedIndex.removeListener(listenerId);
          }
          if (!scrollView) {
            return;
          }
          listenerId = animatedFocusedIndex.addListener(({ value }) => {
            const prevScrollEnabled = scrollEnabled;
            scrollEnabled = value >= 1;
            if (prevScrollEnabled !== scrollEnabled) {
              scrollView.setNativeProps({ scrollEnabled });
            }
          });
        },
      };
    }, [
      animatedFocusedIndex,
      onPanResponderMove,
      onPanResponderReleaseOrTerminate,
      stackSettingsRef,
    ]);

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
            stackSettingsRef: thisStackSettingsRef,
            animatedParentIndexes: thisAnimatedParentIndexes,
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
        thisStackSettingsRef,
        thisAnimatedParentIndexes,
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
              scrollProps,
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
    stackSettingsRef: defaultStackSettingsRef,
    animatedFocusedIndex: useEnhancedAnimatedValue(0),
    animatedWidth: useEnhancedAnimatedValue(Dimensions.get('window').width),
    animatedHeight: useEnhancedAnimatedValue(Dimensions.get('window').height),
    animatedParentIndexes: defaultAnimatedParentIndexes,
    ...props,
  }),
);

export default GouterNative;
