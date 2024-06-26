import {Button} from 'components/Button';
import {Page} from 'components/Page';
import {Text} from 'react-native';
import {create, goBack, replaceFocusedState} from 'router';
import {reverseNextReplaceAnimation} from 'gouter/native';

/** @type {import("router").Screen<'Stats'>} */
export const Stats = ({state}) => {
  return (
    <Page>
      <Text>Stats</Text>
      <Text>animation: {state.params.animation}</Text>
      <Button
        title="replace by Charts"
        onPress={() => {
          replaceFocusedState(create('Charts', {}));
        }}
      />
      <Button
        title="replace by Charts with reverse"
        onPress={() => {
          reverseNextReplaceAnimation();
          replaceFocusedState(create('Charts', {}));
        }}
      />
      <Button title="go back" onPress={goBack} />
    </Page>
  );
};
