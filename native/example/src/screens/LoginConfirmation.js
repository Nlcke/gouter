import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {getRootState, goBack, goTo, listen, setRootState} from '../router';
import AnimatedCascade from '../components/AnimatedCascade';
import SimpleButton from '../components/SimpleButton';
import AnimatedBackground from '../components/AnimatedBackground';
import SubmitButton from '../components/SubmitButton';

/** @type {import('react-native-linear-gradient').LinearGradientProps} */
const gradient = {
  start: {x: 0.0, y: 0.25},
  end: {x: 0.5, y: 1.0},
  locations: [0, 0.3, 0.7],
  colors: ['#66fc9f', '#59ab98', '#2f896a'],
};

/** @type {import('../router').Screen['LoginConfirmation']} */
const LoginConfirmation = ({state, animationProps: {parentIndexes}}) => {
  const [parentIndex] = parentIndexes;

  const [appState, setAppState] = useState(getRootState);
  useEffect(() => listen(setAppState), []);
  const stack = getRootState().stack || [];
  const hasLogin = !!stack.find(
    ({name, stack: stackOfLoginStack}) =>
      name === 'LoginStack' &&
      stackOfLoginStack &&
      stackOfLoginStack.find(({name: subName}) => subName === 'Login'),
  );

  /** @type {import('../components/AnimatedCascade').CascadeAnimation} */
  const animation = useCallback(
    animatedIndex => ({
      opacity: animatedIndex.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
      transform: [
        // {
        //   scaleX: animatedIndex.interpolate({
        //     inputRange: [-1, 0, 1],
        //     outputRange: [0, 1, 0],
        //   }),
        // },
        {
          rotate: animatedIndex.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: ['45deg', '0deg', '45deg'],
          }),
        },
        {
          translateY: animatedIndex.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-256, 0, -256],
          }),
        },
      ],
    }),
    [],
  );

  return (
    <View style={{flex: 1}}>
      <AnimatedBackground value={1} maxValue={1} gradient={gradient} />
      <AnimatedCascade
        style={styles.container}
        animatedIndex={parentIndex}
        animation={animation}>
        <Text style={styles.containerTitle}>Confirmation</Text>
        <Text>username: {state.params.username}</Text>
        <SimpleButton title="go to App" onPress={() => goTo('App', {})} />
        <Text>{'confirmation '.repeat(50)}</Text>
        <SimpleButton title="go back" onPress={goBack} />
        <SimpleButton
          title={hasLogin ? 'remove LoginStack' : 'add LoginStack'}
          onPress={() => {
            setRootState(
              hasLogin
                ? {
                    ...appState,
                    stack: stack.filter(({name}) => name !== 'LoginStack'),
                  }
                : {
                    ...appState,
                    stack: [
                      {
                        name: 'LoginStack',
                        params: {},
                        stack: [
                          {
                            name: 'Login',
                            params: {},
                          },
                        ],
                      },
                      ...stack,
                    ],
                  },
            );
          }}
        />
        <SimpleButton
          title="goTo Login"
          onPress={() => {
            goTo('Login', {});
          }}
        />
        <SimpleButton
          title="goTo LoginDrawer"
          onPress={() => {
            goTo('LoginDrawer', {});
          }}
        />
        <SubmitButton title="Confirm" onPress={() => goTo('Tabs', {})} />
      </AnimatedCascade>
    </View>
  );
};

export default LoginConfirmation;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    overflow: 'hidden',
  },
  containerTitle: {
    fontSize: 48,
    marginBottom: 16,
  },
});
