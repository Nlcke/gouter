const Gouter = require('./index');

// push, pop, reset, popTo

// find top focused stack and get it's onSwitch
// onSwitch checks current stack and can return State or null if not found
// if null returned then upper focused stack used
// onInit when inner stack created
// App: [HomeTab, FavoriteTab: [Post(33), User(4545)], MoreTab: [Options, Notifications]]
// goTo(FavoriteTab) -> tabs are only focused
// if focused tabs already contain a state with children then it will be focused

// switchTo(Post(33)) // find nearest state with same key and move it's parents to the right
// THE STATE STACK IS NOT MODIFIED, ONLY IT'S PARENTS MOVING TO MAKE THEM IN FOCUS!
// App: [HomeTab, MoreTab: [Options, Notifications], FavoriteTab: [Post(33), User(4545)]]

// find nearest state from top to bottom, from right to left like in JSON.stringified state
// and switch to it without changing inner stacks
const switchTo = (state) => {
  // begin from top stack (top visible one) and right from left
  // when stacks have inner stacks (branches) search from rightmost one state
  // focus on parents of found state if it's found
  // and REPLACE STATE QUERY FIELD BY NEW ONE
  return true; // if state found
};

const gouter = Gouter({
  Init: {
    pattern: '/init',
  },
  Init2: {},
  Tabs: {},
  MoreStack: {},
  HomeStack: {},
  UserStack: {},
  Home: {},
  HomePost: {
    params: { postId: '' },
    query: { fromUserId: '' },
  },
  Login: {},
  LoginConfirm: {},
  SalonRegistration: {},
  More: {},
  User: {
    params: { id: '' },
  },
  UserFollowers: {
    params: { id: '' },
    query: {
      onlyStarred: false,
    },
  },
  UserLikes: {
    params: { id: '' },
  },
  Options: {},
  NotFound: {},
});

const { newState } = gouter;

/** @type {(names: (typeof gouter['state'])['name'][]) => Gouter.TransitionHooks<typeof gouter['state']>['shouldGoTo']} */
const oneOfNames =
  (names) =>
  (_, { name }) =>
    // @ts-ignore
    names.includes(name);

gouter.withHooks({
  Tabs: {
    onStackInit: (state) => [
      newState({ name: 'HomeStack' }),
      newState({ name: 'MoreStack' }),
    ],
    shouldGoTo: (_, { name }) => name === 'HomeStack' || name === 'MoreStack',
    // shouldGoTo: oneOfNames(['HomeStack', 'MoreStack']),
    onGoTo: ([parent], state) => ({
      ...parent,
      stack: [...parent.stack.filter(({ key }) => key !== state.key), state],
    }),
    shouldGoBack: ([parent]) => parent.stack.length > 1,
    onGoBack: ([parent]) => ({
      ...parent,
      stack: parent.stack.slice(0, -1),
    }),
  },
  HomeStack: {
    // onStackInit: (state) => [newState({ name: 'Home' })],
  },
  MoreStack: {
    shouldGoTo: (_, { name }) =>
      name === 'More' ||
      name === 'Options' ||
      name === 'Login' ||
      name === 'LoginConfirm',
    onGoTo: ([parent], state) => ({
      ...parent,
      stack: parent.stack.find(({ key }) => key === state.key)
        ? [
            ...parent.stack.slice(
              0,
              parent.stack.findIndex(({ key }) => key === state.key),
            ),
            state,
          ]
        : [...parent.stack, state],
    }),
    shouldGoBack: ([parent]) => parent.stack.length > 1,
    onGoBack: ([parent]) => ({
      ...parent,
      stack: parent.stack.slice(0, -1),
    }),
  },
});

gouter.withInitialState(newState({ name: 'Tabs' }));

console.log(JSON.stringify(gouter.state, null, 4));
console.log('\n');

gouter.goTo(
  { name: 'More' },
  { name: 'Options' },
  null,
  null,
  {
    name: 'MoreStack',
  },
  { name: 'Options' },
  { name: 'More' },
  { name: 'Options' },
  { name: 'Login' },
  { name: 'More' },
  { name: 'LoginConfirm' },
  { name: 'Options' },
  // { name: 'Login' },
  // { name: 'Login' },
  // { name: 'HomeStack' },
);
// gouter.goTo({ name: 'Options' });

// console.log(JSON.stringify(gouter.state, null, 4));

// setTimeout(() => {}, 10000);
