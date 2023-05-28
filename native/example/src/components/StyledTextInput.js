import React, {memo} from 'react';
import {StyleSheet, TextInput} from 'react-native';

/** @type {React.FC<import('react-native').TextInputProps>} */
const StyledTextInput = props => (
  <TextInput style={styles.container} placeholderTextColor="#BBB" {...props} />
);

export default memo(StyledTextInput);

const styles = StyleSheet.create({
  container: {
    fontSize: 14,
    borderColor: '#EEE',
    borderWidth: 1,
    borderRadius: 32,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    backgroundColor: '#FFFFFFCC',
    height: 36,
  },
});
