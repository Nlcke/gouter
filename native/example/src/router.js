import Gouter from 'gouter';
import {newStackNavigator, newTabNavigator} from 'gouter/navigators';

const gouter = new Gouter({
  _: {
    $: {path: true, req: true, list: true},
  },
  App: {
    _: '/',
  },
  LoginStack: {
    _: '/login-stack',
  },
  Login: {
    _: '/login',
    name: {path: true},
  },
  LoginModal: {
    _: '/login/modal',
  },
  LoginConfirmationStack: {
    _: '/login-confirmation-stack',
  },
  LoginConfirmation: {
    _: '/login-confirmation',
    phone: {path: true},
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
  setRootState,
  setBuilders,
  setNavigators,
  setRedirections,
  goTo,
  goBack,
  replace,
  getRootState,
  listen,
  encodePath,
} = gouter;

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

setRedirections({
  Login: () => [{name: 'LoginStack', params: {}}],
  LoginConfirmation: () => [{name: 'LoginConfirmationStack', params: {}}],
});

setRootState({name: 'App', params: {}});

/** @typedef {gouter['rootState']} State */

export {goTo, goBack, replace, getRootState, setRootState, listen, encodePath};
