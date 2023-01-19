import Gouter from 'gouter';
import {
  shouldGoToForNames,
  onGoToInStack,
  shouldGoBackInStack,
  onGoBackInStack,
  onGoToInTabs,
  shouldGoBackInTabs,
  onGoBackInTabs,
} from 'gouter/hooks';

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
  newState,
  setHooks,
  goTo,
  goBack,
  getState,
  listen,
  replace,
  encodePath,
} = gouter;

setHooks({
  App: {
    onInit: state => ({...state, stack: [newState('Login', {})]}),
    shouldGoTo: shouldGoToForNames(gouter, [
      'Login',
      'LoginConfirmation',
      'Tabs',
    ]),
    onGoTo: onGoToInStack(gouter),
    shouldGoBack: shouldGoBackInStack(gouter),
    onGoBack: onGoBackInStack(gouter),
  },
  Login: {
    onInit: state => ({name: 'Login', params: {name: 'user', ...state.params}}),
  },
  Tabs: {
    onInit: state => ({
      ...state,
      stack: [
        newState('Home', {}),
        newState('NewPost', {}),
        newState('Profile', {}),
      ],
    }),
    shouldGoTo: shouldGoToForNames(gouter, ['Home', 'NewPost', 'Profile']),
    onGoTo: onGoToInTabs(gouter),
    shouldGoBack: shouldGoBackInTabs(gouter, 'Profile'),
    onGoBack: onGoBackInTabs(gouter, 'Profile'),
  },
});

setState(newState('App', {}));

/**
 * @typedef {{[Name in keyof gouter['routeMap']]: React.FC<
 * import('gouter/native').ScreenProps<gouter['state'] & {name: Name}>
 * >}} ScreenMap
 */

export {goTo, goBack, replace, getState, listen, newState, encodePath};
