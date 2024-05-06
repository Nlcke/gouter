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

let reanimatedLib;
try {
  // eslint-disable-next-line global-require
  reanimatedLib = require('react-native-reanimated');
} catch (e) {
  const throwReanimatedError = () => {
    const reanimatedLink = 'https://docs.swmansion.com/react-native-reanimated/';
    throw Error(`install ${reanimatedLink} for enabled 'reanimated' prop of GouterNative`);
  };
  reanimatedLib = new Proxy(/** @type {import('react-native-reanimated')} */ ({}), {
    get: (_, p) => (p === 'useAnimatedStyle' ? () => null : throwReanimatedError),
  });
}
const { makeMutable, withTiming, useAnimatedStyle, runOnJS, default: Reanimated } = reanimatedLib;

const emptyStyleFn = () => {
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

let animationsCount = 0;

/** @type {Set<React.Dispatch<React.SetStateAction<never[]>>>} */
const stateUpdaters = new Set();

/**
 * Starts timing animation
 * @param {Animated.Value | NumericSharedValue} node
 * @param {number} toValue
 * @param {number} duration
 * @param {import('react-native').EasingFunction} [easing]
 * @param {(finished: boolean) => void} [callback]
 * @returns {void}
 */
const startTiming = (node, toValue, duration, easing, callback) => {
  if (duration) {
    animationsCount += 1;
    nextValueByNode.set(node, toValue);
    const fromValue = valueByNode.get(node) || 0;
    const fromDate = Date.now();
    /** @type {(finished: boolean) => void} */
    const setValue = (finished) => {
      animationsCount -= 1;
      if (!animationsCount) {
        stateUpdaters.forEach((stateUpdate) => stateUpdate([]));
        stateUpdaters.clear();
      }
      if (fromValue !== valueByNode.get(node) || toValue !== nextValueByNode.get(node)) {
        return;
      }
      if (finished) {
        valueByNode.set(node, toValue);
      } else {
        const currentDuration = (Date.now() - fromDate) / duration;
        const currentRawValue = fromValue + (toValue - fromValue) * currentDuration;
        const currentValue = easing ? easing(currentRawValue) : currentRawValue;
        valueByNode.set(node, currentValue);
        nextValueByNode.set(node, toValue);
      }
    };
    if ('interpolate' in node) {
      Animated.timing(node, { toValue, duration, easing, useNativeDriver: true }).start(
        ({ finished }) => {
          setValue(finished);
          if (callback) {
            callback(finished);
          }
        },
      );
    } else {
      // eslint-disable-next-line no-param-reassign
      node.value = withTiming(
        toValue,
        easing ? { duration, easing } : { duration },
        (finished = true) => {
          runOnJS(setValue)(finished);
          if (callback) {
            runOnJS(callback)(finished);
          }
        },
      );
    }
  } else {
    if ('interpolate' in node) {
      node.setValue(toValue);
    } else {
      // eslint-disable-next-line no-param-reassign
      node.value = toValue;
    }
    valueByNode.set(node, toValue);
    nextValueByNode.set(node, toValue);
    if (callback) {
      callback(true);
    }
  }
};

/**
 * @template {import('../state').GouterConfig} T
 * @template {keyof T} N
 * @typedef {{
 * state: import('../state').GouterState<T, N>
 * children: React.ReactNode
 * }} ScreenProps
 */

/** @typedef {Animated.WithAnimatedValue<import('react-native').ViewStyle>} AnimatedStyle */

/** @typedef {(animatedValues: AnimatedValues) => AnimatedStyle | [AnimatedStyle, AnimatedStyle]} Animation */

/** @typedef {() => import('react-native').ViewStyle} ReanimatedStyle */

/** @typedef {(reanimatedValues: ReanimatedValues) => ReanimatedStyle | [ReanimatedStyle, ReanimatedStyle]} ReanimatedAnimation */

/** @typedef {'horizontal' | 'vertical' | 'top' | 'right' | 'bottom' | 'left' | 'none'} SwipeDetection */

/**
 * @typedef {{
 * animation?: Animation
 * reanimatedAnimation?: ReanimatedAnimation
 * animationDuration?: number
 * animationEasing?: (value: number) => number
 * prevScreenFixed?: boolean
 * swipeDetection?: SwipeDetection
 * swipeDetectionSize?: number | string
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
 * stackSettings?: StateSettings | Computable<StateSettings, T, N>
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
const unidirectionalSwipes = ['left', 'top', 'right', 'bottom'];

/** @type {SwipeDetection[]} */
const horizontalSwipes = ['horizontal', 'left', 'right'];

const swipeStartThreshold = 5;
const swipeCancelThreshold = 20;
const velocityMultiplier = 100;

/** @type {GouterState[]} */
const emptyStack = [];

let panRespondersBlocked = false;

/** @type {(initialValue: number) => Animated.Value} */
const newAnimatedValue = (initialValue) => {
  const animatedValue = new Animated.Value(initialValue);
  valueByNode.set(animatedValue, initialValue);
  nextValueByNode.set(animatedValue, initialValue);
  return animatedValue;
};

/** @type {WeakMap<GouterState, AnimatedValues>} */
const animatedValuesMap = new WeakMap();

/**
 * Get animated values: index, width, height.
 * @type {(state: GouterState) => AnimatedValues}
 */
export const getAnimatedValues = (state) => {
  const prevAnimatedValues = animatedValuesMap.get(state);
  if (prevAnimatedValues) {
    return prevAnimatedValues;
  }
  const { width, height } = Dimensions.get('window');
  /** @type {AnimatedValues} */
  const animatedValues = {
    width: newAnimatedValue(width),
    height: newAnimatedValue(height),
    index: newAnimatedValue(1),
  };
  animatedValuesMap.set(state, animatedValues);
  return animatedValues;
};

/** @type {(initialValue: number) => NumericSharedValue} */
const newReanimatedValue = (initialValue) => {
  const reanimatedValue = makeMutable(initialValue);
  valueByNode.set(reanimatedValue, initialValue);
  nextValueByNode.set(reanimatedValue, initialValue);
  return reanimatedValue;
};

/** @type {WeakMap<GouterState, ReanimatedValues>} */
const reanimatedValuesMap = new WeakMap();

/**
 * Get reanimated values: index, width, height.
 * @type {(state: GouterState) => ReanimatedValues}
 */
export const getReanimatedValues = (state) => {
  const prevReanimatedValues = reanimatedValuesMap.get(state);
  if (prevReanimatedValues) {
    return prevReanimatedValues;
  }
  const { width, height } = Dimensions.get('window');
  /** @type {ReanimatedValues} */
  const reanimatedValues = {
    width: newReanimatedValue(width),
    height: newReanimatedValue(height),
    index: newReanimatedValue(1),
  };
  reanimatedValuesMap.set(state, reanimatedValues);
  return reanimatedValues;
};

/** @type {WeakMap<GouterState, GouterState>} */
const prevParentsMap = new WeakMap();

/** @type {WeakMap<GouterState, Record<string, any>>} */
const prevParamsMap = new WeakMap();

/** @type {WeakMap<GouterState, StateSettings>} */
const ownSettingsMap = new WeakMap();

/** @type {WeakMap<GouterState, StateSettings>} */
const stackSettingsMap = new WeakMap();

/** @type {WeakMap<GouterState, StateSettings>} */
const defaultSettingsMap = new WeakMap();

/** @type {WeakMap<GouterState, StateSettings>} */
const stateSettingsProxyMap = new WeakMap();

const stateSettingsProxyHandler = {
  /** @type {<Key extends keyof StateSettings>(state: GouterState, key: Key) => StateSettings[Key] | undefined} */
  get(state, key) {
    for (const map of [ownSettingsMap, stackSettingsMap, defaultSettingsMap]) {
      const settings = map.get(
        map === stackSettingsMap ? prevParentsMap.get(state) || state : state,
      );
      if (settings && key in settings) {
        return settings[key];
      }
    }
    return undefined;
  },
};

/**
 * Get state settings proxy for current state based on screenConfigs and defaultSettings.
 * @param {GouterState} state
 * @param {ScreenConfigs<any>} screenConfigs
 * @param {StateSettings} defaultSettings
 * @returns {StateSettings}
 */
const getStateSettings = (state, screenConfigs, defaultSettings) => {
  defaultSettingsMap.set(state, defaultSettings);

  const parentState = state.parent || prevParentsMap.get(state);
  if (parentState) {
    prevParentsMap.set(state, parentState);
  }

  const prevParams = prevParamsMap.get(state);
  if (prevParams !== state.params) {
    const screenConfig = screenConfigs[state.name];
    if (screenConfig) {
      const { stateSettings: ownSettings, stackSettings } = screenConfig;
      if (ownSettings) {
        const newOwnSettings = typeof ownSettings === 'function' ? ownSettings(state) : ownSettings;
        ownSettingsMap.set(state, newOwnSettings);
      }
      if (stackSettings) {
        const newStackSettings =
          typeof stackSettings === 'function' ? stackSettings(state) : stackSettings;
        stackSettingsMap.set(state, newStackSettings);
      }
    }
    prevParamsMap.set(state, state.params);
  }

  const prevStateSettings = stateSettingsProxyMap.get(state);
  if (prevStateSettings) {
    return prevStateSettings;
  }

  const stateSettings = new Proxy(
    /** @type {StateSettings} */ (state),
    /** @type {any} */ (stateSettingsProxyHandler),
  );
  stateSettingsProxyMap.set(state, stateSettings);

  return stateSettings;
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

/** @type {WeakMap<WeakMap<GouterState, number>, number>} */
const stackStateKeysCounters = new WeakMap();

/** @type {(stackState: GouterState, stackStateKeys: WeakMap<GouterState, number>) => number} */
const getStackStateKey = (stackState, stackStateKeys) => {
  const stackStateKey = stackStateKeys.get(stackState);
  if (stackStateKey !== undefined) {
    return stackStateKey;
  }
  const counter = stackStateKeysCounters.get(stackStateKeys) || 0;
  stackStateKeysCounters.set(stackStateKeys, counter + 1);
  stackStateKeys.set(stackState, counter);
  return counter;
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
 * @param {StateSettings} stateSettings
 * @param {import('..').Routes<any>} routes
 * @returns {{prev: boolean, next: boolean}}
 */
const getBlocked = (state, stateSettings, routes) => {
  const route = routes[state.name] || {};
  const { parent } = state;
  if (route.blocker && parent) {
    const fromStateIndex = parent.stack.indexOf(state);
    const prevState = parent.stack[fromStateIndex - 1];
    const nextState = parent.stack[fromStateIndex + 1];
    const { swipeDetection = 'none' } = stateSettings;
    const isUnidirectional = unidirectionalSwipes.indexOf(swipeDetection) >= 0;
    return {
      prev: !prevState || route.blocker(state, isUnidirectional ? null : prevState),
      next: !nextState || route.blocker(state, isUnidirectional ? null : nextState),
    };
  }
  return { prev: false, next: false };
};

/**
 * @type {(props: { state: any, stateSettings: any, aniValues: any, getAniValues: any, routes: any })
 * => import('react-native').GestureResponderHandlers}
 */

/**
 *
 * @param {{
 * state: GouterState,
 * stateSettings: StateSettings,
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
    const { aniValues, state, stateSettings, routes } = ref.current;
    event.preventDefault();
    if (panRespondersBlocked) {
      event.stopPropagation();
      return false;
    }
    const { isFocused } = state;
    if (!isFocused) {
      return false;
    }
    const { swipeDetection = 'none', swipeDetectionSize } = stateSettings;
    if (swipeDetection === 'none') {
      return false;
    }
    const isHorizontal = horizontalSwipes.indexOf(swipeDetection) >= 0;
    const locationValue = isHorizontal ? moveX : moveY;
    const side = getValue(isHorizontal ? aniValues.width : aniValues.height);
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
      valueRef.current = getValue(aniValues.index);
      blockedRef.current = getBlocked(state, stateSettings, routes);
    }
    return shouldSet;
  }, []);

  /** @type {NonNullable<import('react-native').PanResponderCallbacks['onPanResponderMove']>} */
  const onPanResponderMove = useCallback((event, { dx, dy }) => {
    const { aniValues, state, stateSettings, getAniValues } = ref.current;
    const { parent, isFocused } = state;
    if (!(parent && isFocused)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const { swipeDetection = 'none', prevScreenFixed } = stateSettings;
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
    const { aniValues, state, stateSettings, getAniValues } = ref.current;
    const { parent, isFocused } = state;
    if (!(parent && isFocused)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const {
      swipeDetection = 'none',
      animationDuration = 0,
      animationEasing,
      prevScreenFixed = false,
    } = stateSettings;
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

    const duration = shouldGoToNextState
      ? animationDuration * (1 - Math.min(Math.abs(value), 1))
      : animationDuration * Math.abs(rawValue);

    startTiming(
      aniValues.index,
      shouldGoToNextState ? indexOffset : 0,
      duration,
      animationEasing,
      shouldGoToNextState && prevScreenFixed
        ? (finished) => {
            if (finished) {
              nextState.focus();
              if (unidirectionalSwipes.indexOf(swipeDetection) >= 0) {
                parent.setStack(getListWithoutItem(parent.stack, state));
              }
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
          ? (finished) => {
              if (finished) {
                nextState.focus();
                if (unidirectionalSwipes.indexOf(swipeDetection) >= 0) {
                  parent.setStack(getListWithoutItem(parent.stack, state));
                }
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
      }).panHandlers,
    [onMoveShouldSetPanResponder, onPanResponderMove, onPanResponderReleaseOrTerminate],
  );

  return panHandlers;
};

/**
 * @typedef {Object} GouterNativeProps
 * @prop {GouterState} state Root state to start render from.
 * @prop {import('..').Routes<any>} routes Navigation between screens.
 * @prop {ScreenConfigs<any>} screenConfigs Animation and gestures for each screen.
 * @prop {StateSettings} defaultSettings Will be used for this state and it's inner states at any
 * depth when `screenSettings` and `stackSettings` of target state has no defined field.
 * @prop {boolean | undefined} [reanimated] If true then `react-native-reanimated` module will be
 * used for every animation at `reanimatedAnimation` field.
 */

/**
 * Main component to render screens and handle gestures
 * @type {React.FC<GouterNativeProps>}
 */
export const GouterNative = memo((props) => {
  const { state, routes, screenConfigs, defaultSettings, reanimated } = props;

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

  for (const stackState of prevStackRef.current) {
    if (stackState.parent !== state) {
      const aniValues = getAniValues(stackState);
      const indexValue = getValue(aniValues.index);
      const nextIndexValue = getNextValue(aniValues.index);
      if (indexValue === nextIndexValue && Math.abs(indexValue) === 1) {
        prevStackRef.current = getListWithoutItem(prevStackRef.current, stackState);
      } else if (Math.abs(nextIndexValue) !== 1) {
        stateUpdaters.add(updateState);
        const stackStateSettings = getStateSettings(stackState, screenConfigs, defaultSettings);
        const { animationDuration, animationEasing } = stackStateSettings;
        const toValue = indexValue >= 0 ? 1 : -1;
        startTiming(aniValues.index, toValue, animationDuration || 1, animationEasing);
      }
    }
  }

  const prevStack = prevStackRef.current;

  /** @type {WeakMap<GouterState, number>} */
  const stackStateKeys = useRef(new WeakMap()).current;

  const joinedStack = useMemo(() => {
    if (prevStack === nextStack || !prevStack.length) {
      return nextStack;
    }
    if (!nextStack.length) {
      return prevStack;
    }
    const filteredPrevStack = prevStack.filter((stackState) => stackState.parent !== state);
    return filteredPrevStack.length ? [...nextStack, ...filteredPrevStack] : nextStack;
  }, [nextStack, prevStack, state]);

  prevStackRef.current = joinedStack;

  const { focusedChild } = state;

  const blurredChildRef = useRef(/** @type {GouterState | undefined} */ (undefined));
  const blurredChild = blurredChildRef.current;
  blurredChildRef.current = focusedChild;

  const blurredIndex = blurredChild ? joinedStack.indexOf(blurredChild) : -1;
  const focusedIndex = focusedChild ? joinedStack.indexOf(focusedChild) : -1;

  if (prevStack === emptyStack) {
    if (!state.parent) {
      startTiming(getAniValues(state).index, 0, 0);
    }
    if (focusedChild) {
      startTiming(getAniValues(focusedChild).index, 0, 0);
    }
  }

  if (blurredChild && blurredChild !== focusedChild && blurredChild.parent === state) {
    const aniValues = getAniValues(blurredChild);
    const nextIndexValue = getNextValue(aniValues.index);
    if (Math.abs(nextIndexValue) !== 1) {
      const prevScreenFixed =
        focusedChild &&
        getStateSettings(focusedChild, screenConfigs, defaultSettings).prevScreenFixed;
      if (!prevScreenFixed && blurredChild.parent === state) {
        const toValue = blurredIndex > focusedIndex ? 1 : -1;
        const { animationDuration, animationEasing } = getStateSettings(
          blurredChild,
          screenConfigs,
          defaultSettings,
        );
        startTiming(aniValues.index, toValue, animationDuration || 0, animationEasing);
      }
    }
  }

  if (focusedChild) {
    const aniValues = getAniValues(focusedChild);
    const nextIndexValue = getNextValue(aniValues.index);
    if (nextIndexValue !== 0) {
      const indexValue = getValue(aniValues.index);
      if (indexValue === nextIndexValue) {
        const toValue = blurredIndex > focusedIndex ? -1 : 1;
        startTiming(aniValues.index, toValue, 0);
      }
      const { animationDuration, animationEasing } = getStateSettings(
        focusedChild,
        screenConfigs,
        defaultSettings,
      );
      startTiming(aniValues.index, 0, animationDuration || 0, animationEasing);
    }
  }

  const stateSettings = getStateSettings(state, screenConfigs, defaultSettings);

  const aniValues = getAniValues(state);

  const panHandlers = usePanHandlers({ state, stateSettings, aniValues, getAniValues, routes });

  const { component } = screenConfigs[state.name] || { component: null };

  const anyAnimation = reanimated ? stateSettings.reanimatedAnimation : stateSettings.animation;

  const animatedStyleOrStyles = useMemo(
    () => (anyAnimation ? anyAnimation(/** @type {any} */ (aniValues)) : null),
    [aniValues, anyAnimation],
  );

  const [underlayStyleOrFn, screenStyleOrFn] = Array.isArray(animatedStyleOrStyles)
    ? animatedStyleOrStyles
    : [null, animatedStyleOrStyles];

  const reanimatedUnderlayStyle = useAnimatedStyle(
    typeof underlayStyleOrFn === 'function' ? underlayStyleOrFn : emptyStyleFn,
    reanimated ? Object.values(aniValues) : [],
  );

  const underlayStyle = reanimated ? reanimatedUnderlayStyle : underlayStyleOrFn;

  const reanimatedScreenStyle = useAnimatedStyle(
    typeof screenStyleOrFn === 'function' ? screenStyleOrFn : emptyStyleFn,
    reanimated ? Object.values(aniValues) : [],
  );

  const screenStyle = reanimated ? reanimatedScreenStyle : screenStyleOrFn;

  const stackChildren = useMemo(
    () =>
      joinedStack.map((stackState) =>
        createElement(GouterNative, {
          key: getStackStateKey(stackState, stackStateKeys),
          state: stackState,
          routes,
          screenConfigs,
          defaultSettings,
          reanimated,
        }),
      ),
    [defaultSettings, joinedStack, reanimated, routes, screenConfigs, stackStateKeys],
  );

  const View = reanimated ? Reanimated.View : Animated.View;

  return createElement(Fragment, {
    children: [
      createElement(/** @type {typeof Reanimated.View} */ (View), {
        key: 'underlay',
        style: useMemo(() => [StyleSheet.absoluteFill, underlayStyle], [underlayStyle]),
        pointerEvents: 'none',
        onLayout: ({ nativeEvent }) => {
          const { width, height } = nativeEvent.layout;
          startTiming(aniValues.width, width, 0);
          startTiming(aniValues.height, height, 0);
        },
      }),
      createElement(/** @type {typeof Reanimated.View} */ (View), {
        key: 'screen',
        ...panHandlers,
        style: useMemo(() => [StyleSheet.absoluteFill, screenStyle], [screenStyle]),
        children: [
          createElement(gouterStateContext.Provider, {
            key: 'provider',
            value: state,
            children: [
              createElement(component, {
                key: 'component',
                state,
                children: stackChildren,
              }),
            ],
          }),
        ],
      }),
    ],
  });
});
