import {Button} from 'components/Button';
import {Page} from 'components/Page';
import {useIsFocused} from 'gouter/native';
import {Text} from 'react-native';
import {goBack} from 'router';

/** @type {import("router").Screen<'Home'>} */
export const Home = () => {
  const isFocused = useIsFocused();
  return (
    <Page>
      <Text>Home</Text>
      <Button title="go back" onPress={goBack} />
      <Text>isFocused: {isFocused ? 'true' : 'false'}</Text>
      <Text>{'home '.repeat(100)}</Text>
    </Page>
  );
};
