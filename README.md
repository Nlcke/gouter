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

Currently Gouter supports React Native only to render screens.

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
