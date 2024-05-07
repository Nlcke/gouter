import { GouterState } from './state/index.js';

/**
 * Binds every method of class instance to that instance. Already applied on GouterNavigation and
 * GouterLinking to allow extract their methods.
 * @param {Record<any, any>} instance any class instance
 * @returns {void}
 */
export const bindMethods = (instance) => {
  const prototype = Object.getPrototypeOf(instance);
  const keys = Object.getOwnPropertyNames(prototype);
  for (const key of keys) {
    const method = /** @type {Function} */ (instance[key]);
    if (typeof method === 'function' && key !== 'constructor') {
      const descriptor = Object.getOwnPropertyDescriptor(instance, key);
      Object.defineProperty(instance, key, { ...descriptor, value: method.bind(instance) });
    }
  }
};

/**
 * `Navigator` defines how parent state stack is modified.
 * @template {import('./state').GouterConfig} [T=import('./state').GouterConfig]
 * @template {keyof T} [N=keyof T]
 * @typedef {(parentState: GouterState<T, N>, toState: GouterState<T, N> | null, route: Route<T, N>)
 * => GouterState<T, N>[] | null} Navigator
 */

/**
 * `ParamDef` is url parameter definition. It controls how each route parameter is decoded from url
 * to state and vice versa. Array parameter could be marked as `list` for better url look.
 * @template P
 * @typedef {({ list?: never, decode: (str: string) => Exclude<P, undefined>, encode?: (val:
 * Exclude<P, undefined>) => string } | (Exclude<P, undefined> extends Array<infer E> ? { list:
 * true, decode: ((str: string) => E), encode?: ((val: E) => string) } : never)) | (string extends P
 * ? { list?: never, decode?: (str: string) => Exclude<P, undefined>, encode?: (val: Exclude<P,
 * undefined>) => string } : never)} ParamDef
 */

/**
 * Provides fine state search using `keys` list, callback to `merge` params and callback to `update`
 * state.
 * @template {import('./state').GouterConfig} T
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
 * Set of rules, describing how to navigate.
 * @template {import('./state').GouterConfig} T
 * @template {keyof T} N
 * @typedef {Object} RouteNavigation
 * @prop {Navigator<T, N> | Navigator<T> | Navigator} navigator
 * @prop {(keyof T)[]} allowed
 * @prop {(fromState: GouterState<T, N>, toState: GouterState<T> | null) => boolean} [blocker]
 */

/**
 * Set of rules, describing how to encode and decode urls.
 * @template {import('./state').GouterConfig} T
 * @template {keyof T} N
 * @typedef {Object} RouteLinking
 * @prop {{[K in keyof T[N] as undefined extends T[N][K] ? never : K]: ParamDef<T[N][K]>} & {[K in
 * `_${string}`]?: string}} [path]
 * @prop {{[K in keyof T[N] as undefined extends T[N][K] ? K : never]?: ParamDef<T[N][K]>}} [query]
 */

/**
 * Set of helpful route options.
 * @template {import('./state').GouterConfig} T
 * @template {keyof T} N
 * @typedef {Object} RouteHelpers
 * @prop {(state: GouterState<T, N>, create: GouterNavigation<T, any>['create']) =>
 * GouterState<T>[]} [builder]
 * @prop {(state: GouterState<T, N>, goTo: GouterNavigation<T, any>['goTo']) => void} [redirector]
 */

/**
 * Makes object with required properties skippable.
 * @template T
 * @typedef {T | {[K in keyof T]?: never}} Skippable
 */

/**
 * Set of rules, describing how to navigate, build new state stack, encode and decode urls.
 * @template {import('./state').GouterConfig} T
 * @template {keyof T} N
 * @typedef {Skippable<RouteNavigation<T, N>> & RouteHelpers<T, N> & RouteLinking<T, N>} Route
 */

/**
 * Map of names to route configurations. Mainly controls how to navigate between states. Routes
 * should be described and passed to `getNavigation`.
 * @template {import('./state').GouterConfig} T
 * @typedef {{[N in keyof T]: Route<T, N>}} Routes
 */

