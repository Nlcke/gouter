import Gouter from 'gouter';
import {newStackNavigator, newTabNavigator} from 'gouter/navigators';

const gouter = new Gouter({
  App: {
    _: '/',
  },
  Login: {
    _: '/login',
    name: {decode: str => str, encode: str => str},
  },
  LoginConfirmation: {
    _: '/login-confirmation',
    phone: ['/', /\d+/],
  },
  Tabs: {
    _: '/tabs',
  },
  Home: {
    _: '/home',
  },
  NewPost: {
    _: '/new-post',
  },
  Profile: {
    _: '/profile',
  },
});

const {
  setState,
  setBuilders,
  setNavigators,
  goTo,
  goBack,
  getState,
  listen,
  replace,
  encodePath,
} = gouter;

setBuilders({
  App: state => ({...state, stack: [{name: 'Login', params: {}}]}),
  Login: state => ({name: 'Login', params: {name: 'user', ...state.params}}),
  Tabs: state => ({
    ...state,
    stack: [
      {name: 'Home', params: {}},
      {name: 'NewPost', params: {}},
      {name: 'Profile', params: {}},
    ],
  }),
});

setNavigators({
  App: newStackNavigator(gouter, {
    names: ['Login', 'LoginConfirmation', 'Tabs'],
  }),
  Tabs: newTabNavigator(gouter, {
    names: ['Home', 'NewPost', 'Profile'],
  }),
});

setState({name: 'App', params: {}});

/**
 * @typedef {{[Name in keyof gouter['routeMap']]: React.FC<
 * import('gouter/native').ScreenProps<gouter['state'] & {name: Name}>
 * >}} ScreenMap
 */

export {goTo, goBack, replace, getState, listen, encodePath};
