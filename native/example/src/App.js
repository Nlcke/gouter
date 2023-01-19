import React, {useEffect, useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  BackHandler,
  TouchableOpacity,
} from 'react-native';
import GouterNative from 'gouter/native';
import {
  getState,
  goBack,
  goTo,
  listen,
  newState,
  replace,
  encodePath,
} from './router';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'white',
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
});

/** @type {React.FC<{title: string, onPress: () => void}>} */
const Button = ({title, onPress}) => (
  <TouchableOpacity style={styles.buttonContainer} onPress={onPress}>
    <Text>{title}</Text>
  </TouchableOpacity>
);

/** @type {import('./router').ScreenMap['App']} */
const App = ({children}) => {
  return (
    <View style={styles.container}>
      <Text>App</Text>
      {children}
    </View>
  );
};

/** @type {import('./router').ScreenMap['Login']} */
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
          replace(
            state,
            newState('Login', {
              name: state.params.name === 'user' ? 'guest' : 'user',
            }),
          )
        }
      />
    </View>
  );
};

/** @type {import('./router').ScreenMap['LoginConfirmation']} */
const LoginConfirmation = ({state}) => {
  return (
    <View style={styles.container}>
      <Text>Login Confirmation</Text>
      <Text>Phone: {state.params.phone}</Text>
      <Button title={'go to Tabs'} onPress={() => goTo('Tabs', {})} />
      <Text>{'confirmation '.repeat(100)}</Text>
      <Button title={'go back'} onPress={goBack} />
    </View>
  );
};

/** @type {import('./router').ScreenMap['Tabs']} */
const Tabs = ({children}) => {
  return (
    <View style={styles.container}>
      <Text>Tabs</Text>
      <View style={styles.container}>{children}</View>
      <View style={styles.tabBar}>
        <Button title={'Home'} onPress={() => goTo('Home', {})} />
        <Button title={'New Post'} onPress={() => goTo('NewPost', {})} />
        <Button title={'Profile'} onPress={() => goTo('Profile', {})} />
      </View>
    </View>
  );
};

/** @type {import('./router').ScreenMap['Home']} */
const Home = () => {
  return (
    <View style={styles.container}>
      <Text>Home</Text>
      <Button title={'go back'} onPress={goBack} />
      <Text>{'home '.repeat(100)}</Text>
    </View>
  );
};

/** @type {import('./router').ScreenMap['NewPost']} */
const NewPost = () => {
  return (
    <View style={styles.container}>
      <Text>New Post</Text>
      <Button title={'go back'} onPress={goBack} />
      <Text>{'new post '.repeat(100)}</Text>
    </View>
  );
};

/** @type {import('./router').ScreenMap['Profile']} */
const Profile = () => {
  return (
    <View style={styles.container}>
      <Text>Profile</Text>
      <Button title={'go back'} onPress={goBack} />
      <Text>{'profile '.repeat(100)}</Text>
    </View>
  );
};

/** @type {import('./router').ScreenMap} */
const screenMap = {
  App,
  Login,
  LoginConfirmation,
  Tabs,
  Home,
  NewPost,
  Profile,
};

/** @type {import('gouter/native').Animation} */
const defaultAnimation = value => ({
  opacity: value,
  transform: [
    {
      translateY: value.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
      }),
    },
    {
      scale: value.interpolate({
        inputRange: [0, 1],
        outputRange: [0.95, 1],
      }),
    },
  ],
});

/** @type {Partial<Record<keyof import('router').ScreenMap, import('gouter/native').Animation>>} */
const animationMap = {
  Home: () => ({}),
  NewPost: () => ({}),
  Profile: () => ({}),
};

const AppWrapper = () => {
  const [state, setState] = useState(getState);

  console.log(JSON.stringify(state, null, 4));

  useEffect(() => listen(setState), []);

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
      encodePath={encodePath}
      animationDuration={256}
      defaultAnimation={defaultAnimation}
      animationMap={animationMap}
      screenMap={screenMap}
      onSwipeBack={goBack}
    />
  );
};

export default AppWrapper;
