import React, {useMemo, useRef, memo, useEffect} from 'react';
import {Animated, Text} from 'react-native';
import AnimatedCascade from './AnimatedCascade';

/**
 * @typedef {{
 * value: string
 * duration: number
 * animation: import('./AnimatedCascade').CascadeAnimation
 * style?: import('react-native').ViewStyle
 * textStyle?: import('react-native').TextStyle
 * }} AnimatedTextProps
 */

/** @type {React.FC<AnimatedTextProps>} */
const AnimatedText = ({value, duration, animation, style, textStyle}) => {
  const animatedValue = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 0,
      useNativeDriver: true,
      duration,
    }).start();
  }, [animatedValue, duration]);

  const texts = useMemo(
    () =>
      value.split('').map((char, index) => (
        <Text key={value.slice(0, index)} style={textStyle}>
          {char}
        </Text>
      )),
    [textStyle, value],
  );

  /** @type {import('react-native').ViewStyle} */
  const containerStyle = useMemo(
    () => ({...style, flexDirection: 'row'}),
    [style],
  );

  return (
    <AnimatedCascade
      style={containerStyle}
      animatedIndex={animatedValue}
      animation={animation}>
      {texts}
    </AnimatedCascade>
  );
};

export default memo(AnimatedText);
