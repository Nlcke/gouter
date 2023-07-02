# ![icon](media/icon.png) Gouter

Tiny navigation library for React Native with simple API and rich features.

## Installation

`npm i gouter`

## Available Imports

```js
import Gouter from 'gouter'; // router
import GouterNative from 'gouter/native'; // React Native component
import { newStackNavigator, newTabNavigator } from 'gouter/navigators'; // navigators
```

## Examples

Gouter example for React Native is at `native/example`.

## Usage

### Part 1: Router

Here you will define available routes, rules for navigation and export router methods.

#### Define routes

Import Gouter and pass your routes to it as object where keys are route names and values are
parameters definitions. Routes not only help with type suggestions but define how to encode state to
url and decode it back. Parameters definitions are objects where keys are parameter names and values
are strings or objects with optional methods and flags. Please, note: the order of that parameter
definitions (except query parameters) matters for encoding/decoding.

Strings are used only as static path parameters to encode/decode urls (like `'login'`, `'tabs'`) and
will not be presented as state parameters, but used to convert states and urls. You may use any keys
for them, however it is recommended to prefer keys consisting of `_`, like in examples.

Objects are used for dynamic path and query parameters and will be presented as state `params` with
type of `decode` result (if any) or `string` by default. Each object may have following optional
properties: `path`, `req`, `list`, `encode`, `decode`. The `path` affects how state parameter is
encoded into url and how that url is decoded. If `path` is true then it will be path parameter (like
`123` in `profile/123`), otherwise it will be query parameter (like `hello` in `?search=hello`). The
`path` is also very important for React Native navigation because it is used to form unique key
which is used to distinguish similar states (like `profile/user1` and `profile/user2`). The `req`
makes state parameter type required if true, so `undefined` will not be allowed for it anymore and
you will need to always pass this param, but instead you will skip additional checks. The `list`
allows to pass any number of same parameters as an array (empty lists are allowed too). For path
params lists are encoded as `item1/item2/...` and for query params they look like
`param=item1&param=item2&param=...`. The `decode` and `encode` properties are optional functions
which define the type of state parameter (using `decode` return type) and the way how it is encoded
into an url (`encode`) and decoded back to a state (`decode`). You may use `ParamDef<T>` type to
define them before creating Gouter instance.

When you pass routes you should also define special required 'notFound' route with key `_` and `$`
param. It is used to handle situations when a state or an url is broken and cannot be
encoded/decoded normally. You may add 404 screen for it.

```js
import Gouter from 'gouter';
import { newStackNavigator, newTabNavigator } from 'gouter/navigators';

const gouter = new Gouter({
  _: {
    $: { path: true, req: true, list: true },
  },
  App: {
    _: '/',
  },
  LoginStack: {
    _: '/login-stack',
  },
  Login: {
    _: '/login',
    name: { path: true },
  },
  LoginModal: {
    _: '/login/modal',
  },
  LoginConfirmationStack: {
    _: '/login-confirmation-stack',
  },
  LoginConfirmation: {
    _: '/login-confirmation',
    phone: { path: true },
  },
  LoginDrawer: {
    _: '/login/drawer',
  },
  Tabs: {
    _: '/tabs',
  },
  Home: {
    _: '/home',
  },
  Post: {
    _: '/post',
  },
  Profile: {
    _: '/profile',
  },
});
```

Each Gouter instance uses strictly typed tree-like structure called `State` to represent current
router state (called `rootState`) and that's enough to represent any complex navigation state
including tabs, drawers, modals etc.

```ts
type State<Routes> = {
  name: string; // unique route name
  params: Record<string, any>; // path and query params
  stack?: State[]; // optional list of inner states
  index?: number; // optional index of focused state in stack
};
```

#### Extract methods

Since Gouter is highly customizable it doesn't hide most of it's methods and/or fields and Gouter
class may be even extended to redefine them all. You decide what you will export from it's instance.
However some parts are mandatory in order to use `GouterNative` like `getRootState`, `listen`,
`goBack`, `encodePath`.

