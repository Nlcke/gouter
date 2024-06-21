import {Easing} from 'react-native-reanimated';
import {
  drawerReanimation,
  iOSAnimation,
  iOSReanimation,
  modalAnimation,
  modalReanimation,
  tabAnimation,
  tabReanimation,
} from 'router/animations';
import {AppStack} from 'screens/AppStack';
import {Charts} from 'screens/Charts';
import {Home} from 'screens/Home';
import {Login} from 'screens/Login';
import {LoginConfirmation} from 'screens/LoginConfirmation';
import {LoginConfirmationStack} from 'screens/LoginConfirmationStack';
import {LoginDrawer} from 'screens/LoginDrawer';
import {LoginModal} from 'screens/LoginModal';
import {LoginStack} from 'screens/LoginStack';
import {Post} from 'screens/Post';
import {Profile} from 'screens/Profile';
import {Stats} from 'screens/Stats';
import {Tabs} from 'screens/Tabs';

/** @type {import('gouter/native').ScreenOptions} */
export const defaultOptions = {
  animation: iOSAnimation,
  reanimation: iOSReanimation,
  animationDuration: 1350,
  swipeDetection: 'left-edge',
  animationEasing: Easing.elastic(0.25),
};

/** @type {import('gouter/native').ScreenConfigs<Config>} */
export const screenConfigs = {
  AppStack: {
    screen: AppStack,
  },
  LoginStack: {
    screen: LoginStack,
  },
  LoginModal: {
    screen: LoginModal,
    screenOptions: {
      animation: modalAnimation,
      reanimation: modalReanimation,
      swipeDetection: 'vertical-full',
      prevScreenFixed: true,
    },
  },
  Login: {
    screen: Login,
  },
  Stats: {
    screen: Stats,
    screenOptions: ({params: {animation}}) => ({
      animation: animation === 'rotation' ? tabAnimation : iOSAnimation,
    }),
  },
  Charts: {
    screen: Charts,
    screenOptions: ({params: {animation}}) => ({
      animation: animation === 'rotation' ? tabAnimation : iOSAnimation,
    }),
  },
  LoginConfirmationStack: {
    screen: LoginConfirmationStack,
  },
  LoginConfirmation: {
    screen: LoginConfirmation,
  },
  LoginDrawer: {
    screen: LoginDrawer,
    screenOptions: {
      reanimation: drawerReanimation,
      prevScreenFixed: true,
      swipeDetection: 'horizontal-full',
    },
  },
  Tabs: {
    screen: Tabs,
    screenStackOptions: {
      animation: tabAnimation,
      reanimation: tabReanimation,
      swipeDetection: 'horizontal-full',
    },
  },
  Home: {
    screen: Home,
  },
  Post: {
    screen: Post,
  },
  Profile: {
    screen: Profile,
  },
};
