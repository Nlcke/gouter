# ![icon](media/icon.png) Gouter

Tiny navigation library for React Native with simple API and rich features. It allows to build
screens using fully customizable animations and gestures with convenient navigation between them.

## Installation

`npm i gouter`

### Reanimated installation (optional)

`GouterNative` component uses `Animated` module from `react-native` for animations by default,
however it also supports
[`react-native-reanimated`](https://docs.swmansion.com/react-native-reanimated/). Reanimated module
supports 120 FPS and has more customizable native animations. In order to install and configure it
please follow the doc:
https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/. Then you may
use it with `GouterNative` by passing `reanimation` to screen options and access shared values via
`getReanimatedValues` function.

## API documentation

https://nlcke.github.io/gouter/

## Examples

Gouter example for React Native is at `native/example`.

## Available Imports

Gouter package consists of multiple tiny modules:

```js
import { GouterNavigation } from 'gouter'; // navigation
import { GouterLinking } from 'gouter/linking'; // url encoding and decoding
import { GouterState } from 'gouter/state'; // state
import { newStackNavigator, newTabNavigator, newSwitchNavigator } from 'gouter/navigators'; // navigators
import {
  GouterNative,
  getAnimatedValues,
  getReanimatedValues,
  useGouterState,
  useIsFocused,
  useIsStale,
  useIsRootFocused,
  useIsRootStale,
} from 'gouter/native'; // React Native component
```

This modules provide everything you will need for App with multiple screens.

## Setup

### Config

Since Gouter is strongly typed first you should describe Gouter configuration in separate file. The
configuration should be a record where key is route name and value is object with available
parameters for that route. This allows to navigate between fully typed screens using that route name
as unique identifier and update only existing screen parameters. For example, let's define following
configuration in some `config.ts` or `config.d.ts` file:

```ts
type Config = {
  App: {};
  LoginStack: {};
  Login: {
    name: string;
  };
  LoginModal: {};
  Stats: {
    animation?: 'slide' | 'rotation';
  };
  LoginConfirmationStack: {};
  LoginConfirmation: {
    phone: string;
  };
  LoginDrawer: {};
  Tabs: {};
  Home: {};
  Post: {};
  Profile: {};
};
```

So new `state` for LoginConfirmation screen using above config will have `state.name` equal to
`'LoginConfirmation'` and `state.params.phone` with `string` type.

### Router

Now we have to define how we navigate between screens. We pass `Config` type from previous step to
imported `Routes` to have strongly typed routes:

```ts
import { Routes } from 'gouter';

export const routes: Routes<Config> = {
  App: {
    navigator: newStackNavigator(),
    allowed: ['LoginStack', 'LoginConfirmationStack', 'Tabs', 'Stats', 'LoginModal'],
    builder: (_, create) => [create('LoginStack', {})],
  },
  LoginStack: {
    navigator: newStackNavigator(),
    allowed: ['Login'],
    builder: (_, create) => [create('Login', { name: 'user' })],
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
    builder: (_, create) => [create('Home', {}), create('Post', {}), create('Profile', {})],
  },
  Home: {},
  Post: {},
  Profile: {},
};
```

If you ever need to access Gouter state from screen component and you don't want to import both
`useGouterState` and `routes` you may create more convenient hook:

```ts
import { useGouterState } from 'gouter/native';

export const useScreenState = () => useGouterState(routes);
```

Let's also add two useful types here to narrow builtin Gouter ones:

```ts
import { GouterState } from 'gouter/state';
import { GouterScreen } from 'gouter/native';

export type State<N extends keyof Config = keyof Config> = GouterState<Config, N>;

export type Screen<N extends keyof Config> = GouterScreen<Config, N>;
```

`State` type maybe helpful if you pass Gouter state to functions and `Screen` type is used to type
screen components.

## Alternatives

Currently Gouter is about custom animations and gestures, however if you need native Android and iOS
navigation experience then there are many other good libraries:

- https://github.com/react-navigation/react-navigation
- https://github.com/wix/react-native-navigation
- https://github.com/grahammendick/navigation
