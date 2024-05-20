import {Page} from 'components/Page';
import {Text} from 'react-native';

/** @type {import("router").Screen<'AppStack'>} */
export const AppStack = ({children}) => {
  return (
    <Page>
      <Text>App</Text>
      {children}
    </Page>
  );
};
