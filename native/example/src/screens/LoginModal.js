import {StyleSheet, View} from 'react-native';

/** @type {import("router").Screen<'LoginModal'>} */
export const LoginModal = () => {
  return (
    <View style={styles.modalContainer} renderToHardwareTextureAndroid>
      <View style={styles.modalPlaceholder} renderToHardwareTextureAndroid />
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 128,
    overflow: 'hidden',
  },
  modalPlaceholder: {
    width: '100%',
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#EEEEEE',
  },
});
