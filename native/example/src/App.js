import React, {useEffect, useMemo, useState} from 'react';
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
import {
  getState,
  goBack,
  goTo,
  listen,
  replace,
  encodePath,
  setState,
} from './router';

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
  buttonContainer: {
    borderWidth: 1,
    borderColor: 'gray',
    borderRadius: 16,
    alignItems: 'center',
    padding: 8,
    marginVertical: 8,
  },
  buttonContainerSelected: {
    backgroundColor: '#cccccc',
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

/** @type {React.FC<{title: string, onPress: () => void, selected?: boolean}>} */
const Button = ({title, onPress, selected}) => (
  <TouchableOpacity
    style={[styles.buttonContainer, selected && styles.buttonContainerSelected]}
    onPress={onPress}>
    <Text>{title}</Text>
  </TouchableOpacity>
);

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

/** @type {import('gouter/native').ScreenMap<import('./router').State>['LoginModal']} */
const LoginModal = () => {
  return (
    <View style={styles.modalContainer} renderToHardwareTextureAndroid>
      <View style={styles.modalPlaceholder} renderToHardwareTextureAndroid />
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['Login']} */
const Login = ({state}) => {
  return (
    <View style={styles.container}>
      <Text>Login</Text>
      <Text>Name: {state.params.name}</Text>
      <Button
        title="go to LoginConfirmation"
        onPress={() => goTo('LoginConfirmation', {phone: '2398723987'})}
      />
      <Text>{'login '.repeat(100)}</Text>
      <Button
        title="change name"
        onPress={() =>
          replace(loginState =>
            loginState.name === 'Login'
              ? {
                  ...loginState,
                  params: {
                    name: loginState.params.name === 'user' ? 'guest' : 'user',
                  },
                }
              : loginState,
          )
        }
      />
      <Button title="show modal" onPress={() => goTo('LoginModal', {})} />
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['LoginConfirmation']} */
const LoginConfirmation = ({state, animationProps: {index}}) => {
  const animatedTextStyle = useMemo(
    () => ({
      opacity: index.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
      transform: [
        {
          translateY: index.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-80, 0, -80],
          }),
        },
      ],
    }),
    [index],
  );

  const [appState, setAppState] = useState(getState);
  useEffect(() => listen(setAppState), []);
  const stack = getState().stack || [];
  const hasLogin = !!stack.find(
    ({name, stack: stackOfLoginStack}) =>
      name === 'LoginStack' &&
      stackOfLoginStack &&
      stackOfLoginStack.find(({name: subName}) => subName === 'Login'),
  );

  return (
    <View style={styles.container}>
      <Animated.View style={animatedTextStyle}>
        <Text>Login Confirmation</Text>
      </Animated.View>
      <Text>Phone: {state.params.phone}</Text>
      <Button title="go to Tabs" onPress={() => goTo('Tabs', {})} />
      <Button title="go to App" onPress={() => goTo('App', {})} />
      <Text>{'confirmation '.repeat(100)}</Text>
      <Button title="go back" onPress={goBack} />
      <Button
        title={hasLogin ? 'remove LoginStack' : 'add LoginStack'}
        onPress={() => {
          setState(
            hasLogin
              ? {
                  ...appState,
                  stack: stack.filter(({name}) => name !== 'LoginStack'),
                }
              : {
                  ...appState,
                  stack: [
                    {
                      name: 'LoginStack',
                      params: {},
                      stack: [
                        {
                          name: 'Login',
                          params: {},
                        },
                      ],
                    },
                    ...stack,
                  ],
                },
          );
        }}
      />
      <Button
        title="goTo Login"
        onPress={() => {
          goTo('Login', {});
        }}
      />
      <Button
        title="goTo LoginDrawer"
        onPress={() => {
          goTo('LoginDrawer', {});
        }}
      />
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
          <Button
            key={name}
            title={name}
            onPress={() => goTo(name, {})}
            selected={index === currentIndex}
          />
        ))}
        <Button
          key="remove"
          title="- Post"
          onPress={() => {
            const appState = getState();
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
            setState({...appState, stack: nextStack});
          }}
        />
        <Button key="add" title="+ Post" onPress={() => goTo('Post', {})} />
        <Button
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
      <Button title="go back" onPress={goBack} />
      <Text>{'home '.repeat(100)}</Text>
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['Post']} */
const Post = () => {
  return (
    <View style={styles.container}>
      <Text>Post</Text>
      <Button title="go back" onPress={goBack} />
      <Text>{'post '.repeat(100)}</Text>
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['Profile']} */
const Profile = () => {
  return (
    <ScrollView style={styles.container}>
      <Text>Profile</Text>
      <Button title="go back" onPress={goBack} />
      <Text>{'profile '.repeat(500)}</Text>
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

const animationDuration = 256;

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
  animationDuration,
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
  App: {
    component: App,
    stack: defaultSettings,
  },
  LoginStack: {
    component: LoginStack,
    stack: modalSettings,
  },
  LoginModal: {
    component: LoginModal,
  },
  Login: {
    component: Login,
  },
  LoginConfirmationStack: {
    component: LoginConfirmationStack,
    stack: drawerSettings,
  },
  LoginConfirmation: {
    component: LoginConfirmation,
  },
  LoginDrawer: {
    component: LoginDrawer,
  },
  Tabs: {
    component: Tabs,
    stack: tabsSettings,
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
  const [appState, setAppState] = useState(getState);

  useEffect(() => listen(setAppState), []);
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
      state={appState}
      screenConfigMap={screenConfigMap}
      encodePath={encodePath}
      goTo={goTo}
    />
  );
};

export default AppWrapper;
