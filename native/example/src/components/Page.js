import {StyleSheet, View} from 'react-native';

/** @type {React.FC<{children: import('react').ReactNode}>} */
export const Page = ({children}) => {
  return <View style={styles.container}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'white',
    overflow: 'hidden',
  },
});
