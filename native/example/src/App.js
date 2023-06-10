import React, {useEffect, useState} from 'react';
import GouterNative from 'gouter/native';
import {
  StyleSheet,
  Text,
  View,
  BackHandler,
  TouchableOpacity,
  Animated,
  Keyboard,
  ScrollView,
} from 'react-native';
import Login from './screens/Login';
import {
  getRootState,
  goBack,
  goTo,
  listen,
  replace,
  encodePath,
  setRootState,
} from './router';
import LoginConfirmation from './screens/LoginConfirmation';
import SimpleButton from './components/SimpleButton';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'white',
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 128,
    overflow: 'hidden',
  },
  modalPlaceholder: {
    width: '100%',
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#EEEEEE',
  },
});

/** @type {import('gouter/native').ScreenMap<import('./router').State>['App']} */
const App = ({children}) => {
  return (
    <View style={styles.container}>
      <Text>App</Text>
      {children}
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['LoginStack']} */
const LoginStack = ({children}) => {
  return <View style={styles.container}>{children}</View>;
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['LoginConfirmationStack']} */
const LoginConfirmationStack = ({children}) => {
  return <View style={styles.container}>{children}</View>;
};

/** @type {(numOfWords: number) => string} */
const getRandomString = numOfWords =>
  [...Array(numOfWords)]
    .map(() =>
      Math.random()
        .toString(36)
        .replace(/(\d|\.)/g, ''),
    )
    .join(' ');

const rulesText = getRandomString(1000);

/** @type {import('gouter/native').ScreenMap<import('./router').State>['LoginModal']} */
const LoginModal = ({scrollProps}) => {
  return (
    <View style={styles.modalContainer}>
      <ScrollView
        style={styles.modalPlaceholder}
        contentContainerStyle={{padding: 16}}
        {...scrollProps}>
        <Text>{rulesText}</Text>
      </ScrollView>
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['Tabs']} */
export const LoginDrawer = () => {
  return (
    <View style={{flexDirection: 'row', flex: 1}}>
      <TouchableOpacity
        style={{flex: 0.2}}
        activeOpacity={1}
        onPress={goBack}
      />
      <View
        style={{
          backgroundColor: 'gray',
          flex: 0.8,
        }}>
        <View>
          <Text>Settings</Text>
        </View>
      </View>
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['Tabs']} */
const Tabs = ({state: tabsState, children}) => {
  const stack = tabsState.stack || [];
  const currentIndex =
    tabsState.index !== undefined ? tabsState.index : stack.length - 1;
  return (
    <View style={styles.container}>
      <View style={styles.container}>{children}</View>
      <View style={styles.tabBar}>
        {stack.map(({name}, index) => (
          <SimpleButton
            key={name}
            title={name}
            onPress={() => goTo(name, {})}
            selected={index === currentIndex}
          />
        ))}
        <SimpleButton
          key="remove"
          title="- Post"
          onPress={() => {
            const appState = getRootState();
            const nextStack = (appState.stack || []).map(subState =>
              subState.name === 'Tabs'
                ? {
                    ...subState,
                    index: 0,
                    stack: (subState.stack || []).filter(
                      ({name}) => name !== 'Post',
                    ),
                  }
                : subState,
            );
            setRootState({...appState, stack: nextStack});
          }}
        />
        <SimpleButton
          key="add"
          title="+ Post"
          onPress={() => goTo('Post', {})}
        />
        <SimpleButton
          key="reverse"
          title="Reverse"
          onPress={() =>
            replace(state =>
              state === tabsState
                ? {
                    ...state,
                    stack: [...(state.stack || [])].reverse(),
                    index: (state.stack || []).length - 1 - currentIndex,
                  }
                : state,
            )
          }
        />
      </View>
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['Home']} */
const Home = () => {
  return (
    <View style={styles.container}>
      <Text>Home</Text>
      <SimpleButton title="go back" onPress={goBack} />
      <Text>{'home '.repeat(100)}</Text>
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['Post']} */
const Post = () => {
  return (
    <View style={styles.container}>
      <Text>Post</Text>
      <SimpleButton title="go back" onPress={goBack} />
      <Text>{'post '.repeat(100)}</Text>
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['Profile']} */
const Profile = () => {
  return (
    <ScrollView style={styles.container}>
      <Text>Profile</Text>
      <SimpleButton title="go back" onPress={goBack} />
      <Text>{'profile '.repeat(500)}</Text>
    </ScrollView>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['_']} */
const NotFound = ({state}) => {
  return (
    <ScrollView style={styles.container}>
      <Text>404</Text>
      <SimpleButton title="go back" onPress={goBack} />
      <Text>{state.params.url}</Text>
    </ScrollView>
  );
};

/** @type {import('gouter/native').Animation} */
const defaultAnimation = ({index, width, focused, bounce}) => ({
  zIndex: focused,
  opacity: index.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 1, 0],
  }),
  transform: [
    {
      translateX: Animated.multiply(
        width,
        Animated.subtract(index, Animated.multiply(bounce, 0.25)),
      ),
    },
    {
      scale: index.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0.9, 1, 0.9],
      }),
    },
    {
      rotate: index.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-30deg', '0deg', '30deg'],
      }),
    },
  ],
});

