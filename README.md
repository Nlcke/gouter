# ![icon](media/icon.png) Gouter

Tiny navigation library for React Native with simple API and rich features.

## Installation

`npm i gouter`

## Available Imports

```js
import Gouter from 'gouter'; // router
import GouterNative from 'gouter/native'; // React Native component
import { newStackNavigator, newTabNavigator, newSwitchNavigator } from 'gouter/navigators'; // navigators
```

## Examples

Gouter example for React Native is at `native/example`.

## Usage

### Part 1: Router

Here you will define types, available routes, rules for navigation and export router methods.

#### Define types

It is recommended to create separate file with `.ts` or `.d.ts` extension for Gouter types. You may
name it `routerTypes` for example. Add following type definitions to it (`.ts`):

```ts
import { State } from 'gouter';
import { ScreenMap } from 'gouter/native';

export type GouterConfig = {
  // your config
};

export type GouterState<T extends keyof GouterConfig = keyof GouterConfig> = State<GouterConfig, T>;

export type GouterScreen = ScreenMap<GouterState>;
```

`GouterState` may be used to create typed states and `GouterScreen` makes your screens fully typed.

Now fill your config. The keys of the config are screen names and their values are screen
parameters. Gouter instance will use it for type suggestions. For example:

```ts
export type GouterConfig = {
  App: {};
  LoginStack: {};
  Login: {
    name: string;
  };
  LoginModal: {};
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

#### Define routes

Now when you have that type definitions let's create Gouter instance. Add another file with `.ts` or
`.js` extension for Gouter types. You may name it `router` for example. Put following code to this
file (`.ts`):

```ts
import Gouter, { Routes } from 'gouter';
import { newStackNavigator, newTabNavigator, newSwitchNavigator } from 'gouter/navigators';
import { GouterConfig } from 'routerTypes';

const routes: Routes<GouterConfig> = {
  // your routes
};

const gouter = new Gouter(
  routes,
  // pass your initial state instead
  { name: 'App', params: {} },
);

const { setRootState, goTo, goBack, replace, getRootState, listen, getStateKey, batch } = gouter;

