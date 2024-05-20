import {useEffect} from 'react';
import {useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';

/** @type {(state: import('gouter/state').GouterState) => any} */
const toJson = state => ({
  [`${state.isFocused ? '+' : '-'} ${state.name} ${JSON.stringify(
    state.params,
  ).replace(/"/g, '')}`]: state.stack.map(stackState => toJson(stackState)),
});

/** @type {(state: import('gouter/state').GouterState) => string} */
const getJsonStr = state =>
  JSON.stringify(toJson(state), null, 2).replace(/ *(\{|\}|\},)\n/g, (_, str) =>
    ' '.repeat(str.replace(/[^ ]/g, '').length),
  );

/**
 * @type {React.FC<{
 * state: import('gouter/state').GouterState
 * reanimated: boolean
 * setReanimated: React.Dispatch<React.SetStateAction<boolean>>
 * }>}
 */
export const GouterControlCenter = ({state, reanimated, setReanimated}) => {
  const [jsonStr, setJsonStr] = useState(() => getJsonStr(state));

  useEffect(() => state.listen(next => setJsonStr(getJsonStr(next))), []);

  const [treeVisible, setTreeVisible] = useState(true);

  return (
    <View style={StyleSheet.absoluteFill}>
      {treeVisible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Text style={styles.jsonText}>{jsonStr}</Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.reanimatedButton}
        onPress={() => setReanimated(value => !value)}>
        <Text>{reanimated ? 'REANIMATED' : 'ANIMATED'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.treeButton}
        onPress={() => setTreeVisible(visible => !visible)}>
        <Text>TREE</Text>
      </TouchableOpacity>
    </View>
  );
};

export const styles = StyleSheet.create({
  jsonText: {
    backgroundColor: '#00000066',
    color: '#FFFFFFAA',
    flex: 1,
  },
  reanimatedButton: {
    position: 'absolute',
    right: 96,
    backgroundColor: '#dddddd',
    padding: 4,
  },
  treeButton: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#dddddd',
    padding: 4,
  },
});
