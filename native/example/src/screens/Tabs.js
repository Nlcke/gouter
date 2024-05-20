import {Button} from 'components/Button';
import {Page} from 'components/Page';
import {StyleSheet, View} from 'react-native';
import {goTo} from 'router';

/** @type {import("router").Screen<'Tabs'>} */
export const Tabs = ({state, children}) => {
  return (
    <Page>
      <View style={styles.container}>{children}</View>
      <View style={styles.tabBar}>
        {state.stack.map(stackState => (
          <Button
            key={stackState.name}
            title={stackState.name}
            onPress={() => goTo(stackState.name, {})}
            selected={stackState === state.focusedChild}
          />
        ))}
        <Button
          key="remove"
          title="- Post"
          onPress={() => {
            state.setStack(
              state.stack.filter(stackState => stackState.name !== 'Post'),
            );
          }}
        />
        <Button key="add" title="+ Post" onPress={() => goTo('Post', {})} />
        <Button
          key="reverse"
          title="Reverse"
          onPress={() => {
            state.setStack(state.stack.slice().reverse());
          }}
        />
      </View>
    </Page>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'white',
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
