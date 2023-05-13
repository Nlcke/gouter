/**
 * @type {<G extends import("..").GouterInstance>(gouter: G, options: {
 * names: G['rootState']['name'][]
 * }) => import("..").Navigator<any, any>}
 */
export const newStackNavigator =
  ({ encodePath, getMergedState }, { names }) =>
  (stateOrNull, parent) => {
    if (stateOrNull) {
      const state = stateOrNull;
      if (names.includes(state.name)) {
        const path = encodePath(state);
        const stack = parent.stack || [];
        const index = stack.findIndex((stackState) => encodePath(stackState) === path);
        const prevState = stack[index];
        const nextState = prevState ? getMergedState(prevState, state) : state;
        const nextStack = [...stack.slice(0, index >= 0 ? index : undefined), nextState];
        return { ...parent, stack: nextStack };
      }
    } else if (parent.stack && parent.stack.length > 1) {
      const { stack } = parent;
      const nextStack = stack.slice(0, -1);
      return { ...parent, stack: nextStack };
    }
    return null;
  };

/**
 * @type {<G extends import("..").GouterInstance>(gouter: G, options: {
 * names: G['rootState']['name'][]
 * }) => import("..").Navigator<any, any>}
 */
export const newTabNavigator =
  ({ encodePath, getMergedState }, { names }) =>
  (stateOrNull, parent) => {
    if (stateOrNull) {
      const state = stateOrNull;
      if (names.includes(state.name)) {
        const path = encodePath(state);
        const stack = parent.stack || [];
        const index = stack.findIndex((stackState) => encodePath(stackState) === path);
        const nextIndex = index >= 0 ? index : stack.length;
        const prevState = stack[index];
        const nextState = prevState ? getMergedState(prevState, state) : state;
        const nextStack = [...stack];
        nextStack[nextIndex] = nextState;
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
