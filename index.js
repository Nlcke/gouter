/**
 * `Config` is a map of names to route params.
 * @typedef {Record<string, Record<string, any>>} Config
 */

/**
 * `State<T, [N]>` is Gouter unit with required name, params, optional stack of states and optional
 * index of focused state in state stack.
 * @template {Config} T
 * @template {keyof T} [N=keyof T]
 * @typedef {{[N in keyof T]: {
 * name: N
 * params: T[N]
 * stack?: State<T>[] | undefined
 * index?: number | undefined
 * }}[N]} State
 */

/**
 * `ParamDef` is url parameter definition. It controls how each route parameter is decoded
 * from url to state and vice versa. Array parameter could be marked as `list` for better url look.
 *
 * @template P
 * @typedef {({
 *   list?: never
 *   decode: (str: string) => Exclude<P, undefined>
 *   encode?: (val: Exclude<P, undefined>) => string
 * } | (Exclude<P, undefined> extends Array<infer E> ? {
 *   list: true
 *   decode: ((str: string) => E)
 *   encode?: ((val: E) => string)
 * } : never)) | (string extends P ? {
 *   list?: never,
 *   decode?: (str: string) => Exclude<P, undefined>,
 *   encode?: (val: Exclude<P, undefined>) => string
 * } : never)} ParamDef
 */

/**
 * `Navigator` defines how parent state is modified.
 * @template {Config} [T=Config]
 * @template {keyof T} [N=keyof T]
 * @typedef {(props: {
 * parent: State<T, N>
 * state: State<T> | null
 * index: number | undefined
 * allowed: (keyof T)[]
 * }) => State<T, N>} Navigator
 */

/**
 * `Route` is set of rules, describing how to navigate, build stack, redirect, encode and decode urls.
 * @template {Config} T
 * @template {keyof T} N
 * @typedef {{
 * keygen?: (params: T[N]) => string,
 * path?: {[K in keyof T[N] as undefined extends T[N][K] ? never : K]: ParamDef<T[N][K]>} & {[K in `_${string}`]?: string}
 * query?: {[K in keyof T[N] as undefined extends T[N][K] ? K : never]?: ParamDef<T[N][K]>}
 * navigator?: Navigator<T, N> | Navigator<T> | Navigator
 * allowed?: (keyof T)[]
 * builder?: (state: State<T, N>) => State<T, N>
 * redirector?: (state: State<T, N>) => State<T>[]
 * }} Route
 */

/**
 * `Routes` is a map of names to routes.
 * @template {Config} T
 * @typedef {{[N in keyof T]: Route<T, N>}} Routes
 */

/**
 * `Listener` callback is called with current root state when it changes.
 * @template {Config} T
 * @typedef {(state: State<T>) => void} Listener
 */

/**
 * `StateUpdate` helps to customize navigation when writing a navigator is too much.
 * @template {Config} T
 * @template {keyof T} [N=keyof T]
 * @typedef {{
 * params?: T[N] | ((params: T[N]) => T[N]),
 * stack?: State<T>[] | ((stack: State<T>[], params: T[N]) => State<T>[]),
 * index?: number | ((index: number, stack: State<T>[], params: T[N]) => number)
 * }} StateUpdate

 */

/**
 * Creates `Gouter` instance with provided routes config.
 * It's methods are used to modify navigation state and then notify listeners about it.
 * @template {Config} T
 */
