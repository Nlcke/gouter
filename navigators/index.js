/**
 * @returns {import("../index").Navigator}
 */
export const newStackNavigator =
  () =>
  ({ stack }, toState) => {
    if (toState && toState.parent) {
      return stack.slice(0, stack.indexOf(toState) + 1);
    }
    if (toState) {
      return [...stack, toState];
    }
    if (stack.length > 1) {
      const nextStack = stack.slice(0, -1);
      nextStack[nextStack.length - 1].withFocus();
      return nextStack;
    }
    return null;
  };

/**
 * @param {object} [options] provides additional customization for navigator behavior
 * @param {(focusedIndex: number) => number} [options.backBehavior] calculates next `focusedIndex`
 * after current one on `goBack` call
 * @returns {import("../index").Navigator}
 */
export const newTabNavigator =
  (options) =>
  ({ stack, focusedIndex }, toState, { allowed = [] }) => {
    const { backBehavior } = options || {};
    if (toState && toState.parent) {
      return stack;
    }
    if (toState) {
      const nameIndex = allowed.indexOf(toState.name);
      const splitIndex = stack.findIndex(
        (stackState) => allowed.indexOf(stackState.name) > nameIndex,
      );
      if (splitIndex >= 0) {
        return [...stack.slice(0, splitIndex), toState, ...stack.slice(splitIndex)];
      }
      return [...stack, toState];
    }
    const nextIndex = backBehavior ? backBehavior(focusedIndex) : 0;
    const nextState = stack[nextIndex];
    if (nextState && nextIndex !== focusedIndex) {
      nextState.withFocus();
      return stack;
    }
    return null;
  };

/**
 * @returns {import("../index").Navigator}
 */
export const newSwitchNavigator = () => (_, toState) => {
  if (toState) {
    return [toState];
  }
  return null;
};
