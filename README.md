# Gouter

Tiny navigation library for React Native with simple API and rich features.

## Installation

`npm i gouter`

## Available Imports

```js
import Gouter from 'gouter'; // router
import GouterNative from 'gouter/native'; // React Native component
import { newStackNavigator, newTabNavigator } from 'gouter/navigators'; // navigators
```

## Usage

### Part 1: Router

Here you will define available routes, rules for navigation and export router methods.

#### Define routes

Pass your map of routes to Gouter as object where keys are route names and values are parameters
definitions. Parameters definitions are objects where keys are parameter names and values are
strings (`'login'`), tuples (`['/', /\d+/]`) or objects with decode/encode methods
`{ decode: parseFloat, encode: String }`. Strings are used only as required parts to encode/decode
urls and will not be presented as state parameters. Tuples are used for url paths and will be
presented as required state parameters. Objects are used for url queries and will be presented as
optional state parameters.

```js
import Gouter from 'gouter';

const gouter = new Gouter({
  App: {
    _: '/',
  },
  LoginWithModal: {
    _: '/login-with-modal',
  },
  Login: {
    _: '/login',
    name: { decode: (str) => str, encode: (str) => str },
  },
  LoginModal: {
    _: '/login/modal',
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
  Post: {
    _: '/post',
  },
  Profile: {
    _: '/profile',
  },
});
```

#### Extract methods

Since Gouter is highly customizable it doesn't hide any methods and/or fields. You decide what you
will export from it's instance. However some parts are mandatory in order to use `GouterNative` like
`getState`, `listen`, `goBack`, `encodePath`.

```js
const {
  setState,
  setBuilders,
  setNavigators,
  goTo,
  goBack,
  getState,
  listen,
  replace,
  encodePath,
} = gouter;
```

#### Set Builders

Gouter `setBuilders` method customizes how stacks and params are created when you go to some state.
For each route you may define special function called `builder` which will be launched when you add
a state without `stack` field to your navigation. It accepts current raw state with list of all
parent states and returns updated state.

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

#### Set navigators

Gouter navigators is powerful mechanism to control navigation flow.

```js
import { newStackNavigator, newTabNavigator } from 'gouter/navigators';

setNavigators({
  App: newStackNavigator(gouter, {
    names: ['LoginWithModal', 'LoginConfirmation', 'Tabs'],
  }),
  LoginWithModal: newStackNavigator(gouter, {
    names: ['Login', 'LoginModal'],
  }),
  Tabs: newTabNavigator(gouter, {
    names: ['Home', 'Post', 'Profile'],
  }),
});
```

For convenience we imported ready navigators from `gouter/navigators`. The `navigator` is special
functions which accepts passed state or null, parent state (and rarely grandparents) and returns
modified parent state or `null`. In case of `null` parent navigator will try to modify it's state
and so on. You may create your own navigators for special needs, for example here you create a
navigator which fully replaces current stack with new state:

```js
const switchNavigator = (state, parent) => {
  if (state) {
    return { ...parent, stack: [state] };
  } else {
    return null;
  }
};
```

#### Set state

Before you add any listeners you should pass initial state:

```js
setState({ name: 'App', params: {} });
```

#### Add type for screens

This type will help you with type inference when you define screens:

```ts
export type State = (typeof gouter)['state'];
```

#### Export extracted methods

```js
export { goTo, goBack, replace, getState, setState, listen, encodePath };
```

### Part 2: Screens

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

### Part 3: App

#### Import

Add `GouterNative` and some mandatory parts from your Gouter instance (named `router` here) into
App:

```js
import GouterNative from 'gouter/native';
import { getState, goBack, goTo, listen, replace, encodePath, setState } from './router';
```

Before you define GouterNative config you need to add an animation. Here `animation` is special
function which receives animation props and returns react-native animated style or two. Animation
props are just `Animated.Value`'s:

- `index` is index relative to focused state index
- `width` is current component layout width
- `height` is current component layout height
- `focused`is 1 if focused and 0 otherwise
- `bounce` is to indicate first (bounce < 0) or last screen (bounce > 0) offset

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

Import screens and put them into `screenConfigMap` `component` field with required `stackAnimation`
and `stackAnimationDuration`. You may also define `stackSwipeDetection` and
`stackSwipeDetectionSize` to navigate between screens using swipe gestures. Each screen may have
custom config and even accepts functions `(state) => config` for advanced use cases.

```ts
import { ScreenConfigMap } from 'gouter/native';
import { State } from './router';

const stackAnimationDuration = 256;

const screenConfigMap: ScreenConfigMap<State> = {
  App: {
    component: App,
    stackAnimation: iOSAnimation,
    stackAnimationDuration,
    stackSwipeDetection: 'left',
    stackSwipeDetectionSize: 40,
  },
  LoginWithModal: {
    component: LoginWithModal,
    stackAnimation: modalAnimation,
    stackAnimationDuration: 256,
    stackSwipeDetection: 'vertical',
  },
  LoginModal: {
    component: LoginModal,
    stackAnimation: defaultAnimation,
    stackAnimationDuration,
  },
  Login: {
    component: Login,
    stackAnimation: defaultAnimation,
    stackAnimationDuration,
  },
  LoginConfirmation: {
    component: LoginConfirmation,
    stackAnimation: defaultAnimation,
    stackAnimationDuration,
  },
  Tabs: {
    component: Tabs,
    stackAnimation: defaultAnimation,
    stackAnimationDuration: 1256,
    stackSwipeDetection: 'horizontal',
  },
  Home: {
    component: Home,
    stackAnimation: defaultAnimation,
    stackAnimationDuration,
  },
  Post: {
    component: Post,
    stackAnimation: defaultAnimation,
    stackAnimationDuration,
  },
  Profile: {
    component: Profile,
    stackAnimation: defaultAnimation,
    stackAnimationDuration,
  },
};
```

Finally you create and export main app component. Here we pass things we defined before to
`GouterNative`. You may customize navigation behavior by `listen` function, for example you may
dismiss onscreen keyboard before each transition.

```js
const AppWrapper = () => {
  const [appState, setAppState] = useState(getState);

  useEffect(() => listen(setAppState), []);
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
      state={appState}
      screenConfigMap={screenConfigMap}
      encodePath={encodePath}
      goTo={goTo}
    />
  );
};

export default AppWrapper;
```

### Part 4: Navigation

Use exported methods from your router anywhere:

- `goTo` to navigate to state
- `goBack` to navigate back
- `replace` to replace target state for parameters and/or stack updates
- `go` for advanced use cases like navigate back twice and then go to some state etc.
