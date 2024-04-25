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

/**
 * @template {import('../state').GouterConfig} T
 * @template {keyof T} N
 * @typedef {{
 * state: import('../state').GouterState<T, N>
 * animatedValues: AnimatedValues
 * children: React.ReactNode
 * }} ScreenProps
 */

/** @typedef {Animated.WithAnimatedValue<import('react-native').ViewStyle>} AnimatedStyle */

/** @typedef {Animated.Value & {value: number}} EnhancedAnimatedValue */

/** @typedef {(animatedValues: AnimatedValues) => AnimatedStyle | [AnimatedStyle, AnimatedStyle]} Animation */

/** @typedef {'horizontal' | 'vertical' | 'top' | 'right' | 'bottom' | 'left' | 'none'} SwipeDetection */

/**
 * @typedef {{
 * animation?: Animation
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
 * @prop {EnhancedAnimatedValue} width
 * @prop {EnhancedAnimatedValue} height
 * @prop {EnhancedAnimatedValue} index
 */

/** @typedef {WeakMap<import('../state').GouterState, AnimatedValues>} animatedValues */

/** @type {SwipeDetection[]} */
const unidirectionalSwipes = ['left', 'top', 'right', 'bottom'];

/** @type {SwipeDetection[]} */
const horizontalSwipes = ['horizontal', 'left', 'right'];

const swipeStartThreshold = 5;
const swipeCancelThreshold = 20;
const velocityMultiplier = 100;

/** @type {import('../state').GouterState[]} */
const emptyStack = [];

/** @type {ScreenConfig<any, any>} */
const defaultScreenConfig = {
  component: () => null,
};

/** @type {(initialValue: number) => EnhancedAnimatedValue} */
const newEnhancedAnimatedValue = (initialValue) => {
  const animatedValue = /** @type {EnhancedAnimatedValue} */ (new Animated.Value(initialValue));
  animatedValue.value = initialValue;
  animatedValue.addListener(({ value }) => {
    animatedValue.value = value;
  });
  return animatedValue;
};

let panRespondersBlocked = false;

const animatedValuesMap = new WeakMap();

/**
 * Get animated values: index, width, height.
 * @type {<T extends import('../state').GouterConfig>
 * (state: import('../state').GouterState<T>) => AnimatedValues}
 */
export const getAnimatedValues = (state) => {
  const prevAnimatedValues = animatedValuesMap.get(state);
  if (prevAnimatedValues) {
    return prevAnimatedValues;
  }
  const windowDimensions = Dimensions.get('window');
  /** @type {AnimatedValues} */
  const animatedValues = {
    width: newEnhancedAnimatedValue(windowDimensions.width),
    height: newEnhancedAnimatedValue(windowDimensions.height),
    index: newEnhancedAnimatedValue(0),
  };
  animatedValuesMap.set(state, animatedValues);
  return animatedValues;
};

/** @type {WeakMap<import('../state').GouterState, import('../state').GouterState>} */
const prevParentsMap = new WeakMap();

/** @type {WeakMap<import('../state').GouterState, Record<string, any>>} */
const prevParamsMap = new WeakMap();

/** @type {WeakMap<import('../state').GouterState, StateSettings>} */
const ownSettingsMap = new WeakMap();

/** @type {WeakMap<import('../state').GouterState, StateSettings>} */
const stackSettingsMap = new WeakMap();

/** @type {WeakMap<import('../state').GouterState, StateSettings>} */
const defaultSettingsMap = new WeakMap();

/** @type {WeakMap<import('../state').GouterState, StateSettings>} */
const stateSettingsProxyMap = new WeakMap();

