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
import Gouter 'gouter';

const gouter = new Gouter({
  // -> { name: "App", params: {} }
  App: {
    _: '/',
  },
  // -> { name: "Login", params: {} }
  Login: {
    _: '/login',
  },
  // -> { name: "LoginConfirmation", params: { phone: string } }
  LoginConfirmation: {
    _: '/login-confirmation',
    phone: ['/', /\d+/],
  },
  // -> { name: "Home", params: { minRating?: number | undefined } }
  Home: {
    _: '/home',
    minRating: {
      decode: parseFloat,
      encode: String,
    },
  },
});
```

#### Extract methods

Since Gouter is highly customizable it doesn't hide any methods and/or fields. You decide what you
will export from it's instance. However some parts are mandatory in order to use `GouterNative` like
`getState`, `listen`, `goBack`, `encodePath`.

```js
const { setState, newState, setHooks, goTo, goBack, getState, listen, replace, encodePath } =
  gouter;
```

#### Set Builders

Gouter `setBuilders` method customizes how stacks are created when you go to some state.

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

For convenience we imported ready navigators from `gouter/navigators`. However you may easily create
your own hooks for special needs:

```js

```

#### Set state

Before you add any listeners you should pass initial state:

```js
setState({ name: 'App', params: {} });
```

#### Add type for screens

This type will help you with type inference.

```js
/** @typedef {gouter['state']} State */
```

#### Export extracted methods

```js
export { goTo, goBack, replace, getState, listen, newState, encodePath };
```

### Part 2: Screens

```js
/** @type {import('gouter/native').ScreenMap<import('./router').State>['App']} */
const App = ({ children }) => {
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

Import `GouterNative` and some mandatory parts from your Gouter instance (named `router` here) into
App:

```js
import GouterNative from 'gouter/native';
import { getState, listen, goBack, encodePath } from './router';
```

Import all your screens and put them into `screenMap`:

```js
import App from 'screens/App';
import Login from 'screens/Login';
import LoginConfirmation from 'screens/LoginConfirmation';
import Home from 'screens/Home';

/** @type {import('./router').ScreenMap} */
const screenMap = {
  App,
  Login,
  LoginConfirmation,
  Home,
};
```

You may define `defaultAnimation` used for transition effects between states by default. It is a
function which receives `Animated.Value` and returns animated style.

```js
/** @type {import('gouter/native').Animation} */
const defaultAnimation = (value) => ({
  opacity: value,
  transform: [
    {
      translateY: value.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
      }),
    },
    {
      scale: value.interpolate({
        inputRange: [0, 1],
        outputRange: [0.95, 1],
      }),
    },
  ],
});
```

You may also define `animationMap` used to customize transition effects for each route. It is a
object where key is route name and value is function which receives `Animated.Value` and returns
animated style.

```js
/** @type {Partial<Record<keyof import('router').ScreenMap, import('gouter/native').Animation>>} */
const animationMap = {
  Home: (value) => ({
    opacity: value,
  }),
};
```

Finally you create wrapper component:

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
