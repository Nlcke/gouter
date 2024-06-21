import {GouterNavigation} from 'gouter';
import {newStackNavigator, newTabNavigator} from 'gouter/navigators';
import {GouterLinking} from 'gouter/linking';
import {useGouterState} from 'gouter/native';

/** @type {import('gouter').Routes<Config>} */
export const routes = {
  AppStack: {
    navigator: newStackNavigator(),
    allowed: [
      'LoginStack',
      'LoginConfirmationStack',
      'Tabs',
      'Stats',
      'Charts',
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
  Charts: {},
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

export const {
  rootState,
  create,
  goBack,
  goTo,
  getFocusedState,
  replaceFocusedState,
} = new GouterNavigation(routes, 'AppStack', {});

export const {decodeUrl, encodeUrl} = new GouterLinking(routes, create);

export const useScreenState = () => useGouterState(routes);

/**
 * @template {keyof Config} [N = keyof Config]
 * @typedef {import('gouter/state').GouterState<Config, N>} State
 */

/**
 * @template {keyof Config} N
 * @typedef {import('gouter/native').GouterScreen<Config, N>} Screen
 */
