import React, {memo} from 'react';
import {StyleSheet, TouchableOpacity, Text} from 'react-native';

/**
 * @typedef {{
 * checked: boolean
 * setChecked: React.Dispatch<React.SetStateAction<boolean>>
 * children: React.ReactNode
 * }} CheckableInputProps
 */

/** @type {React.FC<CheckableInputProps>} */
const CheckableInput = ({checked, setChecked, children}) => (
  <TouchableOpacity
    style={styles.container}
    onPress={() => setChecked(!checked)}>
    <Text style={styles.text}>{checked ? '☑' : '☐'}</Text>
    {children}
  </TouchableOpacity>
);

export default memo(CheckableInput);

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 16,
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFFCC',
    flexDirection: 'row',
    marginBottom: 16,
  },
  text: {
    fontSize: 24,
    paddingRight: 8,
  },
});
