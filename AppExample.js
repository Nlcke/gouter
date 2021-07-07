import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import linking from 'navigation/linking';
import { observer } from 'mobx-react-lite';
import fetching from 'navigation/fetching';
import dayjs from 'dayjs';
import 'dayjs/locale/en-gb';
import newUseStyles, {
  darkPalette,
  lightPalette,
  ThemeContextProvider,
} from 'hooks/newUseStyles';
import isWeb from 'helpers/isWeb';
// import MainStack from 'navigation/MainStack';
import SnackBar from 'components/SnackBar';
import { errorStore, configStore } from 'stores';

import Favourites from 'screens/Favourites';
import Gallery from 'screens/Gallery';
import Inbox from 'screens/Inbox';
import More from 'screens/More';
import Home from 'screens/Home';
import gouter from 'navigation/gouter';
import StackCard from 'components/StackCard';
import usePrevious from 'hooks/usePrevious';

dayjs.locale('en-gb');

const useStyles = newUseStyles(() => ({
  container: {
    height: isWeb ? '100vh' : '100%',
  },
}));

const screenMap = {
  Home,
  Favourites,
  Gallery,
  Inbox,
  More,
};

/** @type {import('components/StackCard').Animation} */
const animation = (value) => ({
  opacity: value.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  }),
  transform: [
    {
      rotateX: value.interpolate({
        inputRange: [0, 1],
        outputRange: ['90deg', '0deg'],
      }),
    },
    {
      rotateY: value.interpolate({
        inputRange: [0, 1],
        outputRange: ['90deg', '0deg'],
      }),
    },
    {
      rotateZ: value.interpolate({
        inputRange: [0, 1],
        outputRange: ['-90deg', '0deg'],
      }),
    },
    // {
    //   scale: value.interpolate({
    //     inputRange: [0, 1],
    //     outputRange: [1.2, 1],
    //   }),
    // },
    {
      translateX: value.interpolate({
        inputRange: [0, 1],
        outputRange: [360, 0],
      }),
      // translateX: value.interpolate({
      //   inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
      //   outputRange: [360, 240, 0, -80, -40, 0, 20, 0, -10, 0, 0],
      // }),
    },
  ],
});

/** @type {import('components/StackCard').Animation} */
const animationOff = (value) => ({
  opacity: value.interpolate({
    inputRange: [0, 0.999, 1],
    outputRange: [0, 0, 1],
  }),
});

const containerStyle = {
  flex: 1,
};

/** @type {typeof gouter['stack']} */
const emptyStack = [];

// /** @type {typeof gouter['stack'][number]} */
// const emptyState = null;

const App = () => {
  const S = useStyles();
  const { theme } = configStore;
  const colorScheme = useColorScheme();
  const light = theme ? theme !== 'dark' : colorScheme !== 'dark';
  const p = light ? lightPalette : darkPalette;

  const [stacks, setStacks] = useState([gouter.stack, emptyStack]);

  const [stack, staleStack] = stacks;

  const stackCardStyle = useMemo(
    () => ({
      ...StyleSheet.absoluteFillObject,
      backgroundColor: p.background,
    }),
    [p.background],
  );

  useEffect(() => {
    if (!stack.length) {
      gouter.goTo({ name: 'Home' });
    }
  }, [stack.length]);

  useEffect(() => {
    BackHandler.addEventListener('hardwareBackPress', () => {
      const { stack } = gouter;
      gouter.setStack(stack.slice(0, -1));
      console.log('hardwareBackPress');
      return true;
    });
  }, []);

  const listen = useCallback(() => {
    gouter.listen((stack) => {
      setStacks(([prevStack, prevStaleStack]) => {
        const lastPrevStackState = prevStack[prevStack.length - 1];
        const staleState =
          !!lastPrevStackState &&
          !stack.includes(lastPrevStackState) &&
          lastPrevStackState;
        const nextStaleStack = staleState
          ? [staleState, ...prevStaleStack]
          : prevStaleStack;
        const staleStack = nextStaleStack.filter(
          ({ key }) => !stack.find((state) => state.key === key),
        );
        return [stack, staleStack];
      });
    });
  }, []);

  useEffect(listen, [listen]);

  const onSnackBarHide = useCallback(() => errorStore.resetState(), []);

  const lastStackIndex = stack.length - 1;

  const onUnmount = useCallback(({ key }) => {
    setStacks(([prevStack, prevStaleStack]) => [
      prevStack,
      prevStaleStack.filter((state) => state.key !== key),
    ]);
  }, []);

  const freshScreens = useMemo(
    () =>
      stack.map((state, index) => (
        <StackCard
          key={state.key}
          state={state}
          style={stackCardStyle}
          animation={animation}
          duration={300}
          isReverse={false}
          onSwipeBack={null}>
          {React.createElement(screenMap[state.name], {
            routerState: state,
            isFocused: index === lastStackIndex,
          })}
        </StackCard>
      )),
    [lastStackIndex, stack, stackCardStyle],
  );

  const staleScreens = useMemo(
    () =>
      staleStack.map((state) => (
        <StackCard
          key={state.key}
          state={state}
          style={stackCardStyle}
          animation={animation}
          duration={3000}
          isReverse={true}
          onUnmount={onUnmount}
          onSwipeBack={null}>
          {React.createElement(screenMap[state.name], {
            routerState: state,
            isFocused: false,
          })}
        </StackCard>
      )),
    [onUnmount, stackCardStyle, staleStack],
  );

  const screens = useMemo(
    () =>
      staleScreens.length ? [...freshScreens, ...staleScreens] : freshScreens,
    [freshScreens, staleScreens],
  );

  console.log(stack);
  console.log(staleStack);

  return (
    <ThemeContextProvider>
      <View style={S.container}>
        <StatusBar hidden />
        <View style={containerStyle}>{screens}</View>
        {!!errorStore.errors.length && (
          <SnackBar data={errorStore.errors} onHide={onSnackBarHide} />
        )}
      </View>
    </ThemeContextProvider>
  );
};

export default observer(App);
