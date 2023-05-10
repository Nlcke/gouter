import Gouter from 'gouter';
import {newStackNavigator, newTabNavigator} from 'gouter/navigators';

const gouter = new Gouter({
  App: {
    _: '/',
  },
  LoginStack: {
    _: '/login-stack',
  },
  Login: {
    _: '/login',
    name: {decode: str => str, encode: str => str},
  },
  LoginModal: {
    _: '/login/modal',
  },
  LoginConfirmationStack: {
    _: '/login-confirmation-stack',
  },
  LoginConfirmation: {
    _: '/login-confirmation',
    phone: ['/', /\d+/],
  },
  LoginDrawer: {
    _: '/login/drawer',
  },
  Tabs: {
    _: '/tabs',
  },
  Home: {
    _: '/home',
  },
  Post: {
    _: '/post',
  },
  Profile: {
    _: '/profile',
  },
});

const {
  setState,
  setBuilders,
  setNavigators,
  setRedirections,
  goTo,
  goBack,
  replace,
  getState,
  listen,
  encodePath,
} = gouter;

setRedirections({
  Login: () => [{name: 'LoginStack', params: {}}],
  LoginConfirmation: () => [{name: 'LoginConfirmationStack', params: {}}],
});

setBuilders({
  App: state => ({
    ...state,
    stack: [{name: 'LoginStack', params: {}}],
  }),
  LoginStack: state => ({
    ...state,
    stack: [{name: 'Login', params: {}}],
  }),
  Login: state => ({...state, params: {name: 'user'}}),
  Tabs: state => ({
    ...state,
    stack: [
      {name: 'Home', params: {}},
      {name: 'Post', params: {}},
      {name: 'Profile', params: {}},
    ],
  }),
});

setNavigators({
  App: newStackNavigator(gouter, {
    names: ['LoginStack', 'LoginConfirmationStack', 'Tabs'],
  }),
  Tabs: newTabNavigator(gouter, {
    names: ['Home', 'Post', 'Profile'],
  }),
  LoginStack: newStackNavigator(gouter, {
    names: ['Login', 'LoginModal'],
  }),
  LoginConfirmationStack: newStackNavigator(gouter, {
    names: ['LoginConfirmation', 'LoginDrawer'],
  }),
});

setState({name: 'App', params: {}});

/** @typedef {gouter['state']} State */

export {goTo, goBack, replace, getState, setState, listen, encodePath};
