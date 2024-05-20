import {Page} from 'components/Page';
import {View} from 'react-native';

/** @type {import('router').Screen<'LoginStack'>} */
export const LoginStack = ({children}) => {
  return <Page>{children}</Page>;
};
