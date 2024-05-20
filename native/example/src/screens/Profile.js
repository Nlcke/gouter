import {Button} from 'components/Button';
import {ScrollView, StyleSheet, Text} from 'react-native';
import {goBack, useScreenState} from 'router';

/** @type {import('router').Screen<'Profile'>} */
export const Profile = () => {
  return (
    <ScrollView style={styles.container}>
      <Text>Profile</Text>
      <Button title="go back" onPress={goBack} />
      <GouterStateName />
      <Text>{'profile '.repeat(500)}</Text>
    </ScrollView>
  );
};

const GouterStateName = () => {
  const state = useScreenState();
  return <Text>state name: {state ? state.name : null}</Text>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'white',
    overflow: 'hidden',
  },
});
