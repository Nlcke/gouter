/* eslint-disable no-unused-vars */
/** @typedef {import('..').default<any>} Gouter */

/** @type {<G extends Gouter>(gouter: G, names: G['state']['name'][]) => Required<G["defaultHooks"]>["shouldGoTo"]} */
export const shouldGoToForNames = (gouter, names) => (state) => names.includes(state.name);

/** @type {<G extends Gouter>(gouter: G) => Required<G["defaultHooks"]>["onGoTo"]} */
export const onGoToInStack =
  ({ encodePath }) =>
  (state, parent) => {
    const path = encodePath(state.name, state.params);
    const stack = parent.stack || [];
    const index = stack.findIndex(({ name, params }) => encodePath(name, params) === path);
    const nextStack = [...stack.slice(0, index >= 0 ? index : undefined), state];
    return { ...parent, stack: nextStack };
  };

/** @type {<G extends Gouter>(gouter: G) => Required<G["defaultHooks"]>["shouldGoBack"]} */
export const shouldGoBackInStack = (gouter) => (_, parent) =>
  parent.stack ? parent.stack.length > 1 : true;

/** @type {<G extends Gouter>(gouter: G) => Required<G["defaultHooks"]>["onGoBack"]} */
export const onGoBackInStack = (gouter) => (_, parent) => {
  const stack = parent.stack || [];
  const nextStack = stack.slice(0, -1);
  return { ...parent, stack: nextStack };
};

/** @type {<G extends Gouter>(gouter: G) => Required<G["defaultHooks"]>["onGoTo"]} */
export const onGoToInTabs =
  ({ encodePath }) =>
  (state, parent) => {
    const path = encodePath(state.name, state.params);
    const stack = parent.stack || [];
    const nextStack = [
      ...stack.filter((stackState) => encodePath(stackState.name, stackState.params) !== path),
      state,
    ];
    return { ...parent, stack: nextStack };
  };

/** @type {<G extends Gouter>(gouter: G, name: G['state']['name']) => Required<G["defaultHooks"]>["shouldGoBack"]} */
export const shouldGoBackInTabs = (gouter, name) => (_, parent) => {
  const stack = parent.stack || [];
  const lastState = stack[stack.length - 1];
  return lastState.name !== name;
};

/** @type {<G extends Gouter>(gouter: G, name: G['state']['name']) => Required<G["defaultHooks"]>["onGoBack"]} */
export const onGoBackInTabs = (gouter, name) => (_, parent) => {
  const stack = parent.stack || [];
  const nextStack = [
    ...stack.filter((stackState) => stackState.name !== name),
    ...stack.filter((stackState) => stackState.name === name),
  ];
  return { ...parent, stack: nextStack };
};
