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

Gouter completely separates state, navigation and view (like GouterNative).

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
instance contains root state and navigation tools:

- `rootState` is central state which is based on passed `name` and `params` to constructor
- `create(name, params, [stack], [focusedIndex])` is like `new GouterState` but with `builder`
  support
- `goTo(name, params, [options])` navigates to nearest state with same `name`
- `goBack()` navigates one step back using current navigator
- `getFocusedState()` returns current innermost focused state of root state
- `replaceFocusedState(state)` replaces current innermost focused state of root state

All the hard work happens when you define routes.

### View

Currently Gouter supports React Native only to render screens.

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
  Login: {};
  LoginConfirmation: {
    phone: string;
  };
  Home: {};
};
```

Gouter doesn't make a difference between screens and screen navigators. So new `state` for
LoginConfirmation screen using above config will have `state.name` equal to `'LoginConfirmation'`
and `state.params.phone` with `string` type.

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
