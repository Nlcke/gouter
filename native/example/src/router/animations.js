import {Animated} from 'react-native';
import {interpolate} from 'react-native-reanimated';

/** @type {import('gouter/native').Animation} */
export const tabAnimation = ({index, width}) => ({
  opacity: index.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 1, 0],
  }),
  transform: [
    {
      translateX: Animated.multiply(width, index),
    },
    {
      scale: index.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0.9, 1, 0.9],
      }),
    },
    {
      rotate: index.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-30deg', '0deg', '30deg'],
      }),
    },
  ],
});

/** @type {import('gouter/native').Reanimation} */
export const tabReanimation =
  ({index, width}) =>
  () => {
    'worklet';
    return {
      transform: [
        {
          translateX: interpolate(
            index.value,
            [-1, 0, 1],
            [-width.value, 0, width.value],
          ),
        },
      ],
    };
  };

/** @type {import('gouter/native').Animation} */
export const iOSAnimation = ({index, width}) => [
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

/** @type {import('gouter/native').Reanimation} */
export const iOSReanimation = ({index, width}) => [
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
          translateX: interpolate(
            index.value,
            [-1, 0, 1],
            [-0.25 * width.value, 0, width.value],
          ),
        },
      ],
    };
  },
];

/** @type {import('gouter/native').Animation} */
export const drawerAnimation = ({index, width}) => [
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
            outputRange: [0, 0, 1],
          }),
        ),
      },
    ],
  },
];

/** @type {import('gouter/native').Reanimation} */
export const drawerReanimation = ({index, width}) => [
  () => {
    'worklet';
    return {
      backgroundColor: 'black',
      opacity: interpolate(index.value, [-1, 0, 1], [0, 0.5, 0]),
    };
  },
  () => {
    'worklet';
    return {
      transform: [
        {
          translateX:
            width.value * interpolate(index.value, [-1, 0, 1], [0, 0, 1]),
        },
      ],
    };
  },
];

/** @type {import('gouter/native').Animation} */
export const modalAnimation = ({index, height}) => [
  {
    backgroundColor: 'black',
    opacity: index.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 0.5, 0],
    }),
  },
  {
    transform: [
      {
        translateY: Animated.multiply(
          height,
          index.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [0, 0, 1],
          }),
        ),
      },
    ],
  },
];

/** @type {import('gouter/native').Reanimation} */
export const modalReanimation = ({index, height}) => [
  () => {
    'worklet';
    return {
      backgroundColor: 'black',
      opacity: interpolate(index.value, [-1, 0, 1], [0, 0.5, 0]),
    };
  },
  () => {
    'worklet';
    return {
      transform: [
        {
          translateY:
            height.value * interpolate(index.value, [-1, 0, 1], [0, 0, 1]),
        },
      ],
    };
  },
];
