import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  createElement,
  useEffect,
  Fragment,
  useContext,
  createContext,
} from 'react';
import { PanResponder, Animated, StyleSheet, Dimensions } from 'react-native';

/** @ignore @typedef {import('../state').GouterState} GouterState */
/** @ignore @typedef {import('../state').GouterConfig} GouterConfig */
/** @ignore @typedef {import('react-native').ViewStyle} ViewStyle */

let reanimatedLib;
try {
  // eslint-disable-next-line global-require
  reanimatedLib = require('react-native-reanimated');
} catch (e) {
  const throwReanimatedError = () => {
    const reanimatedLink = 'https://docs.swmansion.com/react-native-reanimated/';
    throw Error(`install ${reanimatedLink} to use 'reanimated' prop of GouterNative`);
  };
  reanimatedLib = new Proxy(/** @type {import('react-native-reanimated')} */ ({}), {
    get: (_, p) =>
      p === 'useAnimatedStyle' || p === 'useAnimatedReaction' ? () => null : throwReanimatedError,
  });
}
const { makeMutable, withTiming, useAnimatedStyle, runOnJS, useAnimatedReaction } = reanimatedLib;
const Reanimated = reanimatedLib.default;

/** @type {StyleUpdater} */
const emptyStyleUpdater = () => {
  'worklet';

  return {};
};

/** @type {WeakMap<Animated.Value | NumericSharedValue, number>} */
const valueByNode = new WeakMap();

/**
 * Get current value of animated node
 * @param {Animated.Value | NumericSharedValue} node
 * @returns {number}
 */
const getValue = (node) => valueByNode.get(node) || 0;

/** @type {WeakMap<Animated.Value | NumericSharedValue, number>} */
const nextValueByNode = new WeakMap();

/**
 * Get next value of animated node after animation
 * @param {Animated.Value | NumericSharedValue} node
 * @returns {number}
 */
const getNextValue = (node) => nextValueByNode.get(node) || 0;

/** @type {Set<Animated.Value | NumericSharedValue>} */
const activeValues = new Set();

/** @type {Set<React.Dispatch<React.SetStateAction<never[]>>>} */
const stateUpdaters = new Set();

/** @type {WeakMap<Animated.Value | NumericSharedValue, (...args: any[]) => void>} */
const timingCallbackByNode = new WeakMap();

/**
 * Finishes timing animation.
 * @param {Animated.Value | NumericSharedValue} node
 * @param {number} toValue
 * @param {(() => void) | undefined} onFinish
 */
const finishTiming = (node, toValue, onFinish) => {
  timingCallbackByNode.delete(node);
  activeValues.delete(node);
  valueByNode.set(node, toValue);
  nextValueByNode.set(node, toValue);
  if (!activeValues.size && stateUpdaters.size) {
    for (const stateUpdater of stateUpdaters) {
      stateUpdater([]);
    }
    stateUpdaters.clear();
  }
  if (onFinish) {
    onFinish();
  }
};

/**
 * Starts timing animation or immediately updates animated value at zero duration.
 * @param {Animated.Value | NumericSharedValue} node
 * @param {number} toValue
 * @param {number} duration
 * @param {import('react-native').EasingFunction} [easing]
 * @param {() => void} [onFinish]
 * @returns {void}
 */
const startTiming = (node, toValue, duration, easing, onFinish) => {
  if (duration) {
    activeValues.add(node);
    nextValueByNode.set(node, toValue);
    /** @type {Animated.EndCallback} */
    const callback = ({ finished }) => {
      if (finished && timingCallbackByNode.get(node) === callback) {
        finishTiming(node, toValue, onFinish);
      }
    };
    timingCallbackByNode.set(node, callback);
    if ('setValue' in node) {
      Animated.timing(node, { toValue, duration, easing, useNativeDriver: true }).start(callback);
    } else {
      // eslint-disable-next-line no-param-reassign
      node.value = withTiming(
        toValue,
        easing ? { duration, easing } : { duration },
        (finished = true) => runOnJS(callback)({ finished }),
      );
    }
  } else {
    if ('setValue' in node) {
      node.setValue(toValue);
    } else {
      // eslint-disable-next-line no-param-reassign
      node.value = toValue;
    }
    finishTiming(node, toValue, onFinish);
  }
};

