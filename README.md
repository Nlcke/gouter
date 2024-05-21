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
import { GouterNavigation } from 'gouter'; // navigation tools
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

They provide everything you will need for App with multiple screens.

## Architecture

Gouter completely separates state, navigation and view (like GouterNative). It also has own linking.

### State

The core of gouter is `GouterState` class from `gouter/state` module. This is where current
information about params, nested stacks and focused indexes is stored. It has many methods to update
that info, like `setParams`, `setStack`, `setFocusedIndex` etc. And of course to interact with views
and/or to launch effects it has `listen` method which subscribes listeners to state changes.

The `GouterState` is tree-like structure and it may be created manually using
`new GouterState(name, params, stack, focusedIndex)` constructor. The `name` is more like unique tag
which is linked to `params` and screens in views. The `stack`, which is simple Javascript array, is
used to nest other states as deep as you need which is necessary for stack and tab navigation. Since
Gouter supports tab navigation it has `focusedIndex` field which points to the index of focused
state in state stack.

Please note, every state is unique object which is never recreated on update and it's methods mutate
`params`, `stack` and `focusedIndex` fields. However `params` and `stack` objects are readonly by
design and you shouldn't mutate them and `focusedIndex` directly, otherwise Gouter will not know
about changes and state listeners wouldn't be notified.

Every time you update state fields via methods, GouterState collects that updated states in special
`modifiedStates` set and schedules listeners notification on next Javascript engine tick. Therefore
you may safely modify any number of states and make chained updates on same state without
performance penalties. In case when you need synchronous updates you may use `GouterState.notify`
static method to force listeners notification.

`GouterState` has unique focus system. Usually every time you call `setStack` method current
`focusedIndex` resets to last stack index. But that doesn't work well for tab navigation. So instead
of following `setFocusedIndex` call, you may mark stack state as focused BEFORE `setStack`: just use
`withFocus` method on that state. This method adds states to special set which is checked on
`setStack` call.

Note: since every state is unique and may have only one parent when in a stack, whenever you put
same state into different stack it will be cloned i.e. replaced by new instance with same fields.

Full API is at https://nlcke.github.io/gouter/classes/state.GouterState.html.

### Navigation

Although GouterState is enough for manual navigation via `setStack` method, it is more convenient to
set navigation rules instead. Gouter has `GouterNavigation` class from `gouter` module for that
purpose. It's constructor is simple: `new GouterNavigation(routes, name, params)`. The returned
instance contains root state and navigation tools in the form of methods. All methods are
automatically bound when you create new instance of `GouterNavigation` so you may export root state
and tools of destructured instance at once without manual bindings.

- `rootState` is central state which is based on passed `name` and `params` to constructor
- `create(name, params, [stack], [focusedIndex])` is like `new GouterState` but with `builder`
  support
- `goTo(name, params, [options])` navigates to nearest state with same `name`
- `goBack()` navigates one step back using current navigator
- `getFocusedState()` returns current innermost focused state of root state
- `replaceFocusedState(state)` replaces current innermost focused state of root state

All the hard work happens when you define routes. The route is set of optional rules for each state
in the object form:

- `navigator` defines how stack states manipulated on `goTo` and `goBack`
- `allowed` is list of state names which are allowed to be in stack when `goTo` used
- `blocker` may block any navigation via `goTo` or `goBack` from current state
- `builder` describes how to initialize state when it's created
- `redirector` is a chain of `goTo` calls to restore parent states for nested states
- `path` is object describing how to convert states to url paths and back
- `query` is object describing how to convert states' optional params to url queries and back

You may use one of builtin Gouter navigators from `gouter/navigators` module or define own navigator
with following template:

```ts
import { Navigator } from 'gouter';

const navigator: Navigator<Config> = (parentState, toState, route) => {
  // `goTo` is used and `toState` is already exists in parent stack
  if (toState && toState.parent) {
    // create next stack and modify it, `toState` will be focused automatically
    const nextStack = parentState.stack.slice();
    return nextStack;
  }
  // `goTo` is used and `toState` is not in parent stack
  if (toState) {
    // create next stack and insert `toState` into it, it will be auto focused
    const nextStack = parentState.stack.slice();
    return nextStack;
  }
  // `goBack` is used, you should manually focus on some state
  if (stack.length > 1) {
    // create next stack and call `withFocus` on stack state which should be focused
    // without that call last state in stack will be focused
    const nextStack = parentState.stack.slice();
    return nextStack;
  }
  // return `null` whenever you want to pass navigation handling to outer navigator
  return null;
};
```

