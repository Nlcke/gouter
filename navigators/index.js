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
        const prevStateIndex = stack[index] ? stack[index].index : undefined;
        const nextState =
          prevStateIndex !== undefined ? { index: prevStateIndex, ...state } : state;
        const nextStack = [...stack.slice(0, index >= 0 ? index : undefined), nextState];
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
        const nextStack = [...stack];
        const index = nextStack.findIndex((stackState) => encodePath(stackState) === path);
        const nextIndex = index >= 0 ? index : nextStack.length;
        nextStack[nextIndex] = state;
        return { ...parent, stack: nextStack, index: nextIndex };
      }
    } else {
      const lastIndex = (parent.stack || []).length - 1;
      const index = parent.index !== undefined ? parent.index : lastIndex;
      const nextIndex = index + 1;
      if (nextIndex <= lastIndex) {
        return { ...parent, index: nextIndex };
      }
    }
    return null;
  };
