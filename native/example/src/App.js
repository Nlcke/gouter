import React, {useEffect, useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  BackHandler,
  TouchableOpacity,
  Animated,
  Keyboard,
} from 'react-native';
import GouterNative from 'gouter/native';
import {
  getState,
  goBack,
  goTo,
  listen,
  replace,
  encodePath,
  setState,
} from './router';
import {ScrollView} from 'react-native';

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

/** @type {import('gouter/native').ScreenMap<import('./router').State>['Login']} */
const Login = ({state}) => {
  return (
    <View style={styles.container}>
      <Text>Login</Text>
      <Text>Name: {state.params.name}</Text>
      <Button
        title={'go to Login Confirmation'}
        onPress={() => goTo('LoginConfirmation', {phone: '2398723987'})}
      />
      <Text>{'login '.repeat(100)}</Text>
      <Button
        title={'change name'}
        onPress={() =>
          replace(state, {
            name: 'Login',
            params: {
              name: state.params.name === 'user' ? 'guest' : 'user',
            },
          })
        }
      />
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['LoginConfirmation']} */
const LoginConfirmation = ({state}) => {
  return (
    <View style={styles.container}>
      <Text>Login Confirmation</Text>
      <Text>Phone: {state.params.phone}</Text>
      <Button title={'go to Tabs'} onPress={() => goTo('Tabs', {})} />
      <Text>{'confirmation '.repeat(100)}</Text>
      <Button title={'go back'} onPress={goBack} />
      <Button
        title={'add Login'}
        onPress={() => {
          const appState = getState();
          setState({
            ...appState,
            stack: [
              {name: 'Login', params: {name: 'user'}},
              ...(appState.stack || []).filter(({name}) => name !== 'Login'),
            ],
          });
        }}
      />
      <Button
        title={'remove Login'}
        onPress={() => {
          const appState = getState();
          setState({
            ...appState,
            stack: (appState.stack || []).filter(({name}) => name !== 'Login'),
          });
        }}
      />
      <Button
        title={'goTo Login'}
        onPress={() => {
          goTo('Login', {});
        }}
      />
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['Tabs']} */
const Tabs = ({state, children}) => {
  const stack = state.stack || [];
  const currentIndex =
    state.index !== undefined ? state.index : stack.length - 1;
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
          title={'- Post'}
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
        <Button key="add" title={'+ Post'} onPress={() => goTo('Post', {})} />
        <Button
          key="reverse"
          title={'Reverse'}
          onPress={() =>
            replace(state, {
              ...state,
              stack: [...(state.stack || [])].reverse(),
              index: (state.stack || []).length - 1 - currentIndex,
            })
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
      <Button title={'go back'} onPress={goBack} />
      <Text>{'home '.repeat(100)}</Text>
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['Post']} */
const Post = () => {
  return (
    <View style={styles.container}>
      <Text>Post</Text>
      <Button title={'go back'} onPress={goBack} />
      <Text>{'post '.repeat(100)}</Text>
    </View>
  );
};

/** @type {import('gouter/native').ScreenMap<import('./router').State>['Profile']} */
const Profile = () => {
  return (
    <ScrollView style={styles.container}>
      <Text>Profile</Text>
      <Button title={'go back'} onPress={goBack} />
      <Text>{'profile '.repeat(500)}</Text>
    </ScrollView>
  );
};

/** @type {import('gouter/native').Animation} */
const defaultAnimation = (value, size) => ({
  opacity: value.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 1, 0],
  }),
  transform: [
    {
      translateX: Animated.multiply(size.x, value),
    },
    {
      scale: value.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0.9, 1, 0.9],
      }),
    },
    {
      rotate: value.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-30deg', '0deg', '30deg'],
      }),
    },
  ],
});

const stackAnimationDuration = 256;

/** @type {import('gouter/native').ScreenConfigMap<import('./router').State>} */
const screenConfigMap = {
  App: {
    component: App,
    stackAnimation: defaultAnimation,
    stackAnimationDuration,
  },
  Login: {
    component: Login,
    stackAnimation: defaultAnimation,
    stackAnimationDuration,
  },
  LoginConfirmation: {
    component: LoginConfirmation,
    stackAnimation: defaultAnimation,
    stackAnimationDuration,
  },
  Tabs: {
    component: Tabs,
    stackAnimation: defaultAnimation,
    stackAnimationDuration: 1256,
  },
  Home: {
    component: Home,
    stackAnimation: defaultAnimation,
    stackAnimationDuration,
  },
  Post: {
    component: Post,
    stackAnimation: defaultAnimation,
    stackAnimationDuration,
  },
  Profile: {
    component: Profile,
    stackAnimation: defaultAnimation,
    stackAnimationDuration,
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