class Gouter {
  /**
   * @param {Routes<T>} routes
   * @param {State<T>} rootState
   */
  constructor(routes, rootState) {
    for (const name of /** @type {(keyof this)[]} */ (
      Object.getOwnPropertyNames(Object.getPrototypeOf(this))
    )) {
      if (typeof this[name] === 'function') {
        this[name] = /** @type {Function} */ (this[name]).bind(this);
      }
    }

    /**
     * Record of names to routes.
     * Passed as parameter to Gouter constructor.
     * @protected
     * @type {Routes<T>}
     */
    this.routes = routes;

    /**
     * Top state which stores each other states in it's stack.
     * Passed as parameter to Gouter constructor.
     *
     * @protected
     * @type {State<T>}
     */
    this.rootState = rootState;

    /**
     * Set of listeners called in `setRootState` method when root state changes.
     * @protected
     * @type {Set<Listener<T>>}
     */
    this.listeners = new Set();

    /**
     * When greater than zero listeners' execution in `setRootState` will
     * run only at then end of `batch` method call.
     * @protected
     * @type {number}
     */
    this.batchDepth = 0;

    /**
     * Cache to speed up `getStateKeys` method.
     * @protected
     * @type {WeakMap<T[keyof T], string>}
     */
    this.paramsKeys = new WeakMap();

    /**
     * Cache to speed up `decodePath` method.
     * @protected
     * @type {{[N in keyof T]?: RegExp}}
     */
    this.pathRegexpByName = {};

    /**
     * `History` instance for web navigation or null otherwise.
     * @protected
     * @web
     * @type {import('history').History | null}
     */
    this.history = null;

    /**
     * Called when web navigation cannot decode url.
     * Should be passed to `enableHistory` method.
     * @protected
     * @web
     * @type {(url: string) => State<T>}
     */
    this.getNotFoundState = (url) => ({
      name: '',
      params: /** @type {any} */ ({ url }),
    });

    this.setRootState(rootState);
  }

  /**
   * Extracts key from state using keygen from state's route and cache for acceleration.
   * State name with slash is always prepended to keygen result.
   * @type {(state: State<T>) => string}
   */
  getStateKey(state) {
    const { paramsKeys, routes } = this;
    const { params } = state;
    const prevParamsKey = paramsKeys.get(params);
    if (prevParamsKey !== undefined) {
      return prevParamsKey;
    }
    const { name } = state;
    let paramsKey = /** @type {string} */ (name);
    const { keygen } = routes[name];
    if (keygen) {
      paramsKey += `/${keygen(params)}`;
    }
    paramsKeys.set(params, paramsKey);
    return paramsKey;
  }

  /**
   * Batches multiple `goTo`, `goBack` and `setRootState` calls.
   * Builders and listeners will be called only at the end of the batch
   * if processing not disabled.
   * @type {(callback: () => void, disableProcessing?: boolean) => void}
   */
  batch(callback, disableProcessing) {
    const { getRootState, setRootState } = this;
    const rootState = getRootState();
    this.batchDepth += 1;
    let error;
    try {
      callback();
    } catch (e) {
      error = e;
    }
    this.batchDepth -= 1;
    const nextRootState = getRootState();
    this.rootState = rootState;
    if (error !== undefined) {
      throw error;
    }
    if (disableProcessing) {
      this.rootState = nextRootState;
    } else {
      setRootState(nextRootState);
    }
  }

  /**
   * Builds new state from a `state` by passing it and `parents`to
   * appropriate state builder if any.
   *
   * Note: `builtPaths` should not be passed cause it is created automatically for recursion purposes.
   * @protected
   * @type {<N extends keyof T>(state: State<T, N>, builtPaths?: Set<string>) => State<T, N>}
   */
  buildState(state, builtPaths = new Set()) {
    const { routes, buildState, getStateKey } = this;
    const path = getStateKey(state);
    builtPaths.add(path);
    const { builder } = routes[state.name];
    const builtState = builder && !state.stack ? builder(state) : state;
    const { stack } = builtState;
    if (stack && stack.length > 0) {
      const builtStack = stack.map((stackState) => buildState(stackState, builtPaths));
      const builtStateExt = { ...builtState, stack: builtStack };
      return builtStateExt;
    }
    const builtStateExt = { ...builtState, stack: [] };
    return builtStateExt;
  }

  /**
   * Get true if states are equal, false otherwise.
   * @protected
   * @type {(stateA: State<T>, stateB: State<T>) => boolean}
   */
  getAreStatesEqual(stateA, stateB) {
    const { getAreStatesEqual } = this;
    if (stateA.name !== stateB.name || stateA.index !== stateB.index) {
      return false;
    }
    const paramsA = stateA.params;
    const paramsB = stateB.params;
    if (paramsA !== paramsB) {
      for (const key in paramsA) {
        if (
          paramsA[/** @type {keyof paramsA} */ (key)] !==
          paramsB[/** @type {keyof paramsB} */ (key)]
        ) {
          return false;
        }
      }
      for (const key in paramsB) {
        if (
          paramsA[/** @type {keyof paramsA} */ (key)] !==
          paramsB[/** @type {keyof paramsB} */ (key)]
        ) {
          return false;
        }
      }
    }
    const stackA = stateA.stack;
    const stackB = stateB.stack;
    if (stackA !== stackB) {
      if (stackA && stackB) {
        if (stackA.length !== stackB.length) {
          return false;
        }
        for (let i = 0; i < stackA.length; i += 1) {
          if (!getAreStatesEqual(stackA[i], stackB[i])) {
            return false;
          }
        }
      } else {
        return false;
      }
    }
    return true;
  }