/**
 * Provides tools for navigation.
 * @template {import('./state').GouterConfig} T
 * @template {keyof T} K
 */
export class GouterNavigation {
  /**
   * Creates tools for navigation.
   * @param {Routes<T>} routes map of names to route configurations
   * @param {K} rootName root state name
   * @param {T[K]} rootParams root state parameters
   */
  constructor(routes, rootName, rootParams) {
    bindMethods(this);

    /**
     * map of names to route configurations
     * @protected
     * @type {Routes<T>}
     */
    this.routes = routes;

    /**
     * root state
     * @type {GouterState<T, K>}
     */
    this.rootState = this.create(rootName, rootParams);

    GouterState.rootStates.add(this.rootState);
  }

  /**
   * Creates state using required `name`, `params` and optional `stack`. When stack is not passed
   * and routes has appropriate `builder`, new stack is generated using that builder.
   * @template {keyof T} N
   * @param {N} name string to distinguish states
   * @param {T[N]} params collection of parameters to customize states
   * @param {GouterState<T>[]} [stack] optional list of inner states
   * @param {number} [focusedIndex] optional index of focused state in stack
   * @returns {GouterState<T, N>}
   */
  create(name, params, stack, focusedIndex) {
    const state = new GouterState(name, params, stack, focusedIndex);
    if (!stack) {
      const route = this.routes[/** @type {keyof typeof this.routes} */ (name)];
      if (route && route.builder) {
        const builtStack = route.builder(state, this.create);
        state.setStack(builtStack);
      }
    }
    return state;
  }

  /**
   * Main navigation tool. By default it searches for nearest state with passed `name` (and matches
   * passed `keys` if any) in stacks of focused states. If existing state not found then new state
   * is created if it is allowed in current stack. Params are replaced by passed ones by default,
   * however `merge` option may modify this behavior. When navigation is successful optional
   * `update` callback is called for further state modification.
   * @template {keyof T} N
   * @param {N} name
   * @param {T[N]} params
   * @param {GoToOptions<T, N>} [options]
   * @returns {void}
   */
  goTo(name, params, options) {
    const state = this.create(name, params);
    const route = this.routes[name];
    if (route && route.redirector) {
      route.redirector(state, this.goTo);
    }
    this.go(state, options || {});
  }

  /**
   * Secondary navigation tool. It's behavior is defined by `navigator` option in route but usually
   * it undoes `goTo` changes.
   * @returns {void}
   */
  goBack() {
    this.go(null, {});
  }

  /**
   * Returns current innermost focused state inside root state.
   * @returns {GouterState<T>}
   */
  getFocusedState() {
    /** @type {GouterState<T>} */
    let focusedState = this.rootState;
    while (focusedState.focusedChild) {
      focusedState = focusedState.focusedChild;
    }
    return focusedState;
  }

  /**
   * Handles {@link goTo} and {@link goBack} since they have a lot in common.
   * @protected
   * @param {GouterState<T> | null} toState state for {@link goTo} or null for {@link goBack}
   * @param {GoToOptions<T, any>} options
   * @returns {void}
   */
  go(toState, options) {
    let parentState = this.getFocusedState();
    for (;;) {
      /** @type {Route<any, any>} */
      const route = this.routes[parentState.name] || {};
      const { blocker } = route;
      if (blocker && blocker(parentState, toState)) {
        return;
      }
      const { navigator, allowed } = route;
      if (navigator && (!toState || allowed.indexOf(toState.name) >= 0)) {
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
                const nextParams = options.merge ? options.merge(prevParams, params) : params;
                prevState.setParams(nextParams);
                const nextStack = navigator(parentState, prevState, route);
                if (nextStack) {
                  parentState.setStack(nextStack);
                  prevState.focus();
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
      if (parentState.parent) {
        parentState = parentState.parent;
      } else {
        return;
      }
    }
  }
}
