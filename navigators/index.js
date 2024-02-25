/**
 * @type {(options: {}) => import("../index").Navigator}
 */
export const newStackNavigator =
  () =>
  ({ stack, focusedIndex }, toState) => {
    if (toState && toState.parent) {
      return [...stack.slice(0, focusedIndex), toState];
    }
    if (toState) {
      return [...stack, toState];
    }
    if (stack.length > 1) {
      return stack.slice(0, -1);
    }
    return null;
  };

/**
 * @type {(options: {}) => import("../index").Navigator}
 */
export const newTabNavigator =
  () =>
  ({ stack, focusedIndex }, toState, { allowed = [] }) => {
    if (toState && toState.parent) {
      return stack;
    }
    if (toState && focusedIndex === undefined) {
      const nameIndex = allowed.indexOf(toState.name);
      const splitIndex = stack.findIndex(
        (prevState) => allowed.indexOf(prevState.name) > nameIndex,
      );
      if (splitIndex >= 0) {
        return [...stack.slice(0, splitIndex), toState, ...stack.slice(splitIndex)];
      }
      return [...stack, toState];
    }
    const nextIndex = (focusedIndex >= 0 ? focusedIndex : stack.length - 1) + 1;
    if (nextIndex < stack.length) {
      return stack;
    }
    return null;
  };

/**
 * @type {(options: {}) => import("../index").Navigator}
 */
export const newSwitchNavigator = () => (_, toState) => {
  if (toState) {
    return [toState];
  }
  return null;
};