  /**
   * Get current router root state.
   * @type {() => State<T>}
   */
  getRootState() {
    const { rootState } = this;
    return rootState;
  }

  /**
   * Build and set current router root state and call listeners with it but only if state is changed.
   * You may disable builders by using `disableBuilders` option.
   * @type {(state: State<T>, disableBuilders?: boolean) => void}
   */
  setRootState(state, disableBuilders) {
    const { rootState, batchDepth, getAreStatesEqual, buildState, listeners } = this;
    const builtState = disableBuilders ? state : buildState(state);
    if (batchDepth > 0) {
      this.rootState = state;
      return;
    }
    if (getAreStatesEqual(rootState, builtState)) {
      return;
    }
    this.rootState = builtState;
    for (const listener of listeners) {
      listener(builtState);
    }
  }

  /**
   * Get list of focused states from state where list sorted from bottom to top.
   * @protected
   * @type {(state: State<T>) => State<T>[]}
   */
  getFocusedStatesFromState(state) {
    const focusedStates = [state];
    let focusedState = state;
    for (;;) {
      const stack = focusedState.stack || [];
      const lastIndex = stack.length - 1;
      const index = focusedState.index !== undefined ? focusedState.index : lastIndex;
      focusedState = stack[index] || stack[lastIndex];
      if (focusedState && focusedStates.indexOf(focusedState) === -1) {
        focusedStates.push(focusedState);
      } else {
        return focusedStates.reverse();
      }
    }
  }

  /**
   * Get state from list of focused states where list sorted from bottom to top.
   * @protected
   * @type {(firstFocusedState: State<T>, focusedStates: State<T>[]) => State<T>}
   */
  getStateFromFocusedStates(firstFocusedState, focusedStates) {
    let state = firstFocusedState;
    for (let parentIndex = 1; parentIndex < focusedStates.length; parentIndex += 1) {
      const focusedState = focusedStates[parentIndex];
      const maybeStack = focusedState.stack;
      const stack = maybeStack && maybeStack.length > 1 ? [...maybeStack] : [state];
      const maxIndex = stack.length - 1;
      const stateIndex = focusedState.index !== undefined ? focusedState.index : maxIndex;
      const childStateIndex = Math.min(Math.max(0, stateIndex), maxIndex);
      stack[childStateIndex] = state;
      state = { ...focusedState, stack };
    }
    return state;
  }

  /**
   * Applies update to state.
   * Updates in the order: params -> stack -> index.
   * @protected
   * @type {<N extends keyof T>(state: State<T, N>, update: StateUpdate<T, N>) => State<T, N>}
   */
  getUpdatedState(state, update) {
    const { buildState } = this;
    const params =
      typeof update.params === 'function'
        ? update.params(state.params)
        : update.params || state.params;
    const stack = (
      typeof update.stack === 'function'
        ? update.stack(state.stack || [], params)
        : update.stack || state.stack || []
    ).map((stackState) => buildState(stackState));
    const index =
      typeof update.index === 'function'
        ? update.index(
            state.index !== undefined
              ? Math.min(Math.max(0, state.index), stack.length - 1)
              : stack.length - 1,
            stack,
            params,
          )
        : update.index;
    return { name: state.name, params, stack, index };
  }

