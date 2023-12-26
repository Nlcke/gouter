import Gouter from 'gouter';
import {newStackNavigator, newTabNavigator} from 'gouter/navigators';

/** @type {import('gouter').Routes<GouterConfig>} */
const routes = {
  App: {
    navigator: newStackNavigator({}),
    allowed: ['LoginStack', 'LoginConfirmationStack', 'Tabs'],
    builder: state => ({
      ...state,
      stack: [{name: 'LoginStack', params: {}}],
    }),
  },
  LoginStack: {
    navigator: newStackNavigator({}),
    allowed: ['Login', 'LoginModal'],
    builder: state => ({
      ...state,
      stack: [{name: 'Login', params: {name: 'user'}}],
    }),
  },
  Login: {
    builder: state => ({...state, params: {name: 'user'}}),
    redirector: () => [{name: 'LoginStack', params: {}}],
  },
  LoginModal: {},
  LoginConfirmationStack: {
    navigator: newStackNavigator({}),
    allowed: ['LoginConfirmation', 'LoginDrawer'],
  },
  LoginConfirmation: {
    redirector: () => [{name: 'LoginConfirmationStack', params: {}}],
  },
  LoginDrawer: {},
  Tabs: {
    navigator: newTabNavigator({}),
    allowed: ['Home', 'Post', 'Profile'],
    builder: state => ({
      ...state,
      stack: [
        {name: 'Home', params: {}},
        {name: 'Post', params: {}},
        {name: 'Profile', params: {}},
      ],
    }),
  },
  Home: {},
  Post: {},
  Profile: {},
};

const gouter = new Gouter(routes, {name: 'App', params: {}});

const {
  setRootState,
  goTo,
  goBack,
  replace,
  getRootState,
  listen,
  getStateKey,
  batch,
} = gouter;

export {
  goTo,
  goBack,
  replace,
  getRootState,
  setRootState,
  listen,
  getStateKey,
  batch,
};