Please note, you should always define `allowed` state names if you use `navigator` field, otherwise
`goTo` will not work for state stack.

Full API is at https://nlcke.github.io/gouter/classes/index.GouterNavigation.html.

### View

Currently Gouter only supports React Native to render screens. The screen is React component which
accepts two props: Gouter `state` and React `children`. Screens are rerendered when their `state`s
are updated and as usual when some React hook triggers component update. Screens with own non-empty
stacks also receive children which should be placed somewhere in screen component to be visible.

To start render screens you should pass props to `GouterNative` component from `gouter/native` like
this:

```tsx
<GouterNative
  state={rootState}
  routes={routes}
  screenConfigs={screenConfigs}
  defaultOptions={defaultOptions}
  reanimated={reanimated}
/>
```

- `rootState` is top state which contains any other state
- `routes` is set of rules for navigation, state initialization, linking etc
- `screenConfigs` describe how to animate screens and handle gestures
- `defaultOptions` are defaults used when you don't want to customize each screen
- `reanimated` should be true if you want to use
  [reanimated](https://docs.swmansion.com/react-native-reanimated/) module for animations

Full API is at https://nlcke.github.io/gouter/functions/native.GouterNative.html.

This module also has useful hooks:

- `useGouterState(routes)` returns current gouter state from nearest provider if it's name is in
  routes or null otherwise
- `useIsFocused()` returns true if gouter state from nearest provider is focused in parent stack.
- `useIsRootFocused()` returns true if gouter state from nearest provider and it's parents are
  focused till root state
- `useIsRootStale()` returns true if gouter state from nearest provider or it's parents were removed
  from root state
- `useIsStale()` returns true if gouter state from nearest provider was removed from parent stack

And some functions to animate screen elements together with screen itself:

- `getAnimatedValues(state)` returns animated values like index, width, height
- `getReanimatedValues(state)` returns reanimated values like index, width, height

Full API is at https://nlcke.github.io/gouter/modules/native.html

### Linking

`GouterLinking` class is located at `gouter/linking`. It's only purpose is to encode Gouter states
into urls and decode them back which is useful to create and/or open a link for some screen. To get
it's methods you create new instance via `new GouterLinking(routes, create)` where routes is set of
rules with `path`/`query` fields and `create` is usually a method from `GouterNavigation` instance
to create new states using `builder` functions from routes. Every method of that instance is
automatically bound, so you don't need to do this manually. Main methods are:

- `decodeUrl(url)` creates state from url or returns null if no route matched
- `encodeUrl(state)` creates url from state using it's name and params

To make decoding/encoding work each route in passed `routes` should contain `path` and optionally
`query` fields. They should be objects where `path` contains only special and required param keys
while `query` is only for optional param keys. Special keys in `path` started with underscore (`_`)
represent static parts of url path and should contain string. Param keys should contain objects with
[`ParamDef` type](https://nlcke.github.io/gouter/types/index.ParamDef.html). The order of keys in
object matters because url path/query will be constructed exactly in same order. Some examples of
routes with linking:

```ts
const routes = {
  Home: {
    path: {
      _: 'home',
    },
  },
  // login/0123456789
  LoginConfirmation: {
    path: {
      _: 'login',
      phone: {},
    },
  },
  // profile/123?tab=subscribers
  Profile: {
    path: {
      _: 'profile',
      id: {},
    },
    query: {
      tab: {},
    },
  },
};
```

## Setup

The following setup is recommended and describes how to organize configuration files to make
`GouterNative` work. Let's create `router` folder in `src` with following files:

- `animations` for Animated or Reanimated animations which are passed to `view`
- `config` for type with state names and their parameters
- `index` for routes, navigation methods and utils
- `view` for default options and screen configurations

### Config

Since Gouter is strongly typed first you should describe Gouter configuration in separate file. The
configuration should be a record where key is route name and value is object with available
parameters for that route. This allows to navigate between fully typed screens using that route name
as unique identifier and update only existing screen parameters. For example, let's define following
configuration in some `config.ts` or `config.d.ts` file:

```ts
export type Config = {
  AppStack: {};
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

Gouter doesn't make a difference between screens and screen navigators. So new `state` for
LoginConfirmation screen using above config will have `state.name` equal to `'LoginConfirmation'`
and `state.params.phone` with `string` type.

### Router (index)

Import following classes, functions and types to create own navigation:

```ts
import { GouterNavigation, Routes } from 'gouter';
import { newStackNavigator, newTabNavigator } from 'gouter/navigators';
import { GouterLinking } from 'gouter/linking';
import { useGouterState, GouterScreen } from 'gouter/native';
import { Config } from 'router/config';
import { GouterState } from 'gouter/state';
```

Now we have to define how we navigate between screens. We pass `Config` type from previous step to
imported `Routes` to have strongly typed routes:

```ts
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

Then let's pass that routes to `GouterNavigation` along with root state name and params. We also
export everything from destructured instance for convenience:

```ts
export const { rootState, create, goBack, goTo, getFocusedState, replaceFocusedState } =
  new GouterNavigation(routes, 'AppStack', {});
```

Add this line if you need to encode/decode urls and don't forget to describe `path`/`query` fields
in routes to make it work:

```ts
export const { decodeUrl, encodeUrl } = new GouterLinking(routes, create);
```

If you ever need to access Gouter state from screen component and you don't want to import both
`useGouterState` and `routes` you may create more convenient hook:

```ts
export const useScreenState = () => useGouterState(routes);
```

Let's also add two useful types here to narrow builtin Gouter ones. The `State` type maybe helpful
if you pass Gouter state to functions and the `Screen` type is used to type screen components.

```ts
export type State<N extends keyof Config = keyof Config> = GouterState<Config, N>;

export type Screen<N extends keyof Config> = GouterScreen<Config, N>;
```

### Screens

Add that custom Screen type from your router file to each screen component to make it fully typed:

```tsx
import { Screen } from 'router';

const App: Screen<'App'> = ({ children }) => {
  return <View style={{ flex: 1 }}>{children}</View>;
};
```

```tsx
import { Screen } from 'router';

const Profile: Screen<'Profile'> = ({ state }) => {
  return <Text>{state.name}</Text>;
};
```

Each screen receives two props: typed `state` and React `children`. You may use hooks from
`gouter/native` module in screens and components to get current state and detect if it's focused or
stale.

### Animations

Gouter supports animations based on Animated and Reanimated. It's up to you which one to use for
App, but if you want to use Reanimated then you should install and configure it first. Both
`Animation` and `Reanimation` are functions which accept set of Animated and Shared values
accordingly. Those values are:

- `index` is value usually in range between -1 and 1 where 0 means screen is fully focused
- `width` - width of current screen container in pixels
- `height` - height of current screen container in pixels

The main difference between them is how to work with values and what should be returned. Animated
accepts own styles while Reanimated accepts style updaters which are functions with type
`() => ViewStyle`. GouterNative supports animated backdrops so instead of single style or style
updater you may return a tuple with two styles or style updaters. In that tuple first element will
be used for backdrop style and animation while second one will be used for screen style and
animation. In case of single style or style updater only screen will be styled and animated while
backdrop will be fully transparent.

This is iOS-like Animated animation:

```ts
import { Animation } from 'gouter/native';

export const iOSAnimation: Animation = ({ index, width }) => [
  {
    backgroundColor: 'black',
    opacity: index.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 0.2, 0],
    }),
  },
  {
    transform: [
      {
        translateX: Animated.multiply(
          width,
          index.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-0.25, 0, 1],
          }),
        ),
      },
    ],
  },
];
```

And this is iOS-like Reanimated animation. Please note, each style updater should contain
`'worklet'` directive in order to work on UI thread which is required for reanimated module.

```ts
import { Reanimation } from 'gouter/native';
import { interpolate } from 'react-native-reanimated';

export const iOSReanimation: Reanimation = ({ index, width }) => [
  () => {
    'worklet';
    return {
      backgroundColor: 'black',
      opacity: interpolate(index.value, [-1, 0, 1], [0, 0.2, 0]),
    };
  },
  () => {
    'worklet';
    return {
      transform: [
        {
          translateX: interpolate(index.value, [-1, 0, 1], [-0.25 * width.value, 0, width.value]),
        },
      ],
    };
  },
];
```

In that animations we change opacity for black backdrop when it's not focused and move screen
horizontally.

You may customize screen animations even further by using component animations. In order to
synchronize them with screen animations `gouter/native` module provides two functions:
`getAnimatedValues(state)` and `getReanimatedValues(state)`. Which one to use depends on
`reanimated` boolean prop which you may pass to GouterNative component. This way you may get current
Gouter state in any screen component via `useGouterState(routes)` hook and pass it to that functions
to receive same values as in animations.

### View

Contains screen imports, default options and screen configs which should be exported and passed as
props to GouterNative component in App. This is where each screen should be imported and animations
with gestures should be configured. Each screen config contains required `screen` component with
fully optional `screenOptions` and `screenStackOptions`.

Each screen option is one of the following:

- `animation` is Animated animation
- `reanimation` is Reanimated animation
- `animationDuration` is animation duration in milliseconds
- `prevScreenFixed` turns off previous screen animation if enabled, useful for modals and drawers
- `swipeDetection` is one of predefined values to customize swipes for stacks, modals, tabs etc
- `animationEasing` accepts easing function to make animation nonlinear

GouterNative uses special system to calculate current screen options. That system first checks
screen option at `screenOptions`, then if the option is undefined it checks `screenStackOptions` of
parent screen and, if the option is still undefined it checks `defaultOptions`. This way you may
start with default options, then add some stack options to overwrite default options and then
finally overwrite stack options by some screen options if needed.

Sometimes you need to modify screen or stack options. In this case you may use computable options
which is a function which accepts state and returns screen options. Whenever it's state is updated
the new options are calculated and used. Be careful with `animations`/`reanimations`, it may hurt
app performance if you will create new animations on the fly instead of using predefined ones.

```ts
import { ScreenConfigs, ScreenOptions } from 'gouter/native';
import { Config } from 'router/config';
// ...screen imports
// ...animation imports

export const defaultOptions: ScreenOptions = {
  animation: iOSAnimation,
  reanimation: iOSReanimation,
  animationDuration: 350,
  swipeDetection: 'left-edge',
  animationEasing: Easing.elastic(0.25),
};

export const screenConfigs: ScreenConfigs<Config> = {
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
    screenOptions: ({ params: { animation } }) => ({
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
```

### App

Using above configurations let's edit App file:

```ts
import React, { useEffect, useState } from 'react';
import { GouterNative } from 'gouter/native';
import { StyleSheet, View, BackHandler, Keyboard } from 'react-native';
import { goBack, rootState, routes } from 'router';
import { defaultOptions, screenConfigs } from 'router/view';

const App = () => {
  useEffect(() => rootState.listen(Keyboard.dismiss), []);

  useEffect(() => {
    const onHardwareBackPress = () => {
      goBack();
      return true;
    };
    BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', onHardwareBackPress);
    };
  }, []);

  return (
    <View style={styles.container}>
      <GouterNative
        state={rootState}
        routes={routes}
        screenConfigs={screenConfigs}
        defaultOptions={defaultOptions}
        reanimated={true} // only if you need reanimated instead of Animated
      />
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

There are several things going on here. First we wrap our GouterNative element in View with flex 1
to fill whole screen. Then we add two `useEffect` calls. First one is to automatically hide keyboard
when root state updated. And second one is to handle hardware back press for Android.

## Alternatives

Currently Gouter is about custom animations and gestures, however if you need native Android and iOS
navigation experience then there are many other good libraries:

- https://github.com/react-navigation/react-navigation
- https://github.com/wix/react-native-navigation
- https://github.com/grahammendick/navigation