  /**
   * Go to state using current stack navigator. First it searches for nearest state
   * with same key generated from passed name and params. If that state exists it
   * merges passed params, otherwise it creates new state with them.
   * Then it applies passed update (if any) in the order: params -> stack -> index.
   * @type {<N extends keyof T>(name: N, params: T[N], update?: StateUpdate<T, N>) => void}
   */
  goTo(name, params, update) {
    const {
      goTo,
      routes,
      rootState,
      getFocusedStatesFromState,
      getStateFromFocusedStates,
      buildState,
      getStateKey,
      setRootState,
      batch,
      getUpdatedState,
    } = this;
    const { redirector } = routes[name];
    if (redirector) {
      const redirectorStates = redirector({ name, params });
      for (const redirectorState of redirectorStates) {
        const {
          name: redirectedName,
          params: redirectedParams,
          stack = [],
          index = -1,
        } = redirectorState;
        batch(() => {
          goTo(redirectedName, redirectedParams, { stack, index });
        }, true);
      }
    }
    const state = /** @type {State<T, typeof name>} */ ({ name, params });
    const focusedStates = getFocusedStatesFromState(rootState);
    for (let index = 0; index < focusedStates.length; index += 1) {
      const focusedState = focusedStates[index];
      const { navigator, allowed } = routes[focusedState.name];
      if (navigator && allowed) {
        const parents = focusedStates.slice(index);
        if (allowed.includes(name)) {
          const [firstParent] = parents;
          let currentIndex;
          let currentState = state;
          const { stack: parentStack } = firstParent;
          if (parentStack && parentStack.length > 0) {
            const stateKey = getStateKey(state);
            for (let stackIndex = 0; stackIndex < parentStack.length; stackIndex += 1) {
              if (getStateKey(parentStack[stackIndex]) === stateKey) {
                currentIndex = stackIndex;
                currentState = /** @type {State<T, typeof name>} */ (parentStack[stackIndex]);
                break;
              }
            }
          }
          const builtState =
            currentIndex !== undefined
              ? { ...currentState, params: { ...currentState.params, ...state.params } }
              : buildState(state);
          const updatedState = update ? getUpdatedState(builtState, update) : builtState;
          const nextParent = /** @type {Navigator<T>} */ (navigator)({
            parent: firstParent,
            state: updatedState,
            index: currentIndex,
            allowed,
          });
          if (nextParent !== firstParent) {
            const nextState = getStateFromFocusedStates(nextParent, parents);
            setRootState(nextState, true);
            return;
          }
        }
      }
    }
  }

  /**
   * Go back using current stack navigator.
   * @type {() => void}
   */
  goBack() {
    const {
      routes,
      rootState,
      getFocusedStatesFromState,
      getStateFromFocusedStates,
      setRootState,
    } = this;
    const focusedStates = getFocusedStatesFromState(rootState);
    for (let index = 0; index < focusedStates.length; index += 1) {
      const focusedState = focusedStates[index];
      const { navigator, allowed } = routes[focusedState.name];
      if (navigator && allowed) {
        const parents = focusedStates.slice(index);
        const [firstParent] = parents;
        const nextParent = /** @type {Navigator<T>} */ (navigator)({
          state: null,
          parent: firstParent,
          allowed,
          index: undefined,
        });
        if (nextParent !== firstParent) {
          const nextState = getStateFromFocusedStates(nextParent, parents);
          setRootState(nextState, true);
          return;
        }
      }
    }
  }

  /**
   * Recursively iterates over inner states of current state and calls `replacer` for each state.
   * The `replacer` accepts current `state` and `parents` and returns `null` if current state should be removed,
   * modified state if current state should be modified or same state if current state should not be touched.
   *
   * Note: `parents` should not be passed cause it is created automatically for recursion purposes.
   * @protected
   * @type {(replacer: (state: State<T>, ...parents: State<T>[]) => State<T> | null, parents?: State<T>[]) => State<T>}
   */
  getReplacedState(replacer, parents = [this.rootState]) {
    const { getReplacedState, buildState } = this;
    const [state] = parents;
    const stack = state && state.stack;
    if (!stack) {
      return state;
    }
    /** @type {(State<T> | null)[]} */
    const modifiedStack = [...stack];
    let modified = false;
    for (let i = 0; i < stack.length; i += 1) {
      const subState = stack[i];
      const replacedSubStateOrNull = replacer(subState, ...parents);
      if (replacedSubStateOrNull === subState) {
        if (subState.stack) {
          const subStateModified = getReplacedState(replacer, [subState, ...parents]);
          if (subStateModified !== subState) {
            modified = true;
            modifiedStack[i] = subStateModified;
          }
        }
      } else {
        modified = true;
        modifiedStack[i] = replacedSubStateOrNull ? buildState(replacedSubStateOrNull) : null;
      }
    }
    if (modified) {
      /** @type {State<T>} */
      const modifiedState = {
        ...state,
        stack: /** @type {State<T>[]} */ (modifiedStack.filter(Boolean)),
      };
      return modifiedState;
    }
    return state;
  }

