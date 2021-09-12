import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import StackCard from './StackCard';

/** @type {import('react-native').ViewStyle} */
const containerStyle = {
  flex: 1,
};

/**
 * Gouter Stack
 * @template {Record<keyof T, import('./Gouter').Route>} T
 * @param {Object} props
 * @param {import('..').GouterInstance<T>} props.gouter
 * @param {Partial<Record<keyof T, React.ComponentType>>} props.screenMap
 * @param {Record<import('./Gouter').Segment, (import('react').FunctionComponent | import('react').ComponentClass) & {side: string, size: number}>} props.segmentMap
 * @param {import('./StackCard').Animation} props.animation
 * @returns {JSX.Element}
 */
const GouterStack = ({ gouter, screenMap, segmentMap, animation }) => {
  /** @type {gouter['stack']} */
  const emptyStack = useMemo(() => [], []);

  const [stacks, setStacks] = useState([gouter.stack, emptyStack]);

  const [stack, staleStack] = stacks;

  const getStackExt = useCallback(
    /** @param {typeof gouter.stack} stack */
    (stack) => {
      return stack;
    },
    [],
  );

  const stackExtRaw = useMemo(() => getStackExt(stack), [getStackExt, stack]);
  const staleStackExtRaw = useMemo(() => getStackExt(staleStack), [getStackExt, staleStack]);

  const staleStackExt = useMemo(
    () =>
      staleStackExtRaw.map((staleState) =>
        stackExtRaw.findIndex((state) => state.key === staleState.key) === -1
          ? staleState
          : {
              ...staleState,
              notStale: true,
            },
      ),
    [stackExtRaw, staleStackExtRaw],
  );

  const stackExt = useMemo(
    () =>
      stackExtRaw.filter(
        (state) => staleStackExt.findIndex((staleState) => staleState.key === state.key) === -1,
      ),
    [stackExtRaw, staleStackExt],
  );

  useEffect(() => {
    const onHardwareBackPress = () => {
      gouter.goBack();
      return true;
    };
    BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', onHardwareBackPress);
    };
  }, [gouter]);

  const listen = useCallback(() => {
    gouter.listen((stack) => {
      setStacks(([prevStack, prevStaleStack]) => {
        const lastPrevStackState = prevStack[prevStack.length - 1];
        const staleState =
          !!lastPrevStackState && !stack.includes(lastPrevStackState) && lastPrevStackState;
        const nextStaleStack = staleState ? [staleState, ...prevStaleStack] : prevStaleStack;
        const staleStack = nextStaleStack.filter(
          ({ key }) => !stack.find((state) => state.key === key),
        );
        return [stack, staleStack];
      });
    });
  }, [gouter]);

  useEffect(listen, [listen]);

  const isStackEmpty = stack.length === 0;

  useEffect(() => {
    if (isStackEmpty) {
      console.log('remove me');
      gouter.goTo({ name: 'Home' });
    }
  }, [gouter, isStackEmpty]);

  const lastStackIndex = stack.length - 1;

  const onUnmount = useCallback(({ key }) => {
    setStacks(([prevStack, prevStaleStack]) => [
      prevStack,
      prevStaleStack.filter((state) => state.key !== key),
    ]);
  }, []);

  const freshScreens = useMemo(
    () =>
      stackExt.map((state, index) => (
        <StackCard
          key={state.key}
          state={state}
          style={StyleSheet.absoluteFillObject}
          animation={animation}
          duration={300}
          isReverse={false}
          onSwipeBack={null}>
          {React.createElement(
            'segment' in state ? segmentMap[state.segment] : screenMap[state.name],
            {
              routerState: state,
              isFocused: index === lastStackIndex,
            },
          )}
        </StackCard>
      )),
    [animation, lastStackIndex, screenMap, segmentMap, stackExt],
  );

  const staleScreens = useMemo(
    () =>
      staleStackExt.map((state, index) => (
        <StackCard
          key={state.key}
          state={state}
          style={StyleSheet.absoluteFillObject}
          animation={animation}
          duration={300}
          isReverse={state.notStale ? false : true}
          onUnmount={onUnmount}
          onSwipeBack={null}>
          {React.createElement(
            'segment' in state ? segmentMap[state.segment] : screenMap[state.name],
            {
              routerState: state,
              isFocused: false,
            },
          )}
        </StackCard>
      )),
    [animation, onUnmount, screenMap, segmentMap, staleStackExt],
  );

  const screens = useMemo(
    () => (staleScreens.length ? [...freshScreens, ...staleScreens] : freshScreens),
    [freshScreens, staleScreens],
  );

  return <View style={containerStyle}>{screens}</View>;
};

export default GouterStack;