/**
 * @template {GouterConfig} T
 * @template {keyof T} N
 * @typedef {{
 * state: import('../state').GouterState<T, N>
 * children: React.ReactNode
 * }} ScreenProps
 */

/** @typedef {Animated.WithAnimatedObject<ViewStyle>} AnimatedStyle */

/** @typedef {(animatedValues: AnimatedValues) => AnimatedStyle | [AnimatedStyle, AnimatedStyle]} Animation */

/** @typedef {() => ViewStyle} StyleUpdater */

/** @typedef {(reanimatedValues: ReanimatedValues) => StyleUpdater | [StyleUpdater, StyleUpdater]} Reanimation */

/**
 * @typedef {'none' | 'top-edge' | 'right-edge' | 'bottom-edge' | 'left-edge' | 'horizontal-edge' |
 * 'vertical-edge' | 'horizontal-full' | 'vertical-full'} SwipeDetection
 */

/**
 * @typedef {Object} ScreenOptions
 * @prop {Animation} [animation]
 * @prop {Reanimation} [reanimation]
 * @prop {number} [animationDuration]
 * @prop {(value: number) => number} [animationEasing]
 * @prop {boolean} [prevScreenFixed]
 * @prop {SwipeDetection} [swipeDetection]
 */

/**
 * @template S
 * @template {GouterConfig} T
 * @template {keyof T} N
 * @typedef {(state: import('../state').GouterState<T, N>) => S} Computable
 */

/**
 * @template {GouterConfig} T
 * @template {keyof T} N
 * @typedef {{
 * component: React.ComponentType<ScreenProps<T, N>>
 * screenOptions?: ScreenOptions | Computable<ScreenOptions, T, N>
 * stackOptions?: ScreenOptions | Computable<ScreenOptions, T, N>
 * }} ScreenConfig
 */

/**
 * @template {GouterConfig} T
 * @typedef {{[N in keyof T]: ScreenConfig<T, N>}} ScreenConfigs
 */

/**
 * @template {GouterConfig} T
 * @template {keyof T} N
 * @typedef {React.FC<ScreenProps<T, N>>} GouterScreen
 */

/**
 * @typedef {Object} AnimatedValues
 * @prop {Animated.Value} width
 * @prop {Animated.Value} height
 * @prop {Animated.Value} index
 */

/** @typedef {import('react-native-reanimated').SharedValue<number>} NumericSharedValue */

/**
 * @typedef {Object} ReanimatedValues
 * @prop {NumericSharedValue} width
 * @prop {NumericSharedValue} height
 * @prop {NumericSharedValue} index
 */

/** @typedef {WeakMap<GouterState, AnimatedValues>} animatedValues */

/** @type {SwipeDetection[]} */
const unidirectionalSwipes = ['left-edge', 'top-edge', 'right-edge', 'bottom-edge'];

/** @type {SwipeDetection[]} */
const horizontalSwipes = ['left-edge', 'right-edge', 'horizontal-edge', 'horizontal-full'];

const swipeEdgeSize = 20;
const swipeStartThreshold = 5;
const swipeCancelThreshold = 20;
const velocityMultiplier = 100;

/** @type {GouterState[]} */
const emptyStack = [];

let panRespondersBlocked = false;

const initialIndex = 1;

/** @type {WeakMap<GouterState, AnimatedValues>} */
const animatedValuesByState = new WeakMap();

/**
 * Get animated values: index, width, height.
 * @type {(state: GouterState) => AnimatedValues}
 */
export const getAnimatedValues = (state) => {
  const prevAnimatedValues = animatedValuesByState.get(state);
  if (prevAnimatedValues) {
    return prevAnimatedValues;
  }
  const index = new Animated.Value(initialIndex);
  valueByNode.set(index, initialIndex);
  nextValueByNode.set(index, initialIndex);
  const { width, height } = Dimensions.get('window');
  /** @type {AnimatedValues} */
  const animatedValues = {
    index,
    width: new Animated.Value(width),
    height: new Animated.Value(height),
  };
  animatedValuesByState.set(state, animatedValues);
  return animatedValues;
};

