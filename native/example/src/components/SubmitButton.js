import React, {memo} from 'react';
import {TouchableOpacity, StyleSheet, Text} from 'react-native';

/**
 * @typedef {{
 * title: string
 * onPress: () => void
 * disabled?: boolean
 * }} SubmitButtonProps
 */

/** @type {React.FC<SubmitButtonProps>} */
const SubmitButton = ({title, onPress, disabled}) => (
  <TouchableOpacity
    style={disabled ? styles.containerDisabled : styles.container}
    onPress={onPress}
    disabled={disabled}>
    <Text style={styles.text}>{title}</Text>
  </TouchableOpacity>
);

export default memo(SubmitButton);

/** @type {import('react-native').ViewStyle} */
const containerStyle = {
  borderWidth: 1,
  borderColor: '#EEE',
  borderRadius: 16,
  alignItems: 'center',
  height: 72,
  paddingHorizontal: 16,
  backgroundColor: '#FFFFFFCC',
  justifyContent: 'center',
};

const styles = StyleSheet.create({
  container: containerStyle,
  containerDisabled: {
    ...containerStyle,
    opacity: 0.25,
  },
  text: {
    fontSize: 18,
  },
});
