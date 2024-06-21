import {Button} from 'components/Button';
import {Page} from 'components/Page';
import {Text} from 'react-native';
import {create, goBack, replaceFocusedState} from 'router';
import {reverseNextReplaceAnimation} from 'gouter/native';

/** @type {import("router").Screen<'Charts'>} */
export const Charts = ({state}) => {
  return (
    <Page>
      <Text>Charts</Text>
      <Text>animation: {state.params.animation}</Text>
      <Button
        title="replace by Stats"
        onPress={() => replaceFocusedState(create('Stats', {}))}
      />
      <Button
        title="replace by Stats with reverse"
        onPress={() => {
          reverseNextReplaceAnimation();
          replaceFocusedState(create('Stats', {}));
        }}
      />
      <Button title="go back" onPress={goBack} />
    </Page>
  );
};
