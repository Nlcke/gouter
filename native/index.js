import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  createElement,
  useEffect,
  Fragment,
} from 'react';
import { PanResponder, Animated, StyleSheet, Dimensions } from 'react-native';

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
 * @template {import('../state').GouterConfig} T
 * @template {keyof T} N
 * @typedef {{
 * state: import('../state').GouterState<T, N>
 * isFocused: boolean
 * isStale: boolean
 * animationProps: AnimationProps
 * children: React.ReactNode
 * }} ScreenProps
 */

/** @typedef {Animated.WithAnimatedValue<import('react-native').ViewStyle>} AnimatedStyle */

/** @typedef {Animated.Value & {value: number}} EnhancedAnimatedValue */

/** @typedef {(props: AnimationProps) => AnimatedStyle | [AnimatedStyle, AnimatedStyle]} Animation */

/** @typedef {'horizontal' | 'vertical' | 'top' | 'right' | 'bottom' | 'left' | 'none'} SwipeDetection */

/**
 * @typedef {{
 * animation: Animation
 * animationDuration: number
 * swipeDetection?: SwipeDetection
 * swipeDetectionSize?: number | string
 * }} StackSettings
 */

/**
 * @typedef {{
 * animation?: Animation
 * }} StateSettings
 */

/**
 * @template S
 * @template {import('../state').GouterConfig} T
 * @template {keyof T} N
 * @typedef {(state: import('../state').GouterState<T, N>) => S} Computable
 */

/**
 * @template {import('../state').GouterConfig} T
 * @template {keyof T} N
 * @typedef {{
 * component: React.ComponentType<ScreenProps<T, N>>
 * stackSettings?: StackSettings | Computable<StackSettings, T, N>
 * stateSettings?: StateSettings | Computable<StateSettings, T, N>
 * }} ScreenConfig
 */

/**
 * @template {import('../state').GouterConfig} T
 * @typedef {{[N in keyof T]: ScreenConfig<T, N>}} ScreenConfigs
 */

/**
 * @template {import('../state').GouterConfig} T
 * @template {keyof T} N
 * @typedef {React.FC<ScreenProps<T, N>>} GouterScreen
 */

/** @type {SwipeDetection[]} */
const unidirectionalSwipes = ['left', 'top', 'right', 'bottom'];

/** @type {SwipeDetection[]} */
const horizontalSwipes = ['horizontal', 'left', 'right'];

const swipeStartThreshold = 5;
const swipeCancelThreshold = 20;

/** @type {StackSettings} */
const defaultStackSettings = {
  animation: () => ({}),
  animationDuration: 0,
};

/** @type {import('../state').GouterState[]} */
const emptyStack = [];

/** @type {ScreenConfig<any, any>} */
const defaultScreenConfig = {
  component: () => null,
};

const defaultStackSettingsRef = { current: defaultStackSettings };

const defaultAnimatedValue = /** @type {EnhancedAnimatedValue} */ (new Animated.Value(0));
defaultAnimatedValue.value = 0;
defaultAnimatedValue.addListener(({ value }) => {
  defaultAnimatedValue.value = value;
});

const defaultStackRef = { current: /** @type {import('../state').GouterState[]} */ ([]) };

/** @type {Animated.AnimatedSubtraction<number>[]} */
const defaultAnimatedParentIndexes = [];

/**
 * Joins previous and next stacks together
 * @type {(
 * prevStack: import('../state').GouterState[],
 * nextStack: import('../state').GouterState[],
 * )=> import('../state').GouterState[]}
 */