/** @type {WeakMap<GouterState, ReanimatedValues>} */
const reanimatedValuesByState = new WeakMap();

/**
 * Get reanimated values: index, width, height.
 * @type {(state: GouterState) => ReanimatedValues}
 */
export const getReanimatedValues = (state) => {
  const prevReanimatedValues = reanimatedValuesByState.get(state);
  if (prevReanimatedValues) {
    return prevReanimatedValues;
  }
  const index = makeMutable(initialIndex);
  valueByNode.set(index, initialIndex);
  nextValueByNode.set(index, initialIndex);
  const { width, height } = Dimensions.get('window');
  /** @type {ReanimatedValues} */
  const reanimatedValues = {
    index,
    width: makeMutable(width),
    height: makeMutable(height),
  };
  reanimatedValuesByState.set(state, reanimatedValues);
  return reanimatedValues;
};

/** @type {WeakMap<GouterState, GouterState>} */
const prevParentsMap = new WeakMap();

/** @type {WeakMap<GouterState, Record<string, any>>} */
const prevParamsMap = new WeakMap();

/** @type {WeakMap<GouterState, ScreenOptions>} */
const screenOptionsMap = new WeakMap();

/** @type {WeakMap<GouterState, ScreenOptions>} */
const stackOptionsMap = new WeakMap();

/** @type {WeakMap<GouterState, ScreenOptions>} */
const defaultOptionsMap = new WeakMap();

/** @type {WeakMap<GouterState, ScreenOptions>} */
const screenOptionsProxyMap = new WeakMap();

const screenOptionsProxyHandler = {
  /** @type {<Key extends keyof ScreenOptions>(state: GouterState, key: Key) => ScreenOptions[Key] | undefined} */
  get(state, key) {
    for (const map of [screenOptionsMap, stackOptionsMap, defaultOptionsMap]) {
      const options = map.get(map === stackOptionsMap ? prevParentsMap.get(state) || state : state);
      if (options && key in options) {
        return options[key];
      }
    }
    return undefined;
  },
};

/**
 * Get state options proxy for current state based on screenConfigs and defaultOptions.
 * @param {GouterState} state
 * @param {ScreenConfigs<any>} screenConfigs
 * @param {ScreenOptions} defaultOptions
 * @returns {ScreenOptions}
 */
const getScreenOptions = (state, screenConfigs, defaultOptions) => {
  defaultOptionsMap.set(state, defaultOptions);

  const parentState = state.parent || prevParentsMap.get(state);
  if (parentState) {
    prevParentsMap.set(state, parentState);
  }

  const prevParams = prevParamsMap.get(state);
  if (prevParams !== state.params) {
    const screenConfig = screenConfigs[state.name];
    if (screenConfig) {
      const { screenOptions, stackOptions } = screenConfig;
      if (screenOptions) {
        const newScreenOptions =
          typeof screenOptions === 'function' ? screenOptions(state) : screenOptions;
        screenOptionsMap.set(state, newScreenOptions);
      }
      if (stackOptions) {
        const newStackOptions =
          typeof stackOptions === 'function' ? stackOptions(state) : stackOptions;
        stackOptionsMap.set(state, newStackOptions);
      }
    }
    prevParamsMap.set(state, state.params);
  }

  const prevScreenOptions = screenOptionsProxyMap.get(state);
  if (prevScreenOptions) {
    return prevScreenOptions;
  }

  const screenOptions = new Proxy(
    /** @type {ScreenOptions} */ (state),
    /** @type {any} */ (screenOptionsProxyHandler),
  );
  screenOptionsProxyMap.set(state, screenOptions);

  return screenOptions;
};

/** @type {<T>(list: T[], item: T) => T[]} */
const getListWithoutItem = (list, item) => {
  const index = list.indexOf(item);
  if (index === -1) {
    return list;
  }
  const nextList = list.slice();
  nextList.splice(index, 1);
  return nextList;
};

