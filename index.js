import { GouterState } from './state/index.js';

/** @typedef {import('./state/index.js').Config} Config */

/**
 * `Navigator` defines how parent state stack is modified.
 * @template {Config} [T=Config]
 * @template {keyof T} [N=keyof T]
 * @typedef {(parentState: GouterState<T, N>, toState: GouterState<T, N> | null, route: Route<T, N>)
 * => GouterState<T, N>[] | null} Navigator
 */

/**
 * `ParamDef` is url parameter definition. It controls how each route parameter is decoded
 * from url to state and vice versa. Array parameter could be marked as `list` for better url look.
 * @template P
 * @typedef {({
 *   list?: never,
 *   decode: (str: string) => Exclude<P, undefined>,
 *   encode?: (val: Exclude<P, undefined>) => string
 * } | (Exclude<P, undefined> extends Array<infer E> ? {
 *   list: true,
 *   decode: ((str: string) => E),
 *   encode?: ((val: E) => string)
 * } : never)) | (string extends P ? {
 *   list?: never,
 *   decode?: (str: string) => Exclude<P, undefined>,
 *   encode?: (val: Exclude<P, undefined>) => string
 * } : never)} ParamDef
 */

/**
 * Provides fine state search using `keys` list, callback to `merge` params and callback to `update`
 * state.
 * @template {Config} T
 * @template {keyof T} N
 * @typedef {Object} GoToOptions
 * @prop {(keyof T[N])[]} [keys] Enables search for existing state using list of params keys. Empty
 * list always creates new state. Nonempty list will be used to compare existing state params with
 * passed ones. Params compared using strict equality.
 * @prop {(prevParams: T[N], nextParams: T[N]) => T[N]} [merge] Merges previous and next parameters
 * on successful navigation to existing state.
 * @prop {(state: GouterState<T, N>) => void} [update] Callback for further state update. Called
 * after successful navigation.
 */

/**
 * Generic `goTo`.
 * @template {Config} T
 * @typedef {<N extends keyof T>(name: N, params: T[N], options?: GoToOptions<T, N>) => void} GoTo
 */

/**
 * Set of rules, describing how to navigate.
 * @template {Config} T
 * @template {keyof T} N
 * @typedef {Object} RouteNavigation
 * @prop {Navigator<T, N> | Navigator<T> | Navigator} navigator
 * @prop {(keyof T)[]} allowed
 * @prop {(fromState: GouterState<T, N>, toState: GouterState<T> | null) => boolean} [blocker]
 */

/**
 * Set of rules, describing how to encode and decode urls.
 * @template {Config} T
 * @template {keyof T} N
 * @typedef {Object} RouteLinking
 * @prop {{[K in keyof T[N] as undefined extends T[N][K] ? never : K]: ParamDef<T[N][K]>} & {[K in
 * `_${string}`]?: string}} [path]
 * @prop {{[K in keyof T[N] as undefined extends T[N][K] ? K : never]?: ParamDef<T[N][K]>}} [query]
 */

/**
 * Set of helpful route options.
 * @template {Config} T
 * @template {keyof T} N
 * @typedef {Object} RouteHelpers
 * @prop {(state: GouterState<T, N>, create: CreateGouterState<T>) => GouterState<T>[]} [builder]
 * @prop {(state: GouterState<T, N>, goTo: GoTo<T>) => void} [redirector]
 */

/**
 * Makes object with required properties skippable.
 * @template T
 * @typedef {T | {[K in keyof T]?: never}} Skippable
 */

/**
 * Set of rules, describing how to navigate, build new state stack, encode and decode urls.
 * @template {Config} T
 * @template {keyof T} N
 * @typedef {Skippable<RouteNavigation<T, N>> & RouteHelpers<T, N> & RouteLinking<T, N>} Route
 */

/**
 * Map of names to routes. Mainly controls how to navigate between states. Routes should be
 * described and passed to `getNavigation`.
 * @template {Config} T
 * @typedef {{[N in keyof T]: Route<T, N>}} Routes
 */

/**
 * Generic `create`.
 * @template {Config} T
 * @typedef {<N extends keyof T>( name: N, params: T[N], stack?: GouterState<T, keyof T>[] |
 * undefined ) => GouterState<T, N>} CreateGouterState
 */

/**
 * Generic `goBack`.
 * @typedef {() => void} GoBack
 */

