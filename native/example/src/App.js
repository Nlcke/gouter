import React, {useEffect, useState} from 'react';
import {GouterNative} from 'gouter/native';
import {StyleSheet, View, BackHandler, Keyboard} from 'react-native';
import {goBack, rootState, routes} from 'router';
import {defaultOptions, screenConfigs} from 'router/view';
import {GouterControlCenter} from 'components/GouterControlCenter';

const App = () => {
  const [reanimated, setReanimated] = useState(true);

  useEffect(() => rootState.listen(Keyboard.dismiss), []);

  useEffect(() => {
    const onHardwareBackPress = () => {
      goBack();
      return true;
    };
    BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', onHardwareBackPress);
    };
  }, []);

  return (
    <View style={styles.container}>
      <GouterNative
        state={rootState}
        routes={routes}
        screenConfigs={screenConfigs}
        defaultOptions={defaultOptions}
        reanimated={reanimated}
      />
      <GouterControlCenter
        state={rootState}
        reanimated={reanimated}
        setReanimated={setReanimated}
      />
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
