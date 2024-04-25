import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  GouterNative,
  useGouterState,
  getAnimatedValues,
  useIsFocused,
  useIsStale,
} from 'gouter/native';
import {
  StyleSheet,
  Text,
  View,
  BackHandler,
  TouchableOpacity,
  Animated,
  Keyboard,
  ScrollView,
  Easing,
} from 'react-native';
import {create, goBack, goTo, rootState, routes} from './router';

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

/** @type {React.FC<{title: string, onPress: () => void, selected?: boolean}>} */
const Button = ({title, onPress, selected}) => (
  <TouchableOpacity
    style={[styles.buttonContainer, selected && styles.buttonContainerSelected]}
    onPress={onPress}>
    <Text>{title}</Text>
  </TouchableOpacity>
);

/** @type {GouterScreen<'App'>} */
const App = ({children}) => {
  return (
    <View style={styles.container}>
      <Text>App</Text>
      {children}
    </View>
  );
};

/** @type {GouterScreen<'LoginStack'>} */
const LoginStack = ({children}) => {
  return <View style={styles.container}>{children}</View>;
};

/** @type {GouterScreen<'LoginConfirmationStack'>} */
const LoginConfirmationStack = ({children}) => {
  return <View style={styles.container}>{children}</View>;
};

/** @type {GouterScreen<'LoginModal'>} */
const LoginModal = () => {
  return (
    <View style={styles.modalContainer} renderToHardwareTextureAndroid>
      <View style={styles.modalPlaceholder} renderToHardwareTextureAndroid />
    </View>
  );
};

/** @type {GouterScreen<'Login'>} */
const Login = ({state}) => {
  return (
    <View style={styles.container}>
      <Text>Login</Text>
      <Text>Name: {state.params.name}</Text>
      <Button
        title="go to LoginConfirmation"
        onPress={() => goTo('LoginConfirmation', {phone: '2398723987'})}
      />
      <Button
        title="go to Stats #1"
        onPress={() => goTo('Stats', {animation: 'slide'})}
      />
      <Button
        title="go to Stats #2"
        onPress={() => goTo('Stats', {animation: 'rotation'})}
      />
      <Text>{'login '.repeat(100)}</Text>
      <Button
        title="change name"
        onPress={() =>
          state.mergeParams({
            name: state.params.name === 'user' ? 'guest' : 'user',
          })
        }
      />
      <Button title="show modal" onPress={() => goTo('LoginModal', {})} />
    </View>
  );
};

/** @type {GouterScreen<'Stats'>} */
const Stats = ({state}) => {
  return (
    <View style={styles.container}>
      <Text>Stats</Text>
      <Text>animation: {state.params.animation}</Text>
      <Button title="go back" onPress={goBack} />
    </View>
  );
};

/** @type {GouterScreen<'LoginConfirmation'>} */
const LoginConfirmation = ({state}) => {
  const parentIndex = getAnimatedValues(state.parent || state).index;
  const animatedTextStyle = useMemo(
    () => ({
      opacity: parentIndex.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
      transform: [
        {
          translateY: parentIndex.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-80, 0, -80],
          }),
        },
      ],
    }),
    [parentIndex],
  );

  const getHasLogin = useCallback(
    () => rootState.stack.find(state => state.name === 'LoginStack'),
    [],
  );
  const [hasLogin, setHasLogin] = useState(getHasLogin);
  useEffect(() => rootState.listen(() => setHasLogin(getHasLogin())), []);

  return (
    <View style={styles.container}>
      <Animated.View style={animatedTextStyle}>
        <Text>Login Confirmation</Text>
      </Animated.View>
      <Text>Phone: {state.params.phone}</Text>
      <Button title="go to Tabs" onPress={() => goTo('Tabs', {})} />
      <Button title="go to App" onPress={() => goTo('App', {})} />
      <Text>{'confirmation '.repeat(50)}</Text>
      <Button title="go back" onPress={goBack} />
      <Button
        title={hasLogin ? 'remove LoginStack' : 'add LoginStack'}
        onPress={() => {
          const {parent} = state;
          if (!parent) {
            return;
          }
          if (hasLogin) {
            rootState.setStack(
              rootState.stack.filter(({name}) => name !== 'LoginStack'),
            );
          } else {
            rootState.setStack([create('LoginStack', {}), ...rootState.stack]);
            state.focus();
          }
        }}
      />
      <Button
        title="goTo Login"
        onPress={() => goTo('Login', {name: 'user'})}
      />
      <Button
        title="goTo LoginDrawer"
        onPress={() => goTo('LoginDrawer', {})}
      />
    </View>
  );
};

/** @type {GouterScreen<'LoginDrawer'>} */
export const LoginDrawer = () => {
  return (
    <View style={{flexDirection: 'row', flex: 1}}>
      <TouchableOpacity
        style={{flex: 0.2}}
        activeOpacity={1}
        onPress={goBack}
      />
      <View
        style={{
          backgroundColor: 'gray',
          flex: 0.8,
        }}>
        <View>
          <Text>Settings</Text>
        </View>
      </View>
    </View>
  );
};

/** @type {GouterScreen<'Tabs'>} */
const Tabs = ({state, children}) => {
  return (
    <View style={styles.container}>
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
    </View>
  );
};

