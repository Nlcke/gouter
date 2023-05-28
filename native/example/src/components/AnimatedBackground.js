import React, {useRef, memo, useLayoutEffect, useMemo} from 'react';
import {Animated, StyleSheet} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

/**
 * @typedef {{
 * value: number
 * maxValue: number
 * gradient: import('react-native-linear-gradient').LinearGradientProps
 * }} AnimatedBackgroundProps
 */

/** @type {React.FC<AnimatedBackgroundProps>} */
const AnimatedBackground = ({value, maxValue, gradient}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const toValue = value / maxValue;

  useLayoutEffect(() => {
    Animated.spring(animatedValue, {
      toValue,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  }, [animatedValue, toValue]);

  /** @type {Animated.WithAnimatedValue<import('react-native').ViewStyle>} */
  const style = useMemo(
    () => ({
      ...StyleSheet.absoluteFillObject,
      opacity: animatedValue,
      transform: [
        {
          scale: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [2, 1],
          }),
        },
      ],
    }),
    [animatedValue],
  );

  /** @type {import('react-native').ViewStyle} */
  const gradientStyle = useMemo(() => ({flex: 1}), []);

  return (
    <Animated.View style={style}>
      <LinearGradient {...gradient} style={gradientStyle} />
    </Animated.View>
  );
};

export default memo(AnimatedBackground);
