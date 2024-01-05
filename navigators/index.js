/**
 * @type {(options: {}) => import("..").Navigator}
 */
export const newStackNavigator =
  () =>
  ({ parent, state, index }) => {
    const { stack = [] } = parent;
    if (state && index !== undefined) {
      return { ...parent, stack: [...stack.slice(0, index), state] };
    }
    if (state && index === undefined) {
      return { ...parent, stack: [...stack, state] };
    }
    if (stack.length > 1) {
      return { ...parent, stack: stack.slice(0, -1) };
    }
    return parent;
  };

/**
 * @type {(options: {}) => import("..").Navigator}
 */
export const newTabNavigator =
  () =>
  ({ parent, state, index, allowed }) => {
    const { stack = [] } = parent;
    if (state && index !== undefined) {
      return { ...parent, index };
    }
    if (state && index === undefined) {
      const nameIndex = allowed.indexOf(state.name);
      const splitIndex = stack.findIndex(
        (prevState) => allowed.indexOf(prevState.name) > nameIndex,
      );
      if (splitIndex >= 0) {
        return {
          ...parent,
          stack: [...stack.slice(0, splitIndex), state, ...stack.slice(splitIndex)],
          index: splitIndex,
        };
      }
      return { ...parent, stack: [...stack, state], index: stack.length };
    }
    const nextIndex = (parent.index === undefined ? stack.length - 1 : parent.index) + 1;
    if (nextIndex < stack.length) {
      return { ...parent, stack, index: nextIndex };
    }
    return parent;
  };

/**
 * @type {(options: {}) => import("..").Navigator}
 */
export const newSwitchNavigator =
  () =>
  ({ parent, state }) => {
    if (state) {
      return { ...parent, stack: [state] };
    }
    return parent;
  };
