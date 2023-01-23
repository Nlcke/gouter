/** @typedef {import('..').default<any>} GouterInstance */

/** @type {<G extends GouterInstance>(gouter: G, options: {names: G['state']['name'][]}) => G['navigator']} */
export const newStackNavigator =
  ({ encodePath }, { names }) =>
  (state, parent) => {
    if (state) {
      if (names.includes(state.name)) {
        const path = encodePath(state);
        const stack = parent.stack || [];
        const index = stack.findIndex((stackState) => encodePath(stackState) === path);
        const nextStack = [...stack.slice(0, index >= 0 ? index : undefined), state];
        return { ...parent, stack: nextStack };
      }
    } else if (parent.stack && parent.stack.length > 1) {
      const stack = parent.stack || [];
      const nextStack = stack.slice(0, -1);
      return { ...parent, stack: nextStack };
    }
    return null;
  };

/** @type {<G extends GouterInstance>(gouter: G, options: {names: G['state']['name'][]}) => G['navigator']} */
export const newTabNavigator =
  ({ encodePath }, { names }) =>
  (state, parent) => {
    if (state) {
      if (names.includes(state.name)) {
        const path = encodePath(state);
        const stack = parent.stack || [];
        const nextStack = [...stack.filter((stackState) => encodePath(stackState) !== path), state];
        return { ...parent, stack: nextStack };
      }
    } else {
      const stack = parent.stack || [];
      const lastState = stack[stack.length - 1];
      if (lastState && lastState.name !== names[0]) {
        const nextStack = stack.slice(0, -1);
        return { ...parent, stack: nextStack };
      }
    }
    return null;
  };