/** @type {number} */
let stateKeyCounter = -1;

/** @type {WeakMap<GouterState, number>} */
const keyByState = new WeakMap();

/** @type {(state: GouterState) => number} */
const getStateKey = (state) => {
  const prevKey = keyByState.get(state);
  if (prevKey !== undefined) {
    return prevKey;
  }
  stateKeyCounter += 1;
  keyByState.set(state, stateKeyCounter);
  return stateKeyCounter;
};

/**
 * React context to access current gouter state from nearest provider.
 */
const gouterStateContext = createContext(/** @type {GouterState | null} */ (null));

/**
 * Returns current gouter state from nearest provider or null otherwise.
 * @returns {GouterState | null}
 */
export const useGouterState = () => useContext(gouterStateContext);

/**
 * Base hook to listen for parent state changes.
 * @param {(state: GouterState | null) => boolean} predicate
 * @param {(isTrue: boolean) => void} [listener]
 * @param {(state: GouterState) => GouterState | undefined} [getParentState]
 * @returns {boolean}
 */
const useParentState = (predicate, listener, getParentState) => {
  const state = useContext(gouterStateContext);
  const isTrue = predicate(state);
  const [, updateState] = useState(isTrue);
  const isTrueRef = useRef(isTrue);
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  const predicateRef = useRef(predicate);
  predicateRef.current = predicate;
  const parent = state ? (getParentState ? getParentState(state) : state.parent) : undefined;
  useEffect(() => {
    if (!state || !parent) {
      return undefined;
    }
    return parent.listen(() => {
      const nextIsTrue = predicateRef.current(state);
      if (isTrueRef.current !== nextIsTrue) {
        isTrueRef.current = nextIsTrue;
        (listenerRef.current || updateState)(nextIsTrue);
      }
    });
  }, [parent, state]);
  return isTrue;
};

/**
 * Returns true if gouter state from nearest provider is focused in parent stack.
 * @param {(isFocused: boolean) => void} [listener]
 * @returns {boolean}
 */
export const useIsFocused = (listener) =>
  useParentState((state) => !!state && state.isFocused, listener);

/**
 * Returns true if gouter state from nearest provider was removed from parent stack.
 * @param {(isStale: boolean) => void} [listener]
 * @returns {boolean}
 */
export const useIsStale = (listener) =>
  useParentState((state) => !state || !state.parent, listener);

/**
 * Get current root state if any
 * @param {GouterState} state
 * @returns {GouterState | undefined}
 */
const getRootState = (state) => {
  let parent = state;
  while (parent.parent) {
    parent = parent.parent;
  }
  return parent.isFocused ? parent : undefined;
};

/**
 * Returns true if gouter state from nearest provider and it's parents are focused till root state.
 * @param {(isFocused: boolean) => void} [listener]
 * @returns {boolean}
 */
export const useIsRootFocused = (listener) =>
  useParentState(
    (state) => !!state && (getRootState(state) || { isFocused: false }).isFocused,
    listener,
    getRootState,
  );

/**
 * Returns true if gouter state from nearest provider or it's parents were removed from root state.
 * @param {(isStale: boolean) => void} [listener]
 * @returns {boolean}
 */
export const useIsRootStale = (listener) =>
  useParentState((state) => !state || !getRootState(state), listener, getRootState);

/**
 * Detects if gestures are blocked for next and prev states.
 * @param {GouterState} state
 * @param {ScreenOptions} screenOptions
 * @param {import('..').Routes<any>} routes
 * @returns {{prev: boolean, next: boolean}}
 */
const getBlocked = (state, screenOptions, routes) => {
  const route = routes[state.name] || {};
  const { parent } = state;
  if (route.blocker && parent) {
    const fromStateIndex = parent.stack.indexOf(state);
    const prevState = parent.stack[fromStateIndex - 1];
    const nextState = parent.stack[fromStateIndex + 1];
    const { swipeDetection = 'none' } = screenOptions;
    const isUnidirectional = unidirectionalSwipes.indexOf(swipeDetection) >= 0;
    return {
      prev: !prevState || route.blocker(state, isUnidirectional ? null : prevState),
      next: !nextState || route.blocker(state, isUnidirectional ? null : nextState),
    };
  }
  return { prev: false, next: false };
};

