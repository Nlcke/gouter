import Gouter from 'gouter';
import {newStackNavigator, newTabNavigator} from 'gouter/navigators';

const gouter = new Gouter({
  App: {
    _: '/',
  },
  LoginWithModal: {
    _: '/login-with-modal',
  },
  Login: {
    _: '/login',
    name: {decode: str => str, encode: str => str},
  },
  LoginModal: {
    _: '/login/modal',
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
  goTo,
  goBack,
  getState,
  listen,
  replace,
  encodePath,
} = gouter;

setBuilders({
  App: state => ({...state, stack: [{name: 'LoginWithModal', params: {}}]}),
  LoginWithModal: state => ({...state, stack: [{name: 'Login', params: {}}]}),
  Login: state => ({name: 'Login', params: {name: 'user', ...state.params}}),
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
    names: ['LoginWithModal', 'LoginConfirmation', 'Tabs'],
  }),
  LoginWithModal: newStackNavigator(gouter, {
    names: ['Login', 'LoginModal'],
  }),
  Tabs: newTabNavigator(gouter, {
    names: ['Home', 'Post', 'Profile'],
  }),
});

setState({name: 'App', params: {}});

/** @typedef {gouter['state']} State */

export {goTo, goBack, replace, getState, setState, listen, encodePath};