/** @type {GouterScreen<'Home'>} */
const Home = ({}) => {
  const isFocused = useIsFocused();
  return (
    <View style={styles.container}>
      <Text>Home</Text>
      <Button title="go back" onPress={goBack} />
      <Text>isFocused: {isFocused ? 'true' : 'false'}</Text>
      <Text>{'home '.repeat(100)}</Text>
    </View>
  );
};

/** @type {GouterScreen<'Post'>} */
const Post = () => {
  const isStale = useIsStale();
  return (
    <View style={styles.container}>
      <Text>Post</Text>
      <Button title="go back" onPress={goBack} />
      <Text>isStale: {isStale ? 'true' : 'false'}</Text>
      <Text>{'post '.repeat(100)}</Text>
    </View>
  );
};

const GouterStateName = () => {
  const state = useGouterState();
  return <Text>state name: {state ? state.name : null}</Text>;
};

/** @type {GouterScreen<'Profile'>} */
const Profile = () => {
  return (
    <ScrollView style={styles.container}>
      <Text>Profile</Text>
      <Button title="go back" onPress={goBack} />
      <GouterStateName />
      <Text>{'profile '.repeat(500)}</Text>
    </ScrollView>
  );
};

/** @type {import('gouter/native').Animation} */
const defaultAnimation = ({index, width}) => ({
  opacity: index.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 1, 0],
  }),
  transform: [
    {
      translateX: Animated.multiply(width, index),
    },
    {
      scale: index.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0.9, 1, 0.9],
      }),
    },
    {
      rotate: index.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-30deg', '0deg', '30deg'],
      }),
    },
  ],
});

/** @type {import('gouter/native').Animation} */
const iOSAnimation = ({index, width}) => [
  {
    backgroundColor: 'black',
    opacity: index.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 0.2, 0],
    }),
  },
  {
    transform: [
      {
        translateX: Animated.multiply(
          width,
          index.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-0.25, 0, 1],
          }),
        ),
      },
    ],
  },
];

/** @type {import('gouter/native').Animation} */
const drawerAnimation = ({index, width}) => [
  {
    backgroundColor: 'black',
    opacity: index.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 0.2, 0],
    }),
  },
  {
    transform: [
      {
        translateX: Animated.multiply(
          width,
          index.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [0, 0, 1],
          }),
        ),
      },
    ],
  },
];

/** @type {import('gouter/native').Animation} */
const modalAnimation = ({index, height}) => [
  {
    backgroundColor: 'black',
    opacity: index.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 0.5, 0],
    }),
  },
  {
    transform: [
      {
        translateY: Animated.multiply(
          height,
          index.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [0, 0, 1],
          }),
        ),
      },
    ],
  },
];

/** @type {import('gouter/native').StateSettings} */
const defaultSettings = {
  animation: iOSAnimation,
  animationDuration: 256,
  swipeDetection: 'left',
  swipeDetectionSize: 40,
  animationEasing: Easing.elastic(0.25),
};

/** @type {import('gouter/native').StateSettings} */
const modalSettings = {
  animation: modalAnimation,
  swipeDetection: 'bottom',
};

/** @type {import('gouter/native').StateSettings} */
const tabsSettings = {
  animation: defaultAnimation,
  swipeDetection: 'horizontal',
  swipeDetectionSize: '100%',
};

/** @type {import('gouter/native').StateSettings} */
const drawerSettings = {
  animation: drawerAnimation,
  swipeDetection: 'right',
  swipeDetectionSize: '80%',
};

/** @type {import('gouter/native').ScreenConfigs<Config>} */
const screenConfigs = {
  App: {
    component: App,
  },
  LoginStack: {
    component: LoginStack,
  },
  LoginModal: {
    component: LoginModal,
    stateSettings: {
      animation: modalAnimation,
      swipeDetection: 'bottom',
      swipeDetectionSize: '100%',
      prevScreenFixed: true,
    },
  },
  Login: {
    component: Login,
  },
  Stats: {
    component: Stats,
    stateSettings: ({params: {animation}}) => ({
      animation: animation === 'rotation' ? defaultAnimation : iOSAnimation,
    }),
  },
  LoginConfirmationStack: {
    component: LoginConfirmationStack,
    stackSettings: drawerSettings,
  },
  LoginConfirmation: {
    component: LoginConfirmation,
  },
  LoginDrawer: {
    component: LoginDrawer,
  },
  Tabs: {
    component: Tabs,
    stackSettings: tabsSettings,
  },
  Home: {
    component: Home,
  },
  Post: {
    component: Post,
  },
  Profile: {
    component: Profile,
  },
};

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

const AppWrapper = () => {
  const [treeVisible, setTreeVisible] = useState(true);
  const [jsonStr, setJsonStr] = useState(() => getJsonStr(rootState));

  useEffect(() => rootState.listen(state => setJsonStr(getJsonStr(state))), []);

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
    <View style={{flex: 1}}>
      <GouterNative
        state={rootState}
        routes={routes}
        screenConfigs={screenConfigs}
        defaultSettings={defaultSettings}
      />
      {treeVisible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Text
            style={{
              backgroundColor: '#00000066',
              color: 'white',
              flex: 1,
            }}>
            {jsonStr}
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={{
          position: 'absolute',
          right: 16,
          backgroundColor: '#dddddd',
          padding: 4,
        }}
        onPress={() => setTreeVisible(visible => !visible)}>
        <Text>TREE</Text>
      </TouchableOpacity>
    </View>
  );
};

export default AppWrapper;