  /**
   * Recursively iterates over inner states of current state applying `replacer` for each and after that sets next state.
   * The `replacer` accepts current `state` and `parents` and returns `null` if current state should be removed,
   * modified state if current state should be modified or same state if current state should be skipped.
   * @type {(replacer: (state: State<T>, ...parents: State<T>[]) => State<T> | null) => void}
   */
  replace(replacer) {
    const { getReplacedState, setRootState } = this;
    const replacedState = getReplacedState(replacer);
    setRootState(replacedState, true);
  }

  /**
   * Adds new listener of router state changes to listeners and returns `unlisten` callback.
   * @type {(listener: Listener<T>) => () => void}
   */
  listen(listener) {
    const { listeners } = this;
    listeners.add(listener);
    const unlisten = () => {
      listeners.delete(listener);
    };
    return unlisten;
  }

  /**
   * Safely encodes a text string as a valid component of a Uniform Resource
   * Identifier (URI).
   * @protected
   * @type {(uriComponent: string) => string}
   */
  safeEncodeURIComponent(uriComponent) {
    return uriComponent.replace(/[/?&=#%]/g, encodeURIComponent);
  }

  /**
   * Creates url path string from state name and params.
   * Uses `=` to escape params which equal to next path key and also to represent empty string.
   * @protected
   * @type {<N extends keyof T>(name: N, params: Partial<T[N]>) => string}
   */
  encodePath(name, params) {
    const { routes, safeEncodeURIComponent } = this;
    const paramDefs = routes[name].path;
    let pathStr = '';
    let hasList = false;
    let sectionPos = 0;
    const escapeChar = '=';
    for (const key in paramDefs) {
      const paramDef = /** @type {ParamDef<any> | string} */ (paramDefs[/** @type {any} */ (key)]);
      if (typeof paramDef === 'object') {
        const { encode = String } = paramDef;
        const value = /** @type {any} */ (params)[key];
        if (paramDef.list) {
          if (hasList) {
            const valueEncoded = safeEncodeURIComponent(key);
            if (`/${pathStr.slice(sectionPos)}/`.includes(`/${valueEncoded}/`)) {
              const head = pathStr.slice(0, sectionPos);
              const section = pathStr
                .slice(sectionPos + 1)
                .split('/')
                .map((item) =>
                  item === valueEncoded ? `${escapeChar}${valueEncoded}` : item || escapeChar,
                )
                .join('/');
              pathStr = `${head}/${section}`;
            }
            pathStr += `/${valueEncoded}`;
            hasList = false;
            sectionPos = pathStr.length;
          } else {
            hasList = true;
          }
          if (Array.isArray(value) && value.length > 0) {
            const valueEncoded = value
              .map(encode)
              .map(safeEncodeURIComponent)
              .map((item) => item || escapeChar)
              .join('/');
            pathStr += `/${valueEncoded}`;
          }
        } else {
          const valueStr = encode(value);
          const valueEncoded = safeEncodeURIComponent(valueStr);
          pathStr += `/${valueEncoded || escapeChar}`;
        }
      } else {
        const valueEncoded = safeEncodeURIComponent(paramDef);
        if (`/${pathStr.slice(sectionPos)}/`.includes(`/${valueEncoded}/`)) {
          const head = pathStr.slice(0, sectionPos);
          const section = pathStr
            .slice(sectionPos + 1)
            .split('/')
            .map((item) =>
              item === valueEncoded ? `${escapeChar}${valueEncoded}` : item || escapeChar,
            )
            .join('/');
          pathStr = `${head}/${section}`;
        }
        pathStr += `/${valueEncoded}`;
        hasList = false;
        sectionPos = pathStr.length;
      }
    }
    return pathStr;
  }

  /**
   * Creates url query string from state name and params.
   * Uses `/` to represent empty array for params with `list: true`.
   * @protected
   * @type {<N extends keyof T>(name: N, params: Partial<T[N]>) => string}
   */
  encodeQuery(name, params) {
    const { routes, safeEncodeURIComponent } = this;
    let queryStr = '';
    const paramDefs = routes[name].query;
    if (!paramDefs) {
      return queryStr;
    }
    const listChar = '/';
    for (const key in paramDefs) {
      const paramDef = /** @type {ParamDef<any>} */ (paramDefs[key]);
      const value = /** @type {any} */ (params)[key];
      if (value !== undefined) {
        const keyEncoded = safeEncodeURIComponent(key);
        const { encode = String } = paramDef;
        if (paramDef.list) {
          if (Array.isArray(value)) {
            if (value.length > 0) {
              for (const item of value) {
                const itemStr = encode(item);
                const itemEncoded = safeEncodeURIComponent(itemStr);
                queryStr += `&${keyEncoded}${itemEncoded ? '=' : ''}${itemEncoded}`;
              }
            } else {
              queryStr += `&${keyEncoded}=${listChar}`;
            }
          }
        } else {
          const valueStr = encode(value);
          const valueEncoded = safeEncodeURIComponent(valueStr);
          queryStr += `&${keyEncoded}${valueEncoded ? '=' : ''}${valueEncoded}`;
        }
      }
    }
    queryStr = queryStr.slice(1);
    return queryStr;
  }

  /**
   * Create url from state name and params.
   * @type {(state: State<T>) => string}
   */
  encodeUrl(state) {
    const { encodePath, encodeQuery } = this;
    const { name, params } = state;
    const pathStr = encodePath(name, params);
    const queryStr = encodeQuery(name, params);
    const url = pathStr + (queryStr ? `?${queryStr}` : '');
    return url;
  }

  /**
   * Get path regexp from cache using route name.
   * @protected
   * @type {(name: keyof T) => RegExp}
   */
  getPathRegexp(name) {
    const { routes, safeEncodeURIComponent, pathRegexpByName } = this;
    const paramDefs = routes[name].path;
    const pathRegexp = pathRegexpByName[name];
    if (pathRegexp) {
      return pathRegexp;
    }
    const paramStr = '/([^/]*)';
    const listStr = '(.*)';
    let regexpStr = '';
    let hasList = false;
    for (const key in paramDefs) {
      const paramDef = /** @type {ParamDef<any> | string} */ (paramDefs[/** @type {any} */ (key)]);
      if (typeof paramDef === 'object') {
        if (paramDef.list) {
          if (hasList) {
            const valueEncoded = safeEncodeURIComponent(key);
            regexpStr += `/${valueEncoded}${listStr}`;
          } else {
            hasList = true;
            regexpStr += listStr;
          }
        } else {
          regexpStr += paramStr;
        }
      } else {
        const valueEncoded = safeEncodeURIComponent(paramDef);
        regexpStr += `/${valueEncoded}`;
        hasList = false;
      }
    }
    const newPathRegexp = RegExp(`^${regexpStr}$`);
    pathRegexpByName[name] = newPathRegexp;
    return newPathRegexp;
  }

  /**
   * Get required state params from path or null if path is not matched.
   * @protected
   * @type {<N extends keyof T>(name: N, pathStr: string) => Partial<T[N]> | null}
   */
  decodePath(name, pathStr) {
    const { routes, getPathRegexp } = this;
    const paramDefs = routes[name].path;
    const regexp = getPathRegexp(name);
    const groups = pathStr.match(regexp);
    if (!groups) {
      return null;
    }
    const escapeChar = '=';
    const params = /** @type {any} */ ({});
    let groupIndex = 0;
    for (const key in paramDefs) {
      const paramDef = /** @type {ParamDef<any> | string} */ (paramDefs[/** @type {any} */ (key)]);
      if (typeof paramDef === 'object') {
        groupIndex += 1;
        const group = groups[groupIndex];
        const { decode = String } = paramDef;
        if (paramDef.list) {
          params[key] = [];
          if (group) {
            for (const valueStr of group.slice(1).split('/')) {
              const valueStrUnescaped = valueStr[0] === escapeChar ? valueStr.slice(1) : valueStr;
              try {
                const valueEncoded = decodeURIComponent(valueStrUnescaped);
                const value = decode(valueEncoded);
                params[key].push(value);
              } catch (e) {
                return null;
              }
            }
          }
        } else {
          const valueStr = group;
          const valueStrUnescaped = valueStr[0] === escapeChar ? valueStr.slice(1) : valueStr;
          try {
            const valueEncoded = decodeURIComponent(valueStrUnescaped);
            const value = decode(valueEncoded);
            params[key] = value;
          } catch (e) {
            return null;
          }
        }
      }
    }
    return params;
  }

  /**
   * Creates query parameters from route name and url query string.
   * @protected
   * @type {<N extends keyof T>(name: N, queryStr: string) => Partial<T[N]>}
   */
  decodeQuery(name, queryStr) {
    const { routes } = this;
    const paramDefs = routes[name].query;
    const params = /** @type {any} */ ({});
    if (!paramDefs) {
      return params;
    }
    for (const keyValueStr of queryStr.split('&')) {
      const splitIndex = keyValueStr.indexOf('=');
      const keyEncoded = keyValueStr.slice(0, splitIndex === -1 ? undefined : splitIndex);
      try {
        const key = decodeURIComponent(keyEncoded);
        const paramDef = /** @type {ParamDef<any>} */ (
          paramDefs[/** @type {keyof typeof paramDefs} */ (key)]
        );
        const { decode } = paramDef;
        const valueStr = splitIndex === -1 ? '' : keyValueStr.slice(splitIndex + 1);
        const valueEncoded = decodeURIComponent(valueStr);
        const value = decode ? decode(valueEncoded) : valueEncoded;
        if (paramDef.list) {
          if (valueStr === '/') {
            params[key] = params[key] || [];
          } else if (params[key]) {
            params[key].push(value);
          } else {
            params[key] = [value];
          }
        } else {
          params[key] = value;
        }
      } catch (e) {
        /* empty */
      }
    }
    return params;
  }

  /**
   * Creates router state from url or returns null if no route found.
   * @type {(url: string) => State<T> | null}
   */
  decodeUrl(url) {
    const { routes, decodePath, decodeQuery } = this;
    const [, pathStr, queryStr] = /** @type {RegExpMatchArray} */ (
      url.match(/^([^?#]*)\??([^#]*)#?.*$/)
    );
    for (const name in routes) {
      const pathParams = decodePath(name, pathStr);
      if (pathParams) {
        const queryParams = decodeQuery(name, queryStr);
        /** @type {State<T>} */
        const state = {
          name,
          params: /** @type {any} */ ({ ...queryParams, ...pathParams }),
        };
        return state;
      }
    }
    return null;
  }

  /**
   * Syncs current browser location with state.
   * @protected
   * @web
   * @type {Listener<T>}
   */
  syncLocationWithState(state) {
    const { history, getFocusedStatesFromState, encodeUrl } = this;
    const [focusedState] = getFocusedStatesFromState(state);
    if (history && focusedState.name !== '_') {
      const url = encodeUrl(focusedState);
      const { location } = history;
      const browserUrl = location.pathname + location.search;
      if (browserUrl !== url) {
        history.push(url);
      }
    }
  }

  /**
   * Syncs current state with browser location.
   * @protected
   * @web
   * @type {import('history').Listener}
   */
  syncStateWithLocation({ location }) {
    const { decodeUrl, getNotFoundState, goTo } = this;
    const browserUrl = location.pathname + location.search;
    const state = decodeUrl(browserUrl) || getNotFoundState(browserUrl);
    goTo(state.name, state.params);
  }

  /**
   * Enables `history` package for web browser support.
   * @web
   * @type {(history: import('history').History, getNotFoundState: (url: string) => State<T>) => void}
   */
  enableHistory(history, getNotFoundState) {
    const { listen, syncLocationWithState, syncStateWithLocation } = this;
    this.history = history;
    this.getNotFoundState = getNotFoundState;
    listen(syncLocationWithState);
    history.listen(syncStateWithLocation);
    const action = /** @type {import('history').Action} */ ('PUSH');
    syncStateWithLocation({ location: history.location, action });
  }
}

export default Gouter;