/**
 *
 * @param {{
 * state: GouterState,
 * screenOptions: ScreenOptions,
 * aniValues: AnimatedValues | ReanimatedValues,
 * getAniValues: ((state: GouterState) => AnimatedValues) | ((state: GouterState) => ReanimatedValues),
 * routes: import('..').Routes<any>}} props
 * @returns {import('react-native').GestureResponderHandlers}
 */
const usePanHandlers = (props) => {
  const ref = useRef(props);
  ref.current = props;

  const valueRef = useRef(0);

  const blockedRef = useRef({ prev: false, next: false });

  /** @type {NonNullable<import('react-native').PanResponderCallbacks['onMoveShouldSetPanResponder']>} */
  const onMoveShouldSetPanResponder = useCallback((event, { dx, dy, moveX, moveY }) => {
    const { aniValues, state, screenOptions, routes } = ref.current;

    if (!state.isFocused || state.stack.length) {
      return false;
    }
    let parentState = state;
    while (parentState.parent) {
      parentState = parentState.parent;
      if (!parentState.isFocused) {
        return false;
      }
    }
    const { swipeDetection = 'none' } = screenOptions;
    if (swipeDetection === 'none') {
      return false;
    }
    const isHorizontal = horizontalSwipes.indexOf(swipeDetection) >= 0;
    const locationValue = isHorizontal ? moveX : moveY;
    const side = getValue(isHorizontal ? aniValues.width : aniValues.height);
    if (locationValue < 0 || locationValue > side) {
      return false;
    }
    if (swipeDetection === 'horizontal-edge' || swipeDetection === 'vertical-edge') {
      if (locationValue > swipeEdgeSize && locationValue < side - swipeEdgeSize) {
        return false;
      }
    } else if (swipeDetection === 'left-edge' || swipeDetection === 'top-edge') {
      if (locationValue > swipeEdgeSize) {
        return false;
      }
    } else if (swipeDetection === 'right-edge' || swipeDetection === 'bottom-edge') {
      if (locationValue < side - swipeEdgeSize) {
        return false;
      }
    }
    const shouldSet =
      event.nativeEvent.touches.length === 1 &&
      Math.abs(isHorizontal ? dx : dy) >= swipeStartThreshold &&
      Math.abs(isHorizontal ? dy : dx) <= swipeCancelThreshold;
    if (shouldSet) {
      panRespondersBlocked = true;
      event.stopPropagation();
      valueRef.current = getValue(aniValues.index);
      blockedRef.current = getBlocked(state, screenOptions, routes);
      if (blockedRef.current.next && blockedRef.current.prev) {
        return false;
      }
    }
    return shouldSet;
  }, []);

  /** @type {NonNullable<import('react-native').PanResponderCallbacks['onPanResponderMove']>} */
  const onPanResponderMove = useCallback((event, { dx, dy }) => {
    const { aniValues, state, screenOptions, getAniValues } = ref.current;
    const { parent } = state;
    if (!parent) {
      return;
    }

    event.stopPropagation();
    const { swipeDetection = 'none', prevScreenFixed } = screenOptions;
    const isHorizontal = horizontalSwipes.indexOf(swipeDetection) >= 0;
    const delta = isHorizontal ? dx : dy;
    const side = getValue(isHorizontal ? aniValues.width : aniValues.height);
    const offset = delta / side || 0;
    const value = valueRef.current + offset;
    const indexOffset = value > 0 ? 1 : value < 0 ? -1 : 0;
    const nextIndex = parent.focusedIndex - indexOffset;
    const nextState = parent.stack[nextIndex];
    if (nextState && nextState !== state && !prevScreenFixed) {
      const nextAnimatedValues = getAniValues(nextState);
      if (nextAnimatedValues) {
        startTiming(nextAnimatedValues.index, value - indexOffset, 0);
      }
    }
    startTiming(aniValues.index, value, 0);
  }, []);

  /** @type {NonNullable<import('react-native').PanResponderCallbacks['onPanResponderRelease']>} */
  const onPanResponderReleaseOrTerminate = useCallback((event, { dx, vx, dy, vy }) => {
    panRespondersBlocked = false;
    const { aniValues, state, screenOptions, getAniValues } = ref.current;
    const { parent, isFocused } = state;
    if (!(parent && isFocused)) {
      return;
    }

    event.stopPropagation();
    const { swipeDetection = 'none', animationEasing, prevScreenFixed = false } = screenOptions;
    const isHorizontal = horizontalSwipes.indexOf(swipeDetection) >= 0;
    const delta = isHorizontal ? dx : dy;
    const velocity = isHorizontal ? vx : vy;
    const side = getValue(isHorizontal ? aniValues.width : aniValues.height);
    const offset = delta / side || 0;
    const velocityOffset = velocityMultiplier * (velocity / side || 0);
    const rawValue = valueRef.current + offset;
    const value = rawValue + velocityOffset;

    const indexOffset = value > 0 ? 1 : value < 0 ? -1 : 0;
    const nextIndex = parent.focusedIndex - indexOffset;
    const nextState = parent.stack[nextIndex];
    const hasNextState = !!nextState && state !== nextState;
    const shouldGoToNextState = hasNextState && Math.abs(value) >= 0.5;

    const animationDuration = 300;

    const duration = Math.max(
      32,
      shouldGoToNextState
        ? animationDuration * (1 - Math.min(Math.abs(value), 1))
        : animationDuration * Math.abs(rawValue),
    );

    startTiming(
      aniValues.index,
      shouldGoToNextState ? indexOffset : 0,
      duration,
      animationEasing,
      shouldGoToNextState && prevScreenFixed
        ? () => {
            nextState.focus();
            if (unidirectionalSwipes.indexOf(swipeDetection) >= 0) {
              parent.setStack(getListWithoutItem(parent.stack, state));
            }
          }
        : undefined,
    );

    if (!hasNextState || prevScreenFixed) {
      return;
    }

    const nextAnimatedValues = getAniValues(nextState);
    if (nextAnimatedValues) {
      startTiming(
        nextAnimatedValues.index,
        shouldGoToNextState ? 0 : -indexOffset,
        duration,
        animationEasing,
        shouldGoToNextState
          ? () => {
              nextState.focus();
              if (unidirectionalSwipes.indexOf(swipeDetection) >= 0) {
                parent.setStack(getListWithoutItem(parent.stack, state));
              }
            }
          : undefined,
      );
    }
  }, []);

  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder,
        onPanResponderMove,
        onPanResponderRelease: onPanResponderReleaseOrTerminate,
        onPanResponderTerminate: onPanResponderReleaseOrTerminate,
        onPanResponderTerminationRequest: () => false,
        onMoveShouldSetPanResponderCapture: () => panRespondersBlocked,
      }).panHandlers,
    [onMoveShouldSetPanResponder, onPanResponderMove, onPanResponderReleaseOrTerminate],
  );

  return panHandlers;
};

