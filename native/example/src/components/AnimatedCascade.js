import React, {memo, useMemo} from 'react';
import {Animated, View} from 'react-native';

/**
 * @typedef {(animatedIndex: Animated.AnimatedInterpolation<number>) => Animated.WithAnimatedValue<import('react-native').ViewStyle>} CascadeAnimation
 */

/**
 * @typedef {{
 * style: import('react-native').ViewStyle
 * animation: CascadeAnimation
 * animatedIndex: Animated.AnimatedInterpolation<number>
 * children: React.ReactNode
 * }} AnimatedCascadeProps
 */

/** @type {React.FC<AnimatedCascadeProps>}>} */
const AnimatedCascade = memo(({style, animation, animatedIndex, children}) => {
  const childList = useMemo(
    () => (Array.isArray(children) ? children : [children]),
    [children],
  );
  const maxIndex = childList.length;
  const animatedChildren = useMemo(
    () =>
      childList.map((child, index) => {
        const key = `${index}`;
        return (
          <Animated.View
            key={key}
            style={animation(
              animatedIndex.interpolate({
                inputRange: [-1, -index / maxIndex, 0, index / maxIndex, 1],
                outputRange: [-1, 0, 0, 0, 1],
              }),
            )}>
            {child}
          </Animated.View>
        );
      }),
    [animatedIndex, animation, childList, maxIndex],
  );

  return <View style={style}>{animatedChildren}</View>;
});

export default memo(AnimatedCascade);
