# ![icon](media/icon.png) Gouter

Tiny navigation library for React Native with simple API and rich features.

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

## Examples

Gouter example for React Native is at `native/example`.

## Available Imports

Gouter consists of multiple modules:

```js
import { GouterNavigation } from 'gouter'; // navigation
import { GouterLinking } from 'gouter/linking'; // url encoding and decoding
import { GouterState } from 'gouter/state'; // state
import { newStackNavigator, newTabNavigator, newSwitchNavigator } from 'gouter/navigators'; // navigators
import {
  GouterNative,
  useGouterState,
  getAnimatedValues,
  getReanimatedValues,
  useIsFocused,
  useIsStale,
  useIsRootFocused,
  useIsRootStale,
} from 'gouter/native'; // React Native component
```
