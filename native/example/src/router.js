import {GouterNavigation} from 'gouter';
import {newStackNavigator, newTabNavigator} from 'gouter/navigators';
import {GouterLinking} from 'gouter/linking';

/** @type {import('gouter').Routes<Config>} */
export const routes = {
  App: {
    navigator: newStackNavigator(),
    allowed: [
      'LoginStack',
      'LoginConfirmationStack',
      'Tabs',
      'Stats',
      'LoginModal',
    ],
    builder: (_, create) => [create('LoginStack', {})],
  },
  LoginStack: {
    navigator: newStackNavigator(),
    allowed: ['Login'],
    builder: (_, create) => [create('Login', {name: 'user'})],
  },
  Login: {
    redirector: (_, goTo) => goTo('LoginStack', {}),
  },
  LoginModal: {},
  Stats: {},
  LoginConfirmationStack: {
    navigator: newStackNavigator(),
    allowed: ['LoginConfirmation', 'LoginDrawer'],
  },
  LoginConfirmation: {
    redirector: (_, goTo) => goTo('LoginConfirmationStack', {}),
  },
  LoginDrawer: {},
  Tabs: {
    navigator: newTabNavigator(),
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

export const {rootState, create, goBack, goTo} = new GouterNavigation(
  routes,
  'App',
  {},
);

export const {decodeUrl, encodeUrl} = new GouterLinking(routes, create);
