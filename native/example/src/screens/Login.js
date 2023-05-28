import React, {useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {goTo} from '../router';
import SubmitButton from '../components/SubmitButton';
import AnimatedText from '../components/AnimatedText';
import StyledTextInput from '../components/StyledTextInput';
import AnimatedBackground from '../components/AnimatedBackground';
import CheckableInput from '../components/CheckableInput';

/** @type {import('react-native-linear-gradient').LinearGradientProps} */
const gradient = {
  start: {x: 0.0, y: 0.25},
  end: {x: 0.5, y: 1.0},
  locations: [0, 0.3, 0.7],
  colors: ['#fc669f', '#ab5998', '#892f6a'],
};

/** @type {import('../router').Screen['Login']} */
const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);

  const value = (username ? 1 : 0) + (password ? 1 : 0) + (agreed ? 1 : 0);
  const maxValue = 3;

  const submitEnabled = value === maxValue;

  return (
    <View style={styles.container}>
      <AnimatedBackground
        value={value}
        maxValue={maxValue}
        gradient={gradient}
      />
      <AnimatedText
        value="Welcome"
        duration={1000}
        animation={animatedIndex => ({
          transform: [
            {
              translateY: animatedIndex.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [-32, 0, 32],
              }),
            },
            {
              scale: animatedIndex.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [0, 1, 0],
              }),
            },
          ],
        })}
        textStyle={{
          fontSize: 48,
          marginBottom: 16,
        }}
      />
      <StyledTextInput
        placeholder="username"
        value={username}
        onChangeText={setUsername}
      />
      <StyledTextInput
        placeholder="password"
        value={password}
        onChangeText={setPassword}
      />

      <CheckableInput checked={agreed} setChecked={setAgreed}>
        <Text style={{fontSize: 14}}>I agree with the </Text>
        <TouchableOpacity onPress={() => goTo('LoginModal', {})}>
          <Text
            style={{
              fontSize: 14,
              textDecorationLine: 'underline',
            }}>
            rules
          </Text>
        </TouchableOpacity>
      </CheckableInput>
      <SubmitButton
        disabled={!submitEnabled}
        title="Log in"
        onPress={() => goTo('LoginConfirmation', {username})}
      />
    </View>
  );
};

export default Login;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'white',
    overflow: 'hidden',
    justifyContent: 'center',
  },
});
