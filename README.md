# Gouter

Tiny navigation library for React Native with simple API and rich features.

## Installation

`npm i gouter`

## Available Imports

```js
import Gouter 'gouter'; // core
import GouterNative from 'gouter/native'; // React Native component
import * as hooks from 'gouter/hooks'; // hooks for routing
```

## Usage

### Part 1: Create router file

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

#### Extract and export methods

Since Gouter is highly customizable it doesn't hide any methods and/or fields. You decide what you
will export from it's instance. However some parts are mandatory in order to use `GouterNative` like
`getState`, `listen`, `goBack`, `encodePath`.

```js
const { setState, newState, setHooks, goTo, goBack, getState, listen, replace, encodePath } =
  gouter;

export { goTo, goBack, replace, getState, listen, newState, encodePath };
```

#### Set hooks

Gouter hooks is powerful mechanism to control navigation. You may customize each route behavior
through `onInit`, `shouldGoTo`, `onGoTo`, `shouldGoBack` and `onGoBack` hooks:

```js
import {
  shouldGoToForNames,
  onGoToInStack,
  shouldGoBackInStack,
  onGoBackInStack,
} from 'gouter/hooks';

setHooks({
  App: {
    onInit: (state) => ({ ...state, stack: [newState('Login', {})] }),
    shouldGoTo: shouldGoToForNames(gouter, ['Login', 'LoginConfirmation', 'Home']),
    onGoTo: onGoToInStack(gouter),
    shouldGoBack: shouldGoBackInStack(gouter),
    onGoBack: onGoBackInStack(gouter),
  },
});
```

For convenience we imported ready hooks creators from `gouter/hooks`. However you may easily create
your own hooks for special needs:

- `onInit(state)` is called when this route state is created using `newState` and here you may
  modify it's params and/or stack
- `shouldGoTo(state, parent)` checks if a state passed to `goTo` should be handled inside this route
  state (parent)
- `onGoTo(state, parent)` is called only when `shouldGoTo` passed and usually returns parent with
  modified stack
- `shouldGoBack(state, parent)` checks if `goBack` should be handled inside this route state
  (parent)
- `onGoBack(state, parent)` is called only when `shouldGoBack` passed and usually returns parent
  with modified stack

#### Set state

Before you add any listeners you should pass initial state:

```js
setState(newState('App', {}));
```

#### Add type for screens

This type will enable type inference for every screen component.

```js
/**
 * @typedef {{[Name in keyof gouter['routeMap']]: React.FC<
 * import('gouter/native').ScreenProps<gouter['state'] & {name: Name}>
 * >}} ScreenMap
 */
```

Usage:

```js
/** @type {import('./router').ScreenMap['LoginConfirmation']} */
const LoginConfirmation = ({}) => {
  // screen body
};
```

### Part 2: Add GouterNative to app

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
  // same state as in router updated through `listen`
  const [state, setState] = useState(getState);

  // to receive fresh state from router and store it locally
  useEffect(() => listen(setState), []);

  // to handle hardware back press
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
      screenMap={screenMap}
      state={state}
      encodePath={encodePath}
      animationDuration={256}
      defaultAnimation={defaultAnimation}
      animationMap={animationMap}
      onSwipeBack={goBack}
    />
  );
};

export default AppWrapper;
```
### Part 3: Navigate

Use exported methods from your router anywhere:
- `goTo` to navigate to state 
- `goBack` to navigate back
- `replace` to replace target state for parameters and/or stack updates 
- `go` for advanced use cases like navigate back twice and then go to some state etc.