/** @type {import('gouter/native').Animation} */
const iOSAnimation = ({index, width}) => [
  {
    backgroundColor: 'black',
    opacity: index.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0.2, 0, 0],
    }),
  },
  {
    transform: [
      {
        translateX: Animated.multiply(
          width,
          index.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-0.25, 0, 1],
          }),
        ),
      },
    ],
  },
];

/** @type {import('gouter/native').Animation} */
const drawerAnimation = ({index, width}) => [
  {
    backgroundColor: 'black',
    opacity: index.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0.2, 0, 0],
    }),
  },
  {
    transform: [
      {
        translateX: Animated.multiply(
          width,
          index.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [0, 0, 1],
          }),
        ),
      },
    ],
  },
];

/** @type {import('gouter/native').Animation} */
const modalAnimation = ({index, height}) => [
  {
    backgroundColor: 'black',
    opacity: index.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0.5, 0, 0],
    }),
  },
  {
    transform: [
      {
        translateY: Animated.multiply(
          height,
          index.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [0, 0, 1],
          }),
        ),
      },
    ],
  },
];

const animationDuration = 1256;

/** @type {import('gouter/native').StackSettings} */
const defaultSettings = {
  animation: iOSAnimation,
  animationDuration,
  swipeDetection: 'left',
  swipeDetectionSize: 40,
};

/** @type {import('gouter/native').StackSettings} */
const modalSettings = {
  animation: modalAnimation,
  animationDuration: 256,
  swipeDetection: 'vertical',
};

/** @type {import('gouter/native').StackSettings} */
const tabsSettings = {
  animation: defaultAnimation,
  animationDuration: 1256,
  swipeDetection: 'horizontal',
};

/** @type {import('gouter/native').StackSettings} */
const drawerSettings = {
  animation: drawerAnimation,
  animationDuration,
  swipeDetection: 'right',
  swipeDetectionSize: '80%',
};

/** @type {import('gouter/native').ScreenConfigMap<import('./router').State>} */
const screenConfigMap = {
  _: {
    component: NotFound,
  },
  App: {
    component: App,
    stackSettings: defaultSettings,
  },
  LoginStack: {
    component: LoginStack,
    stackSettings: modalSettings,
  },
  LoginModal: {
    component: LoginModal,
  },
  Login: {
    component: Login,
  },
  LoginConfirmationStack: {
    component: LoginConfirmationStack,
    stackSettings: drawerSettings,
  },
  LoginConfirmation: {
    component: LoginConfirmation,
  },
  LoginDrawer: {
    component: LoginDrawer,
  },
  Tabs: {
    component: Tabs,
    stackSettings: tabsSettings,
  },
  Home: {
    component: Home,
  },
  Post: {
    component: Post,
  },
  Profile: {
    component: Profile,
  },
};

const AppWrapper = () => {
  const [state, setState] = useState(getRootState);

  useEffect(() => listen(setState), []);

  useEffect(() => listen(Keyboard.dismiss), []);

  useEffect(() => {
    const onHardwareBackPress = () => {
      goBack();
      return true;
    };
    BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', onHardwareBackPress);
    };
  }, []);

  return (
    <GouterNative
      state={state}
      screenConfigMap={screenConfigMap}
      encodePath={encodePath}
      goTo={goTo}
    />
  );
};

export default AppWrapper;