```js
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
  encodePath,
} = gouter;
```

#### Set navigators

Gouter navigators is powerful mechanism to control navigation flow.

```js
setNavigators({
  App: newStackNavigator(gouter, {
    names: ['LoginStack', 'LoginConfirmationStack', 'Tabs'],
  }),
  Tabs: newTabNavigator(gouter, {
    names: ['Home', 'Post', 'Profile'],
  }),
  LoginStack: newStackNavigator(gouter, {
    names: ['Login', 'LoginModal'],
  }),
  LoginConfirmationStack: newStackNavigator(gouter, {
    names: ['LoginConfirmation', 'LoginDrawer'],
  }),
});
```

For convenience we imported ready navigators from `gouter/navigators`. The `navigator` is special
function which accepts passed state or null, parent state (and rarely grandparents) and returns
modified parent state or `null`. In case of `null` parent navigator will try to modify it's state
and so on till the root state. You may create your own navigators for special needs, for example
navigator which fully replaces current stack with new state:

```ts
const switchNavigator: Navigator<any, any> = (state, parent) => {
  if (state) {
    return { ...parent, stack: [state] };
  } else {
    return null;
  }
};
```

#### Set Builders

Gouter `setBuilders` method customizes how stacks and params are created when you go to some state.
For each route you may define special function called `builder` which will be launched when you add
a state without `stack` field to your navigation. It accepts current raw state with list of all
parent states and returns updated state. When you use navigation methods they all build states and
you don't need to pass stacks each time to initialize some new state.

```js
setBuilders({
  App: (state) => ({ ...state, stack: [{ name: 'LoginWithModal', params: {} }] }),
  LoginWithModal: (state) => ({ ...state, stack: [{ name: 'Login', params: {} }] }),
  Login: (state) => ({ name: 'Login', params: { name: 'user', ...state.params } }),
  Tabs: (state) => ({
    ...state,
    stack: [
      { name: 'Home', params: {} },
      { name: 'Post', params: {} },
      { name: 'Profile', params: {} },
    ],
  }),
});
```

#### Set redirections

Gouter `setRedirections` method helps to simplify navigation via `goTo` and `go`. Instead of passing
multiple states into `go` method to focus on some deeply nested state you pass only target state.
This works by adding intermediate states from redirections when you use `go` or `goTo` methods and
you just need to describe that states in `setRedirections` for your target state name.

```js
setRedirections({
  Login: () => [{ name: 'LoginStack', params: {} }],
  LoginConfirmation: () => [{ name: 'LoginConfirmationStack', params: {} }],
});
```

#### Set state

Before you add any listeners you should pass initial root state. If your builders are set and you
didn't pass any `stack` they will be used to extend passed state. In this example we will get App
with fresh stack consisting of `LoginStack` and `Login` states.

```js
setRootState({ name: 'App', params: {} });
```

#### Add type for screens

This type will help you with type inference when you define screens:

```ts
export type State = (typeof gouter)['rootState'];
```

#### Export extracted methods

```js
export { goTo, goBack, replace, getRootState, setRootState, listen, encodePath };
```

### Part 2: Screens

Using `State` defined in `router` file and `ScreenMap` from `gouter/native` you may fully type each
screen:

```tsx
import { ScreenMap } from 'gouter/native';
import { State } from './router';

const App: ScreenMap<State>['App'] = ({ children }) => {
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
import { getState, goBack, goTo, listen, replace, encodePath, setState } from './router';
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
import { State } from './router';

const screenConfigMap: ScreenConfigMap<State> = {
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
      encodePath={encodePath}
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
- `go(...statesOrNulls)` for advanced use cases like navigate back twice and then go to some state
  etc.

The navigation is just a change of current root state via `setRootState` or other methods like `go`,
`goTo`, `goBack` and `replace` which call `setRootState` anyway. After that change gouter calculates
new state using builders defined by `setBuilders` method if option `disableBuilders` is not enabled.
Then compares states by `getAreStatesEqual` and if they are not equal it calls previously attached
listeners via `listen` to notify them about changes.
