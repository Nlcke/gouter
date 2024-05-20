import {Button} from 'components/Button';
import {Page} from 'components/Page';
import {Text} from 'react-native';
import {goBack} from 'router';

/** @type {import("router").Screen<'Stats'>} */
export const Stats = ({state}) => {
  return (
    <Page>
      <Text>Stats</Text>
      <Text>animation: {state.params.animation}</Text>
      <Button title="go back" onPress={goBack} />
    </Page>
  );
};
