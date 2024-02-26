import {getNavigation} from 'gouter';
import {newStackNavigator, newTabNavigator} from 'gouter/navigators';

/** @type {import('gouter').Routes<Config>} */
export const routes = {
  App: {
    navigator: newStackNavigator({}),
    allowed: ['LoginStack', 'LoginConfirmationStack', 'Tabs'],
    builder: (_, create) => [create('LoginStack', {})],
  },
  LoginStack: {
    navigator: newStackNavigator({}),
    allowed: ['Login', 'LoginModal'],
    builder: (_, create) => [create('Login', {name: 'user'})],
  },
  Login: {
    redirector: (_, goTo) => goTo('LoginStack', {}),
  },
  LoginModal: {},
  LoginConfirmationStack: {
    navigator: newStackNavigator({}),
    allowed: ['LoginConfirmation', 'LoginDrawer'],
  },
  LoginConfirmation: {
    redirector: (_, goTo) => goTo('LoginConfirmationStack', {}),
  },
  LoginDrawer: {},
  Tabs: {
    navigator: newTabNavigator({}),
    allowed: ['Home', 'Post', 'Profile'],
    builder: (_, create) => [
      create('Home', {}),
      create('Post', {}),
      create('Profile', {}),
    ],
  },
  Home: {},
  Post: {},
  Profile: {},
};

export const {rootState, create, goBack, goTo} = getNavigation(
  routes,
  'App',
  {},
);
