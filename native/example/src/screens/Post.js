import {Text, View} from 'react-native';
import {goBack} from 'router';
import {useIsStale} from 'gouter/native';
import {Button} from 'components/Button';
import {Page} from 'components/Page';

/** @type {import("router").Screen<'Post'>} */
export const Post = () => {
  const isStale = useIsStale();
  return (
    <Page>
      <Text>Post</Text>
      <Button title="go back" onPress={goBack} />
      <Text>isStale: {isStale ? 'true' : 'false'}</Text>
      <Text>{'post '.repeat(100)}</Text>
    </Page>
  );
};