export { goTo, goBack, replace, getRootState, setRootState, listen, getStateKey, batch };
```

First we import the `Gouter` itself to create an instance and `Routes` type to define routes for
that instance. They are imported from `gouter` package which is router core. We already imported
`State` for type definitions, but it also has other useful types like `ParamDef`, `Navigator`,
`Route` for advanced use cases.

Next we fill routes using type suggestions from our `GouterConfig`. Everything in `Route` type is
optional, so at first you may pass empty objects `{}` to each route name. Like that:

```ts
const routes: Routes<GouterConfig> = {
  App: {},
  Login: {},
  Tabs: {},
};
```

However we cannot normally navigate without at least one navigator and list of allowed route names
for navigation. Always use `allowed` field otherwise `goTo` navigation method will not work. For
example:

```ts
const routes: Routes<GouterConfig> = {
  App: {
    navigator: newStackNavigator({}),
    allowed: ['LoginStack', 'LoginConfirmationStack', 'Tabs'],
  },
  Login: {},
  Tabs: {},
};
```

Here `newStackNavigator` call creates customized navigator instance. We imported it from
`gouter/navigators` which has good set of useful navigators. You may also write your own later using
`Navigator` type if they are not enough for your needs.

Let's check following example of routes:

```ts
const routes: Routes<GouterConfig> = {
  App: {
    navigator: newStackNavigator({}),
    allowed: ['LoginStack', 'LoginConfirmationStack', 'Tabs'],
    builder: (state) => ({
      ...state,
      stack: [{ name: 'LoginStack', params: {} }],
    }),
  },
  LoginStack: {
    navigator: newStackNavigator({}),
    allowed: ['Login', 'LoginModal'],
    builder: (state) => ({
      ...state,
      stack: [{ name: 'Login', params: { name: 'user' } }],
    }),
  },
  Login: {
    builder: (state) => ({ ...state, params: { name: 'user' } }),
    redirector: () => [{ name: 'LoginStack', params: {} }],
  },
  LoginModal: {},
  LoginConfirmationStack: {
    navigator: newStackNavigator({}),
    allowed: ['LoginConfirmation', 'LoginDrawer'],
  },
  LoginConfirmation: {
    redirector: () => [{ name: 'LoginConfirmationStack', params: {} }],
  },
  LoginDrawer: {},
  Tabs: {
    navigator: newTabNavigator({}),
    allowed: ['Home', 'Post', 'Profile'],
    builder: (state) => ({
      ...state,
      stack: [
        { name: 'Home', params: {} },
        { name: 'Post', params: {} },
        { name: 'Profile', params: {} },
      ],
    }),
  },
  Home: {},
  Post: {},
  Profile: {},
};
```

It has two new things: `builder` and `redirector` fields. The builder is a function which creates
updated state when that stack has no stack. So when you navigate to a route with `builder` and state
with empty stack it will be updated automatically, for example we may create stack for it. And
`redirector` goes through it's states to simplify our navigation to inner states.

#### Key generation

Some states should have unique id or ids. Imagine posts, users and stuff like that. So to
distinguish states Gouter needs `keygen` field in a route. It should be simple function which
returns unique string based on state params:

```ts
const UserRoute: Route<GouterConfig, 'User'> = {
  keygen: ({ id }) => id,
};
```

Now you may create multiple user states in same stack and easily navigate to them by their id.

#### About Gouter states

Each Gouter instance uses strictly typed tree-like structure called `State` to represent current
router state (called `rootState`) and that's enough for any complex navigation tree including tabs,
drawers, modals etc.

```ts
type State<GouterConfig> = {
  name: string; // unique route name
  params: Record<string, any>; // params for that route name
  stack?: State[]; // optional list of inner states
  index?: number; // optional index of focused state in stack
};
```

#### Create Gouter instance

When your routes are defined you should pass them into Gouter constructor alongside with initial
state. Created instance has useful methods to control navigation like `goTo`, `goBack` etc.

```ts
const gouter = new Gouter(
  routes,
  // pass your initial state instead
  { name: 'App', params: {} },
);
```

#### Export methods

Since Gouter is highly customizable it doesn't hide most of it's methods and/or fields and Gouter
class may be even extended to redefine them all. You decide what you will export from it's instance.
However some parts are mandatory in order to use `GouterNative` like `getRootState`, `listen`,
`goBack`, `getStateKey`.

```ts
const {
  setRootState,
  setBuilders,
  setNavigators,
  setRedirections,
  goTo,
  goBack,
  replace,
  getRootState,
  listen,
  getStateKey,
} = gouter;

export { goTo, goBack, replace, getRootState, setRootState, listen, getStateKey };
```

#### Decode and encode urls

Each state could be encoded into url and decoded back. To do this add `path` field to a route first:

```ts
const UserRoute: Route<GouterConfig, 'User'> = {
  path: {
    _: 'user',
    id: {},
  },
};
```

Methods `encodeUrl` and `decodeUrl` will now work and convert `{name: 'User', id: '17'}` into
`/user/17` and back. The `path` uses two types of keys: started with `_` and others. Keys with `_`
are static parts of url path, while others are dynamic. You may use any number keys.

There is also `query` field which works for optional params (while `path` works only for required
ones):

```ts
const UserRoute: Route<GouterConfig, 'User'> = {
  path: {
    _: 'user',
    id: {},
  },
  query: {
    postFilter: {},
  },
};
```

The `query` field doesn't need static parts and now we can convert state like
`{name: 'User', id: '17', postFilter: 'Jack'}` into `/user/17?postFilter=Jack`.

Don't forget to check `ParamDef` type used for all path/query params for other decode/encode
options.

### Part 2: Screens

Using `Screen` defined in `routerTypes` file and `ScreenMap` from `gouter/native` you may fully type
each screen:

```tsx
import { ScreenMap } from 'gouter/native';
import { GouterScreen, GouterState } from './routerTypes';