const getJoinedStack = (prevStack, nextStack) => {
  if (prevStack === nextStack || prevStack.length === 0) {
    return nextStack;
  }

  const prevPaths = prevStack.map((state) => state.key);
  const nextPaths = nextStack.map((state) => state.key);

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
 * state: import('../state').GouterState
 * routes: import('..').Routes<any>
 * screenConfigs: ScreenConfigs<any>
 * isStale: boolean
 * isFocused: boolean
 * index: number
 * stackRef: React.MutableRefObject<import('../state').GouterState[]>
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
    routes,
    screenConfigs,
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

    useEffect(() => state.listen(() => updateState([])), [state]);

    const nextStack = state.stack;

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

    const stack = useMemo(() => getJoinedStack(prevStack, nextStack), [nextStack, prevStack]);

    prevStackRef.current = stack;

    const thisStackRef = useRef(stack);
    thisStackRef.current = stack;

    const focusedFreshIndex = state.focusedIndex;
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

    const thisScreenConfig = screenConfigs[state.name] || defaultScreenConfig;

    const { stackSettings, stateSettings } = thisScreenConfig;

    const thisStateSettings =
      typeof stateSettings === 'function' ? stateSettings(state) : stateSettings;

    const { animation: stackAnimation } = stackSettingsRef.current;

    const animation = (thisStateSettings && thisStateSettings.animation) || stackAnimation;

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

    const thisStackSettings =
      typeof stackSettings === 'function'
        ? stackSettings(state)
        : stackSettings || defaultStackSettings;
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

    const blockedRef = useRef({ prev: false, next: false });

    const parentStack = state.parent ? state.parent.stack : emptyStack;

    const prevParentStackRef = useRef(parentStack);
    const prevParentStack = prevParentStackRef.current;
    prevParentStackRef.current = parentStack;

    if (parentStack !== prevParentStack) {
      const route = routes[state.name] || {};
      const { parent } = state;
      if (route.blocker && parent) {
        const fromStateIndex = parent.stack.indexOf(state);
        const prevState = parent.stack[fromStateIndex - 1];
        const nextState = parent.stack[fromStateIndex + 1];
        const { swipeDetection = 'none' } = stackSettingsRef.current;
        const isUnidirectional = unidirectionalSwipes.indexOf(swipeDetection) >= 0;
        blockedRef.current.prev =
          prevState && route.blocker(state, isUnidirectional ? null : prevState);
        blockedRef.current.next =
          nextState && route.blocker(state, isUnidirectional ? null : nextState);
      }
    }

    const bounceAnimation = useMemo(
      () => Animated.spring(thisAnimatedBounce, { toValue: 0, useNativeDriver: true, delay: 32 }),
      [thisAnimatedBounce],
    );

    /** @type {NonNullable<import('react-native').PanResponderCallbacks['onMoveShouldSetPanResponder']>} */
    const onMoveShouldSetPanResponder = useCallback(
      (event, { dx, dy, moveX, moveY }) => {
        event.preventDefault();
        if (panRespondersBlocked) {
          event.stopPropagation();
          return false;
        }
        const { swipeDetection = 'none', swipeDetectionSize } = stackSettingsRef.current;
        if (swipeDetection === 'none') {
          return false;
        }
        const isHorizontal = horizontalSwipes.indexOf(swipeDetection) >= 0;
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
      [animatedFocusedIndex.value, animatedHeight, animatedWidth, stackSettingsRef],
    );

    /** @type {NonNullable<import('react-native').PanResponderCallbacks['onPanResponderMove']>} */
    const onPanResponderMove = useCallback(
      (event, { dx, dy }) => {
        event.preventDefault();
        event.stopPropagation();
        const { swipeDetection = 'none' } = stackSettingsRef.current;
        const isHorizontal = horizontalSwipes.indexOf(swipeDetection) >= 0;
        const delta = isHorizontal ? dx : dy;
        const side = isHorizontal ? animatedWidth.value : animatedHeight.value;
        const offset = delta / side || 0;
        const valueRaw = valueRef.current - offset;
        const maxIndex = stackRef.current.length - 1;
        const value = valueRaw < 0 ? 0 : valueRaw > maxIndex ? maxIndex : valueRaw;
        if (
          value !== valueRaw ||
          (valueRaw > indexRef.current && blockedRef.current.next) ||
          (valueRaw < indexRef.current && blockedRef.current.prev)
        ) {
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
      (event, { dx, vx, dy, vy }) => {
        panRespondersBlocked = false;
        event.preventDefault();
        event.stopPropagation();
        const { swipeDetection = 'none' } = stackSettingsRef.current;
        const isHorizontal = horizontalSwipes.indexOf(swipeDetection) >= 0;
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
        const nextIndex = nextState ? nextPossibleIndex : indexRef.current;
        const diff = 2 * Math.abs(nextIndex - value);
        const duration = Math.max(64, 500 * diff);
        const prevState = stateRef.current;
        Animated.timing(animatedFocusedIndex, {
          toValue: nextIndex,
          useNativeDriver: true,
          duration,
        }).start(({ finished }) => {
          if (finished) {
            const { parent } = nextState;
            if (prevState === nextState || !parent || !finished) {
              return;
            }
            nextState.focus();
            if (unidirectionalSwipes.indexOf(swipeDetection) >= 0) {
              parent.setStack(parent.stack.filter((stackState) => stackState !== prevState));
            }
          }
        });
      },
      [animatedFocusedIndex, animatedHeight, animatedWidth, stackRef, stackSettingsRef],
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

    const { component } = thisScreenConfig;

    const children = useMemo(
      () =>
        stack.map((stackState, subIndex) =>
          createElement(GouterNativeStack, {
            key: stackState.key,
            state: stackState,
            routes,
            screenConfigs,
            isStale: nextStack.indexOf(stackState) === -1,
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
        focusedIndex,
        nextStack,
        routes,
        screenConfigs,
        stack,
        thisAnimatedFocusedIndex,
        thisAnimatedHeight,
        thisAnimatedParentIndexes,
        thisAnimatedWidth,
      ],
    );

    const screen = component
      ? createElement(component, {
          key: state.key,
          state,
          isFocused,
          isStale,
          animationProps,
          children,
        })
      : null;

    const underlay = useMemo(
      () =>
        createElement(Animated.View, {
          key: 'underlay',
          style: [StyleSheet.absoluteFill, overlayStyle],
          pointerEvents: 'none',
          onLayout: ({ nativeEvent }) => {
            const { width, height } = nativeEvent.layout;
            thisAnimatedWidth.setValue(width);
            thisAnimatedHeight.setValue(height);
          },
        }),
      [thisAnimatedWidth, thisAnimatedHeight, overlayStyle],
    );

    return createElement(Fragment, {
      children: [
        underlay,
        createElement(Animated.View, {
          key: 'screen',
          ...panHandlers,
          style,
          children: [screen],
        }),
      ],
    });
  },
);

/**
 * @type {React.FC<{
 * rootState: import('../state').GouterState
 * routes: import('..').Routes<any>
 * screenConfigs: ScreenConfigs<any>
 * }>}
 */
export const GouterNative = memo(({ rootState, routes, screenConfigs }) =>
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
    state: rootState,
    routes,
    screenConfigs,
  }),
);