/**
 * Returns `create` tool for new states with stack auto-building.
 * @type {<T extends Config>(routes: Routes<T>) => CreateGouterState<T>}
 */
const getCreate = (routes) => {
  /** @type {CreateGouterState<any>} */
  const create = (name, params, stack) => {
    const state = new GouterState(name, params, stack);
    if (!stack) {
      const route = routes[/** @type {keyof typeof routes} */ (name)];
      if (route && route.builder) {
        const builtStack = route.builder(state, create);
        state.setStack(builtStack);
      }
    }
    return state;
  };
  return create;
};

/**
 * Handles `goTo` and `goBack`.
 * @type {(routes: Routes<any>, rootState: GouterState, toState: GouterState | null, options:
 * GoToOptions<any, any>) => void}
 */
const go = (routes, rootState, toState, options) => {
  let parentState = rootState;
  for (;;) {
    if (parentState.focusedChild) {
      parentState = parentState.focusedChild;
    } else {
      break;
    }
  }
  /** @type {Route<any, any>} */
  const { blocker } = routes[parentState.name] || {};
  if (blocker && blocker(parentState, toState)) {
    return;
  }
  for (;;) {
    /** @type {Route<any, any>} */
    const route = routes[parentState.name] || {};
    const { navigator, allowed } = route;
    if (navigator) {
      if (!toState || (allowed && allowed.indexOf(toState.name) >= 0)) {
        const { keys } = options;
        if (toState && (!keys || keys.length > 0)) {
          const { name, params } = toState;
          const { stack, focusedIndex } = parentState;
          for (let i = 0; i < stack.length; i += 1) {
            const stackIndex = focusedIndex - i >= 0 ? focusedIndex - i : i;
            const prevState = stack[stackIndex];
            if (prevState.name === name) {
              const { params: prevParams } = prevState;
              let hasMatch = true;
              if (keys) {
                for (const key of keys) {
                  if (
                    prevParams[/** @type {string} */ (key)] !== params[/** @type {string} */ (key)]
                  ) {
                    hasMatch = false;
                    break;
                  }
                }
              }
              if (hasMatch) {
                prevState.focus();
                const nextParams = options.merge ? options.merge(prevParams, params) : params;
                prevState.setParams(nextParams);
                const nextStack = navigator(parentState, prevState, route);
                if (nextStack) {
                  parentState.setStack(nextStack);
                }
                if (options.update) {
                  options.update(prevState);
                }
                return;
              }
            }
          }
        }
        const nextStack = navigator(parentState, toState, route);
        if (nextStack) {
          parentState.setStack(nextStack);
          if (toState) {
            toState.focus();
            if (options.update) {
              options.update(toState);
            }
          }
          return;
        }
      }
    }
    if (parentState.parent) {
      parentState = parentState.parent;
    } else {
      break;
    }
  }
};

/**
 * Main tools for navigation.
 * @template {Config} T
 * @template {keyof T} N
 * @typedef {Object} Navigation
 * @prop {GouterState<T, N>} rootState Main state tree.
 * @prop {GoTo<T>} goTo Main navigation tool. By default it searches for nearest state with passed `name` (and matches
 * passed `keys` if any) in stacks of focused states. If existing state not found then new state is
 * created if it is allowed in current stack. Params are replaced by passed ones by default, however
 * `merge` option may modify this behavior. When navigation is successful optional `update` callback
 * is called for further state modification.
 * @prop {GoBack} goBack Secondary navigation tool. It's behavior is defined by `navigator` option in route but usually it
 * undoes `goTo` changes.
 * @prop {CreateGouterState<T>} create Tool to create new typed states. It may also automatically build stack using `builder` option of
 * route.
 */

/**
 * Provides main tools for navigation.
 * @type {<T extends Config, N extends keyof T>(routes: Routes<T>, rootName: N, rootParams: T[N]) =>
 * Navigation<T, N>}
 */
export const getNavigation = (routes, rootName, rootParams) => {
  const create = getCreate(routes);
  const rootState = create(rootName, rootParams);
  /** @type {GoTo<any>} */
  const redirect = (name, params, options) =>
    go(routes, rootState, create(name, params), options || {});
  return {
    rootState,
    create,
    goTo: (name, params, options) => {
      const state = create(name, params);
      const route = routes[name];
      if (route && route.redirector) {
        route.redirector(state, redirect);
      }
      go(routes, rootState, create(name, params), options || {});
    },
    goBack: () => go(routes, rootState, null, {}),
  };
};