/**
 * @ignore
 * @typedef {Object} AnimatableComponentProps
 * @prop {Animation | undefined} animation
 * @prop {Reanimation | undefined} reanimation
 * @prop {GouterState} state
 * @prop {import('react-native').GestureResponderHandlers} panHandlers
 * @prop {React.FunctionComponentElement<any>} screenChildren
 */

/** @type {React.FC<AnimatableComponentProps>} */
const AnimatedComponent = ({ animation, state, panHandlers, screenChildren }) => {
  const values = getAnimatedValues(state);

  const styles = useMemo(() => (animation ? animation(values) : null), [values, animation]);

  const [backdropStyle, screenStyle] = Array.isArray(styles) ? styles : [null, styles];

  const { index } = values;

  useEffect(() => {
    const listenerId = index.addListener(({ value }) => valueByNode.set(index, value));
    return () => index.removeListener(listenerId);
  }, [index]);

  return createElement(Fragment, {
    children: [
      createElement(Animated.View, {
        key: 'backdrop',
        style: useMemo(() => [StyleSheet.absoluteFill, backdropStyle], [backdropStyle]),
        pointerEvents: 'none',
        onLayout: ({ nativeEvent }) => {
          const { width, height } = nativeEvent.layout;
          startTiming(values.width, width, 0);
          startTiming(values.height, height, 0);
        },
      }),
      createElement(Animated.View, {
        key: 'screen',
        ...panHandlers,
        style: useMemo(() => [StyleSheet.absoluteFill, screenStyle], [screenStyle]),
        children: screenChildren,
      }),
    ],
  });
};

