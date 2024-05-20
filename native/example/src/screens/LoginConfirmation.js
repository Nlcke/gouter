import {Button} from 'components/Button';
import {Page} from 'components/Page';
import {getAnimatedValues} from 'gouter/native';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {Animated, Text} from 'react-native';
import {create, goBack, goTo, rootState} from 'router';

/** @type {import("router").Screen<'LoginConfirmation'>} */
export const LoginConfirmation = ({state}) => {
  const parentIndex = getAnimatedValues(state.parent || state).index;
  const animatedTextStyle = useMemo(
    () => ({
      opacity: parentIndex.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
      transform: [
        {
          translateY: parentIndex.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-80, 0, -80],
          }),
        },
      ],
    }),
    [parentIndex],
  );

  const getHasLogin = useCallback(
    () => rootState.stack.find(state => state.name === 'LoginStack'),
    [],
  );
  const [hasLogin, setHasLogin] = useState(getHasLogin);
  useEffect(() => rootState.listen(() => setHasLogin(getHasLogin())), []);

  return (
    <Page>
      <Animated.View style={animatedTextStyle}>
        <Text>Login Confirmation</Text>
      </Animated.View>
      <Text>Phone: {state.params.phone}</Text>
      <Button title="go to Stats" onPress={() => goTo('Stats', {})} />
      <Button title="go to Tabs" onPress={() => goTo('Tabs', {})} />
      <Button title="go to AppStack" onPress={() => goTo('AppStack', {})} />
      <Text>{'confirmation '.repeat(50)}</Text>
      <Button title="go back" onPress={goBack} />
      <Button
        title={hasLogin ? 'remove LoginStack' : 'add LoginStack'}
        onPress={() => {
          const {parent} = state;
          if (!parent) {
            return;
          }
          if (hasLogin) {
            rootState.setStack(
              rootState.stack.filter(({name}) => name !== 'LoginStack'),
            );
          } else {
            rootState.setStack([create('LoginStack', {}), ...rootState.stack]);
            state.focus();
          }
        }}
      />
      <Button
        title="goTo Login"
        onPress={() => goTo('Login', {name: 'user'})}
      />
      <Button
        title="goTo LoginDrawer"
        onPress={() => goTo('LoginDrawer', {})}
      />
    </Page>
  );
};