const stateSettingsProxyHandler = {
  /** @type {<Key extends keyof StateSettings>(state: import('../state').GouterState, key: Key) => StateSettings[Key] | undefined} */
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
 * Get animated values: index, width, height.
 * @type {<T extends import('../state').GouterConfig>
 * (
 * state: import('../state').GouterState<T>,
 * screenConfigs: ScreenConfigs<T>,
 * defaultSettings: StateSettings
 * ) => StateSettings}
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

/** @type {WeakMap<WeakMap<import('../state').GouterState, number>, number>} */
const stackStateKeysCounters = new WeakMap();

/** @type {(stackState: import('../state').GouterState, stackStateKeys: WeakMap<import('../state').GouterState, number>) => number} */
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
 * Joins previous and next stacks together
 * @type {(
 * prevStack: import('../state').GouterState[],
 * nextStack: import('../state').GouterState[],
 * stackStateKeys: WeakMap<import('../state').GouterState, number>
 * )=> import('../state').GouterState[]}
 */
const getJoinedStack = (prevStack, nextStack, stackStateKeys) => {
  if (prevStack === nextStack || prevStack.length === 0) {
    return nextStack;
  }

  const prevPaths = prevStack.map((state) => getStackStateKey(state, stackStateKeys));
  const nextPaths = nextStack.map((state) => getStackStateKey(state, stackStateKeys));

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

/**
 * React context to access current gouter state from nearest provider.
 */
const gouterStateContext = createContext(
  /** @type {import('../state').GouterState<any, any> | null} */ (null),
);

/**
 * Returns current gouter state from nearest provider.
 * @returns {import('../state').GouterState<any, any> | null}
 */
export const useGouterState = () => useContext(gouterStateContext);

/**
 * @type {( predicate: (state: import('../state').GouterState<any, any> | null) => boolean,
 * listener?: (isTrue: boolean) => void) => boolean}
 */
const useParentState = (predicate, listener) => {
  const state = useContext(gouterStateContext);
  const isTrue = predicate(state);
  const [, updateState] = useState(isTrue);
  const isTrueRef = useRef(isTrue);
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  const predicateRef = useRef(predicate);
  predicateRef.current = predicate;
  const parent = state ? state.parent : undefined;
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
 * @type {React.FC<{
 * state: import('../state').GouterState
 * routes: import('..').Routes<any>
 * screenConfigs: ScreenConfigs<any>
 * defaultSettings: StateSettings
 * }>}
 */
export const GouterNative = memo(({ state, routes, screenConfigs, defaultSettings }) => {
  const [, updateState] = useState([]);

  useEffect(() => state.listen(() => updateState([])), [state]);

  const nextStack = state.stack;

  const prevStackRef = useRef(emptyStack);
  const prevStack = prevStackRef.current;

  /** @type {WeakMap<import('../state').GouterState, number>} */
  const stackStateKeys = useRef(new WeakMap()).current;

  const joinedStack = useMemo(
    () => getJoinedStack(prevStack, nextStack, stackStateKeys),
    [nextStack, prevStack, stackStateKeys],
  );

  prevStackRef.current = joinedStack;

  const { focusedChild } = state;
  const focusedChildRef = useRef(
    /** @type {import('../state').GouterState<any, any> | undefined} */ (undefined),
  );
  const blurredChild = focusedChildRef.current;
  focusedChildRef.current = focusedChild;
  const blurredIndex = blurredChild ? joinedStack.indexOf(blurredChild) : -1;
  const focusedIndex = focusedChild ? joinedStack.indexOf(focusedChild) : -1;

  const isInitializingRef = useRef(true);
  for (const stackState of nextStack) {
    if (prevStack.indexOf(stackState) === -1) {
      const index = joinedStack.indexOf(stackState);
      const value =
        index < focusedIndex ? -1 : index > focusedIndex ? 1 : isInitializingRef.current ? 0 : 1;
      const animatedValues = getAnimatedValues(stackState);
      animatedValues.index.setValue(value);
    }
  }
  isInitializingRef.current = false;

  const removedStates = useRef(new WeakSet()).current;
  for (const stackState of prevStack) {
    if (!removedStates.has(stackState) && nextStack.indexOf(stackState) === -1) {
      removedStates.add(stackState);
      const animatedValues = getAnimatedValues(stackState);
      if (Math.abs(animatedValues.index.value) !== 1) {
        const toValue = joinedStack.indexOf(stackState) > focusedIndex ? 1 : -1;
        const { animationDuration, animationEasing } = getStateSettings(
          stackState,
          screenConfigs,
          defaultSettings,
        );
        if (!animationDuration) {
          prevStackRef.current = getListWithoutItem(prevStackRef.current, stackState);
          updateState([]);
        } else {
          Animated.timing(animatedValues.index, {
            useNativeDriver: true,
            toValue,
            duration: animationDuration,
            easing: animationEasing,
          }).start(() => {
            prevStackRef.current = getListWithoutItem(prevStackRef.current, stackState);
            updateState([]);
          });
        }
      } else {
        prevStackRef.current = getListWithoutItem(prevStackRef.current, stackState);
        updateState([]);
      }
    }
  }

  if (blurredChild) {
    const animatedValues = getAnimatedValues(blurredChild);
    if (Math.abs(animatedValues.index.value) !== 1) {
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
        if (!animationDuration) {
          animatedValues.index.setValue(toValue);
        } else {
          Animated.timing(animatedValues.index, {
            useNativeDriver: true,
            toValue,
            duration: animationDuration,
            easing: animationEasing,
          }).start();
        }
      }
    } else {
      animatedValues.index.setValue(animatedValues.index.value);
    }
  }

  if (focusedChild) {
    const animatedValues = getAnimatedValues(focusedChild);
    if (animatedValues.index.value !== 0) {
      const { animationDuration, animationEasing } = getStateSettings(
        focusedChild,
        screenConfigs,
        defaultSettings,
      );
      if (!animationDuration) {
        animatedValues.index.setValue(0);
      } else {
        if (blurredIndex < focusedIndex && animatedValues.index.value === -1) {
          animatedValues.index.setValue(1);
        } else if (blurredIndex > focusedIndex && animatedValues.index.value === 1) {
          animatedValues.index.setValue(-1);
        }
        Animated.timing(animatedValues.index, {
          useNativeDriver: true,
          toValue: 0,
          duration: animationDuration,
          easing: animationEasing,
        }).start();
      }
    } else {
      animatedValues.index.setValue(0);
    }
  }

  const animatedValues = getAnimatedValues(state);
  const { component } = screenConfigs[state.name] || defaultScreenConfig;

  const valueRef = useRef(0);

  const stateSettings = getStateSettings(state, screenConfigs, defaultSettings);

  const blockedRef = useRef({ prev: false, next: false });

  const updateBlocked = useCallback(() => {
    const route = routes[state.name] || {};
    const { parent } = state;
    if (route.blocker && parent) {
      const fromStateIndex = parent.stack.indexOf(state);
      const prevState = parent.stack[fromStateIndex - 1];
      const nextState = parent.stack[fromStateIndex + 1];
      const { swipeDetection = 'none' } = stateSettings;
      const isUnidirectional = unidirectionalSwipes.indexOf(swipeDetection) >= 0;
      blockedRef.current.prev =
        prevState && route.blocker(state, isUnidirectional ? null : prevState);
      blockedRef.current.next =
        nextState && route.blocker(state, isUnidirectional ? null : nextState);
    }
  }, [routes, state, stateSettings]);

  /** @type {NonNullable<import('react-native').PanResponderCallbacks['onMoveShouldSetPanResponder']>} */
  const onMoveShouldSetPanResponder = useCallback(
    (event, { dx, dy, moveX, moveY }) => {
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
      const { width, height } = animatedValues;
      const side = isHorizontal ? width.value : height.value;
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
        valueRef.current = animatedValues.index.value;
        updateBlocked();
      }
      return shouldSet;
    },
    [state, stateSettings, animatedValues, updateBlocked],
  );

  /** @type {NonNullable<import('react-native').PanResponderCallbacks['onPanResponderMove']>} */
  const onPanResponderMove = useCallback(
    (event, { dx, dy }) => {
      const { parent, isFocused } = state;
      if (!(parent && isFocused)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const { swipeDetection = 'none', prevScreenFixed } = stateSettings;
      const isHorizontal = horizontalSwipes.indexOf(swipeDetection) >= 0;
      const delta = isHorizontal ? dx : dy;
      const { width, height } = animatedValues;
      const side = isHorizontal ? width.value : height.value;
      const offset = delta / side || 0;
      const value = valueRef.current + offset;
      const indexOffset = value > 0 ? 1 : value < 0 ? -1 : 0;
      const nextIndex = parent.focusedIndex - indexOffset;
      const nextState = parent.stack[nextIndex];
      if (nextState && nextState !== state && !prevScreenFixed) {
        const nextAnimatedValues = getAnimatedValues(nextState);
        if (nextAnimatedValues) {
          nextAnimatedValues.index.setValue(value - indexOffset);
        }
      }
      animatedValues.index.setValue(value);
    },
    [state, stateSettings, animatedValues],
  );

  /** @type {NonNullable<import('react-native').PanResponderCallbacks['onPanResponderRelease']>} */
  const onPanResponderReleaseOrTerminate = useCallback(
    (event, { dx, vx, dy, vy }) => {
      panRespondersBlocked = false;
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
      const { width, height } = animatedValues;
      const side = isHorizontal ? width.value : height.value;
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

      /** @type {Animated.EndCallback | undefined} */
      const animatedEndCallback =
        shouldGoToNextState && prevScreenFixed
          ? ({ finished }) => {
              if (finished) {
                nextState.focus();
                if (unidirectionalSwipes.indexOf(swipeDetection) >= 0) {
                  parent.setStack(getListWithoutItem(parent.stack, state));
                }
              }
            }
          : undefined;

      Animated.timing(animatedValues.index, {
        toValue: shouldGoToNextState ? indexOffset : 0,
        useNativeDriver: true,
        duration,
        easing: animationEasing,
      }).start(animatedEndCallback);

      if (!hasNextState || prevScreenFixed) {
        return;
      }

      const nextAnimatedValues = getAnimatedValues(nextState);
      if (nextAnimatedValues) {
        Animated.timing(nextAnimatedValues.index, {
          toValue: shouldGoToNextState ? 0 : -indexOffset,
          useNativeDriver: true,
          duration,
          easing: animationEasing,
        }).start(
          shouldGoToNextState
            ? ({ finished }) => {
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
    },
    [state, stateSettings, animatedValues],
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

  const { animation } = stateSettings;

  const animatedStyleOrStyles = useMemo(
    () => (animation ? animation(animatedValues) : null),
    [animatedValues, animation],
  );

  const [underlayStyle, animatedStyle] = Array.isArray(animatedStyleOrStyles)
    ? animatedStyleOrStyles
    : [null, animatedStyleOrStyles];

  return createElement(Fragment, {
    children: [
      createElement(Animated.View, {
        key: 'underlay',
        style: useMemo(() => [StyleSheet.absoluteFill, underlayStyle], [underlayStyle]),
        pointerEvents: 'none',
        onLayout: ({ nativeEvent }) => {
          const { width, height } = nativeEvent.layout;
          animatedValues.width.setValue(width);
          animatedValues.height.setValue(height);
        },
      }),
      createElement(Animated.View, {
        key: 'screen',
        ...panHandlers,
        style: useMemo(() => [StyleSheet.absoluteFill, animatedStyle], [animatedStyle]),
        children: [
          createElement(gouterStateContext.Provider, {
            key: 'provider',
            value: state,
            children: [
              createElement(component, {
                key: 'component',
                state,
                animatedValues,
                children: useMemo(
                  () =>
                    joinedStack.map((stackState) =>
                      createElement(GouterNative, {
                        key: getStackStateKey(stackState, stackStateKeys),
                        state: stackState,
                        routes,
                        screenConfigs,
                        defaultSettings,
                      }),
                    ),
                  [defaultSettings, joinedStack, routes, screenConfigs, stackStateKeys],
                ),
              }),
            ],
          }),
        ],
      }),
    ],
  });
});