/** @type {React.FC<AnimatableComponentProps>} */
const ReanimatedComponent = ({ reanimation, state, panHandlers, screenChildren }) => {
  const values = getReanimatedValues(state);

  const updaters = useMemo(() => (reanimation ? reanimation(values) : null), [values, reanimation]);

  const [backdropUpdater, screenUpdater] = Array.isArray(updaters) ? updaters : [null, updaters];

  const dependencies = useMemo(() => Object.values(values), [values]);

  const backdropStyle = useAnimatedStyle(backdropUpdater || emptyStyleUpdater, dependencies);

  const screenStyle = useAnimatedStyle(screenUpdater || emptyStyleUpdater, dependencies);

  const { index } = values;

  /** @type {(value: number) => void} */
  const setValue = useCallback((value) => valueByNode.set(index, value), [index]);

  useAnimatedReaction(
    () => index.value,
    (value) => runOnJS(setValue)(value),
    dependencies,
  );

  return createElement(Fragment, {
    children: [
      createElement(Reanimated.View, {
        key: 'backdrop',
        style: useMemo(() => [StyleSheet.absoluteFill, backdropStyle], [backdropStyle]),
        pointerEvents: 'none',
        onLayout: ({ nativeEvent }) => {
          const { width, height } = nativeEvent.layout;
          startTiming(values.width, width, 0);
          startTiming(values.height, height, 0);
        },
      }),
      createElement(Reanimated.View, {
        key: 'screen',
        ...panHandlers,
        style: useMemo(() => [StyleSheet.absoluteFill, screenStyle], [screenStyle]),
        children: screenChildren,
      }),
    ],
  });
};

/**
 * @typedef {Object} GouterNativeProps
 * @prop {GouterState} state Root state to start render from.
 * @prop {import('..').Routes<any>} routes Navigation between screens.
 * @prop {ScreenConfigs<any>} screenConfigs Animation and gestures for each screen.
 * @prop {ScreenOptions} defaultOptions Will be used for this state and it's inner states at any
 * depth when `screenOptions` and `stackOptions` of target state has no defined field.
 * @prop {boolean | undefined} [reanimated] If true then `react-native-reanimated` module will be
 * used for every animation. In this case the `reanimation` field of screen options should be used
 * instead of `animation` and `getReanimatedValues` function should be used instead of
 * `getAnimatedValues`. Every `reanimation` and `animationEasing` should have `worklet` directive:
 * https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/glossary#worklet.
 */

/**
 * Main component to render screens and handle gestures.
 * @type {React.FC<GouterNativeProps>}
 */
