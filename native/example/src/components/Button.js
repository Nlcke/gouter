import {StyleSheet, Text, TouchableOpacity} from 'react-native';

/** @type {React.FC<{title: string, onPress: () => void, selected?: boolean}>} */
export const Button = ({title, onPress, selected}) => (
  <TouchableOpacity
    style={[styles.buttonContainer, selected && styles.buttonContainerSelected]}
    onPress={onPress}>
    <Text>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  buttonContainer: {
    borderWidth: 1,
    borderColor: 'gray',
    borderRadius: 16,
    alignItems: 'center',
    padding: 8,
    marginVertical: 8,
  },
  buttonContainerSelected: {
    backgroundColor: '#cccccc',
  },
});
