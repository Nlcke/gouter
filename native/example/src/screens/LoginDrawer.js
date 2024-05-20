import {Page} from 'components/Page';
import {Text, TouchableOpacity, View} from 'react-native';
import {goBack} from 'router';

/** @type {import("router").Screen<'LoginDrawer'>} */
export const LoginDrawer = () => {
  return (
    <Page>
      <TouchableOpacity
        style={{flex: 0.2}}
        activeOpacity={1}
        onPress={goBack}
      />
      <View
        style={{
          backgroundColor: 'gray',
          flex: 0.8,
        }}>
        <View>
          <Text>Options</Text>
        </View>
      </View>
    </Page>
  );
};