export const GouterNative = memo((props) => {
  const { state, routes, screenConfigs, defaultOptions, reanimated } = props;

  const [, updateState] = useState([]);

  useEffect(() => {
    const unlisten = state.listen(() => updateState([]));
    return () => {
      stateUpdaters.delete(updateState);
      unlisten();
    };
  }, [state]);

  const nextStack = state.stack;

  const prevStackRef = useRef(emptyStack);

  const getAniValues = reanimated ? getReanimatedValues : getAnimatedValues;

  stateUpdaters.delete(updateState);

  let hasScheduledUpdate = false;

  for (const stackState of prevStackRef.current) {
    if (!stackState.parent) {
      const { index } = getAniValues(stackState);
      if (Math.abs(getNextValue(index)) === 1 && !activeValues.has(index)) {
        prevStackRef.current = getListWithoutItem(prevStackRef.current, stackState);
      } else {
        hasScheduledUpdate = true;
      }
    }
  }

  const prevStack = prevStackRef.current;

  const joinedStack = useMemo(() => {
    if (prevStack === nextStack || !prevStack.length) {
      return nextStack;
    }
    if (!nextStack.length) {
      return prevStack;
    }
    const filteredPrevStack = prevStack.filter((stackState) => !nextStack.includes(stackState));
    return filteredPrevStack.length ? [...nextStack, ...filteredPrevStack] : nextStack;
  }, [nextStack, prevStack]);

  prevStackRef.current = joinedStack;

  const { focusedChild } = state;

  const blurredChildRef = useRef(/** @type {GouterState | undefined} */ (undefined));
  const blurredChild = blurredChildRef.current;
  blurredChildRef.current = focusedChild;

  const blurredIndex = blurredChild ? joinedStack.indexOf(blurredChild) : -1;
  const focusedIndex = focusedChild ? joinedStack.indexOf(focusedChild) : -1;

  const keyByStateRef = useRef(keyByState);
  const isHotReload = keyByState !== keyByStateRef.current;
  const reanimatedRef = useRef(reanimated);
  const isAnimationReload = reanimated !== reanimatedRef.current;
  if (prevStack === emptyStack || isHotReload || isAnimationReload) {
    keyByStateRef.current = keyByState;
    reanimatedRef.current = reanimated;
    if (!state.parent) {
      startTiming(getAniValues(state).index, 0, 0);
    }
    if (focusedChild) {
      startTiming(getAniValues(focusedChild).index, 0, 0);
    }
  }

  if (focusedChild) {
    const { index } = getAniValues(focusedChild);
    const nextIndexValue = getNextValue(index);
    if (nextIndexValue !== 0) {
      if (!activeValues.has(index) && Math.abs(nextIndexValue) === 1) {
        const toValue = blurredIndex > focusedIndex ? -1 : 1;
        startTiming(index, toValue, 0);
      }
      const options = getScreenOptions(focusedChild, screenConfigs, defaultOptions);
      const { animationDuration, animationEasing } = options;
      startTiming(index, 0, animationDuration || 0, animationEasing);
    }
  }

  if (blurredChild && blurredChild !== focusedChild) {
    const { index } = getAniValues(blurredChild);
    const nextIndexValue = getNextValue(index);
    if (Math.abs(nextIndexValue) !== 1) {
      const prevScreenFixed =
        focusedChild &&
        blurredChild.parent &&
        getScreenOptions(focusedChild, screenConfigs, defaultOptions).prevScreenFixed;
      if (!prevScreenFixed) {
        const toValue = blurredIndex > focusedIndex ? 1 : -1;
        const options = getScreenOptions(blurredChild, screenConfigs, defaultOptions);
        const { animationDuration, animationEasing } = options;
        startTiming(index, toValue, animationDuration || 0, animationEasing);
      }
    }
  }

  if (hasScheduledUpdate) {
    stateUpdaters.add(updateState);
  }

  const screenOptions = getScreenOptions(state, screenConfigs, defaultOptions);

  const aniValues = getAniValues(state);

  const panHandlers = usePanHandlers({ state, screenOptions, aniValues, getAniValues, routes });

  const componentChildren = useMemo(
    () =>
      joinedStack.map((stackState) =>
        createElement(GouterNative, {
          key: getStateKey(stackState),
          state: stackState,
          routes,
          screenConfigs,
          defaultOptions,
          reanimated,
        }),
      ),
    [defaultOptions, joinedStack, reanimated, routes, screenConfigs],
  );

  const { component } = screenConfigs[state.name] || { component: null };

  const screenChildren = createElement(gouterStateContext.Provider, {
    key: 'provider',
    value: state,
    children: createElement(component, {
      key: 'component',
      state,
      children: componentChildren,
    }),
  });

  return createElement(reanimated ? ReanimatedComponent : AnimatedComponent, {
    state,
    animation: screenOptions.animation,
    reanimation: screenOptions.reanimation,
    panHandlers,
    screenChildren,
  });
});