const App: GouterScreen['App'] = ({ children }) => {
  return (
    <View style={styles.container}>
      <Text>App</Text>
      {children}
    </View>
  );
};
```

Each screen receives this props:

- `state` is gouter `State` to use params, stack and index
- `isFocused` is true if this screen is focused
- `isStale`is true if this screen is removed from stack
- `animationProps` are props to additionally animate this screen elements
- `children` are React children containing inner states if any

### Part 3: App

#### Import

Add `GouterNative` and some mandatory parts from your Gouter instance at `router` into App:

```js
import GouterNative from 'gouter/native';
import { getState, goBack, goTo, listen, replace, getStateKey, setState } from './router';
```

#### Animations

Before you define GouterNative config you need to add an animation. Here `animation` is special
function which receives animation props and returns react-native animated style or two. Animation
props are just `Animated.Value`'s:

- `index` is index relative to focused state index
- `width` is current component layout width
- `height` is current component layout height
- `focused` is 1 if focused and 0 otherwise
- `bounce` is to indicate first (bounce < 0) or last screen (bounce > 0) offset
- `parentIndexes` is list of parent indexes (relative to their focused state index)

Usage example:

```ts
import { Animation } from 'gouter/native';

const iOSAnimation: Animation = ({ index, width }) => [
  {
    backgroundColor: 'black',
    opacity: index.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0.2, 0, 0],
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

#### Settings

When you have an animation you are ready to create stack settings. They define which animation to
use, how much time that animation lasts and how swipes works for each inner state in stack.

```ts
import { StackSettings } from 'gouter/native';

const defaultSettings: StackSettings = {
  animation: iOSAnimation,
  animationDuration: 256,
  swipeDetection: 'left',
  swipeDetectionSize: 40,
};
```

#### Screen config map

Import screens and put each of them into `screenConfigMap` as `component`. Then add required stack
settings as `stackSettings` for every screen with children. You may create shared stack settings by
using `StackSettings` type from `gouter/native`.

```ts
import { ScreenConfigMap } from 'gouter/native';
import { GouterState } from './routerState';

const screenConfigMap: ScreenConfigMap<GouterState> = {
  _: {
    component: NotFound,
  },
  App: {
    component: App,
    stackSettings: defaultSettings,
  },
  LoginStack: {
    component: LoginStack,
    stackSettings: modalSettings,
  },
  LoginModal: {
    component: LoginModal,
  },
  Login: {
    component: Login,
  },
  LoginConfirmationStack: {
    component: LoginConfirmationStack,
    stackSettings: drawerSettings,
  },
  LoginConfirmation: {
    component: LoginConfirmation,
  },
  LoginDrawer: {
    component: LoginDrawer,
  },
  Tabs: {
    component: Tabs,
    stack: tabsSettings,
  },
  Home: {
    component: Home,
  },
  Post: {
    component: Post,
  },
  Profile: {
    component: Profile,
  },
};
```

#### GouterNative

Finally you create and export main app component. Here we pass things we defined before to
`GouterNative`. You may customize navigation behavior by `listen` function, for example you may
dismiss onscreen keyboard before each transition.

```js
const AppWrapper = () => {
  const [state, setState] = useState(getRootState);

  useEffect(() => listen(setState), []);

  useEffect(() => listen(Keyboard.dismiss), []);

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
    <GouterNative
      state={state}
      screenConfigMap={screenConfigMap}
      getStateKey={getStateKey}
      goTo={goTo}
    />
  );
};

export default AppWrapper;
```

### Part 4: Navigation

Use exported methods from your `router` file anywhere:

- `setRootState(state)` to fully control current state
- `goTo(name, params, stack, index)` to navigate to some state (same as `go(state)`)
- `goBack()` to navigate back (same as `go(null)`)
- `replace(replacer)` to replace some inner states of root state
- `batch(() => {...})` to chain navigation actions without intermediate listeners' executions

The navigation is just a change of current root state via `setRootState` or other methods like
`goTo`, `goBack` and `replace` which call `setRootState` anyway. After that change gouter calculates
new state using builders defined by `builder` fields if option `disableBuilders` is not enabled. In
the end it calls previously attached listeners via `listen` to notify them about changes.
