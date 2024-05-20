import {Button} from 'components/Button';
import {Page} from 'components/Page';
import {Text, View} from 'react-native';
import {goTo} from 'router';

/** @type {import("router").Screen<'Login'>} */
export const Login = ({state}) => {
  return (
    <Page>
      <Text>Login</Text>
      <Text>Name: {state.params.name}</Text>
      <Button
        title="go to LoginConfirmation"
        onPress={() => goTo('LoginConfirmation', {phone: '2398723987'})}
      />
      <Button
        title="go to Stats #1"
        onPress={() => goTo('Stats', {animation: 'slide'})}
      />
      <Button
        title="go to Stats #2"
        onPress={() => goTo('Stats', {animation: 'rotation'})}
      />
      <Text>{'login '.repeat(100)}</Text>
      <Button
        title="change name"
        onPress={() =>
          state.mergeParams({
            name: state.params.name === 'user' ? 'guest' : 'user',
          })
        }
      />
      <Button title="show modal" onPress={() => goTo('LoginModal', {})} />
    </Page>
  );
};
