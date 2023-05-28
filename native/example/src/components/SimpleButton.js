import React, {memo} from 'react';
import {StyleSheet, TouchableOpacity, Text} from 'react-native';

/** @type {React.FC<{title: string, onPress: () => void, selected?: boolean}>} */
const SimpleButton = ({title, onPress, selected}) => (
  <TouchableOpacity
    style={selected ? styles.containerSelected : styles.container}
    onPress={onPress}>
    <Text>{title}</Text>
  </TouchableOpacity>
);

export default memo(SimpleButton);

/** @type {import('react-native').ViewStyle} */
const containerStyle = {
  borderWidth: 1,
  borderColor: 'gray',
  borderRadius: 16,
  alignItems: 'center',
  padding: 8,
  marginVertical: 8,
  backgroundColor: '#FFFFFFCC',
};

const styles = StyleSheet.create({
  container: containerStyle,
  containerSelected: {
    ...containerStyle,
    backgroundColor: '#CCCCCCCC',
  },
});
