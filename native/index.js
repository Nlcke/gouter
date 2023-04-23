import { memo, useCallback, useMemo, useRef, useState, createElement } from 'react';
import { PanResponder, Animated, StyleSheet, Dimensions, View } from 'react-native';

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

/**
 * @typedef {(value: Animated.AnimatedSubtraction<number>, size: Animated.ValueXY)
 * => Animated.WithAnimatedValue<import('react-native').ViewStyle>} Animation
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

const defaultAnimationDurationRef = { current: 0 };

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
 * animationDurationRef: React.MutableRefObject<number>
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
    animationDurationRef,
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

    const focusedSubStateIndex = state.index !== undefined ? state.index : nextStack.length - 1;

    const focusedSubState = nextStack[focusedSubStateIndex];
    const focusedIndex = stack.indexOf(focusedSubState);

    const thisAnimatedFocusedIndex = useRef(new Animated.Value(focusedIndex)).current;

    const maybeScreenConfig = screenConfigMap[state.name];
    const screenConfig =
      typeof maybeScreenConfig === 'function'
        ? maybeScreenConfig(state)
        : maybeScreenConfig || defaultScreenConfig;

    const thisAnimationDurationRef = useRef(screenConfig.stackAnimationDuration);
    thisAnimationDurationRef.current = screenConfig.stackAnimationDuration;

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

    const animatedZIndex = useRef(new Animated.Value(isFocused ? 0.5 : 0)).current;
    const prevIsFocusedRef = useRef(isFocused);
    if (isFocused !== prevIsFocusedRef.current) {
      animatedZIndex.setValue(isFocused ? 0.5 : 0);
    }
    prevIsFocusedRef.current = isFocused;

    const animatedStyle = useMemo(
      () => [
        StyleSheet.absoluteFill,
        { zIndex: animatedZIndex },
        stackAnimation ? stackAnimation(animatedValue, animatedSize) : null,
      ],
      [stackAnimation, animatedValue, animatedSize, animatedZIndex],
    );

    const focusedIndexRef = useRef(focusedIndex);
    const prevFocusedIndex = focusedIndexRef.current;
    focusedIndexRef.current = focusedIndex;

    const onIndexChange = useCallback(
      (/** @type {number} */ currentIndex) => {
        const duration =
          thisAnimationDurationRef.current *
          Math.min(1, Math.abs(currentIndex - focusedIndexRef.current));
        if (duration < 32) {
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

    if (focusedIndex !== prevFocusedIndex) {
      thisAnimatedFocusedIndex.stopAnimation(onIndexChange);
    }

    const Screen = screenConfig.component;
    const thisStackRef = useRef(stack);
    thisStackRef.current = stack;
    const thisSize = useRef({ width: 0, height: 0 }).current;
    const thisStackAnimation = screenConfig.stackAnimation;

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
            animationDurationRef: thisAnimationDurationRef,
          }),
        ),
      [
        screenConfigMap,
        encodePath,
        focusedIndex,
        goTo,
        nextStack,
        stack,
        thisAnimatedFocusedIndex,
        thisAnimatedSize,
        thisStackAnimation,
        thisSize,
      ],
    );

    const valueRef = useRef(0);
    const onValue = useCallback((/** @type {number} */ value) => {
      valueRef.current = value;
    }, []);

    const stateRef = useRef(state);
    stateRef.current = state;

    /** @type {NonNullable<import('react-native').PanResponderCallbacks['onPanResponderRelease']>} */
    const onPanResponderReleaseOrTerminate = useCallback(
      (_, { dx, vx }) => {
        panRespondersBlocked = false;

        if (!dx) {
          return;
        }

        const offset = dx / size.width || 0;
        const velocityOffset = Math.max(Math.min(0.5, 0.25 * vx), -0.5);
        const value = valueRef.current - offset - velocityOffset;

        const nextPossibleIndex = Math.round(value);
        const nextState = stackRef.current[nextPossibleIndex] || stateRef.current;
        const nextIndex = nextState === stateRef.current ? indexRef.current : nextPossibleIndex;

        const delta = Math.abs(nextIndex - value);
        const duration = (animationDurationRef.current * delta) / (1 + 0.25 * Math.abs(vx));

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
      [animatedFocusedIndex, animationDurationRef, goTo, size, stackRef],
    );

    const panHandlers = useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (event, { dx, dy }) => {
            if (panRespondersBlocked) {
              return false;
            }
            const shouldSet =
              event.nativeEvent.touches.length === 1 && Math.abs(dx) > 5 && Math.abs(dy) < 20;
            if (shouldSet) {
              panRespondersBlocked = true;
              animatedFocusedIndex.stopAnimation(onValue);
            }
            return shouldSet;
          },
          onPanResponderMove: (_, { dx }) => {
            const offset = dx / size.width || 0;
            animatedFocusedIndex.setValue(valueRef.current - offset);
          },
          onPanResponderRelease: onPanResponderReleaseOrTerminate,
          onPanResponderTerminate: onPanResponderReleaseOrTerminate,
          onPanResponderTerminationRequest: () => false,
        }).panHandlers,
      [animatedFocusedIndex, onValue, size, onPanResponderReleaseOrTerminate],
    );

    const layoutChild = useMemo(
      () =>
        createElement(View, {
          key: '',
          style: { ...StyleSheet.absoluteFillObject, opacity: 0 },
          onLayout: ({ nativeEvent }) => {
            const { width, height } = nativeEvent.layout;
            thisSize.width = width;
            thisSize.height = height;
            thisAnimatedSize.setValue({ x: width, y: height });
          },
        }),
      [thisAnimatedSize, thisSize],
    );

    const hasSize = size.width > 0 && size.height > 0;

    const extendedChildren = useMemo(
      () => (hasSize ? [layoutChild, ...children] : layoutChild),
      [hasSize, layoutChild, children],
    );

    return createElement(Animated.View, {
      key: encodePath(state),
      ...panHandlers,
      style: animatedStyle,
      children: Screen
        ? createElement(Screen, {
            state,
            isFocused,
            isStale,
            children: extendedChildren,
          })
        : null,
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
    animationDurationRef: defaultAnimationDurationRef,
    ...props,
  }),
);

export default GouterNative;
