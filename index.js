/**
 * `ParamDef` is parameter definition. It could be a string or object. In case of string it is
 * static path parameter. Object with `path` key set to true is path parameter, otherwise it is
 * query parameter. The `list` defines a parameter as array of values and `req` makes a parameter
 * required in state params. The transformation could be adjusted using `decode` and `encode`
 * fields, where `decode` creates a value from string, and `encode` converts value back to string.
 * By default `String` function is used for `decode` and `encode` if they are not defined.
 * @template [T=any]
 * @template [L=boolean]
 * @typedef {string | {
 * path?: boolean
 * list?: boolean
 * decode?: (str: string) => T
 * encode?: (val: T) => string
 * }} ParamDef
 */

/**
 * @template {ParamDef} T
 * @typedef {T extends {list: true} ? T extends {decode: (str: string) => infer R} ? R[]
 * : string[] : T extends {decode: (str: string) => infer R} ? R : string} ParamDefType
 */

/**
 * `Params` is parameter collection used inside route map,
 * where key is name and value is definition.
 * @typedef {Record<string, ParamDef>} ParamDefs
 */

/**
 * `Routes` is route collection, where key is route name, used as Gouter parameter.
 * @typedef {Record<string, ParamDefs>} Routes
 */

/**
 * `StateMap<T>` is state collection, where key is route name.
 * It has only `name` and `params` inside each state and used to create full `State`s.
 * @template {Routes} T
 * @typedef {{[N in keyof T]: {
 * name: N
 * params: {[K in keyof T[N] as T[N][K] extends string ? never : T[N][K] extends {path: true} ? K : never]: ParamDefType<T[N][K]>} &
 *  {[K in keyof T[N] as T[N][K] extends string ? never : T[N][K] extends {path: true} ? never : K]?: ParamDefType<T[N][K]>}
 * }}} StateMap
 */

/**
 * `State<T>` is Gouter unit with required name, params, optional stack of states and optional
 * index of focused state in state stack to create complex navigation.
 * @template {Routes} T
 * @typedef {StateMap<T>[keyof T] & {stack?: State<T>[], index?: number}} State
 */

/**
 * `Navigator` is a function called when you attempt to change current state using `go`,
 * `goTo` or `goBack`.
 * @template {Routes} T
 * @template {keyof T} N
 * @typedef {(stateOrNull: State<T> | null, parent: StateMap<T>[N] & State<T>, ...parents: State<T>[])
 * => State<T> | null} Navigator
 */

/**
 * `Navigators` is `Navigator` collection, where key is route name.
 * @template {Routes} T
 * @typedef {{[N in keyof T]?: Navigator<T, N>}} Navigators
 */

/**
 * `Builder` is a function called to modify state when a state without stack is added to current
 * state.
 * @template {Routes} T
 * @template {keyof T} N
 * @typedef {(state: StateMap<T>[N] & State<T>, ...parents: State<T>[]) => State<T>} Builder
 */

/**
 * `Builders` is `Builder` collection, where key is route name.
 * @template {Routes} T
 * @typedef {{[N in keyof T]?: Builder<T, N>}} Builders
 */

/**
 * `Redirection` is a function called to modify state when a state without stack is added to current
 * state.
 * @template {Routes} T
 * @template {keyof T} N
 * @typedef {(state: StateMap<T>[N] & State<T>) => State<T>[]} Redirection
 */

/**
 * `Redirections` is `Redirection` collection, where key is route name.
 * @template {Routes} T
 * @typedef {{[N in keyof T]?: Redirection<T, N>}} Redirections
 */

/**
 * `Listener` function is called with current state when it changes.
 * @template {Routes} T
 * @typedef {(state: State<T>) => void} Listener
 */

/**
 * @typedef {{
 * $: { path: true, req: true, list: true },
 * }} NotFoundParamDefs
 */

/**
 * @typedef {Gouter<any>} GouterInstance
 */

/**
 * Creates `Gouter` instance with available routes. It's methods are used to modify navigation
 * state and then notify listeners about it.
 * @template {Routes & {_: NotFoundParamDefs}} T
 * @param {T} routes map of routes
 */
class Gouter {
  /** @param {T} routes map of routes  */
  constructor(routes) {
    /**
     * `routeMap` stores routes passed to Gouter. They are used to decode and encode states and
     * urls, and help with type suggestions for route parameters.
     * @readonly
     * @type {Readonly<T>}
     */
    this.routeMap = routes;

    /**
     * `rootState` stores current router root state. Initially it set to not-found state so you
     * need to use `setRootState` method before navigation.
     * @type {State<T>}
     */
    this.rootState = { name: '_', params: /** @type {any} */ ({ $: [] }), stack: [] };

    /**
     * `navigators` stores current navigators customized for each route where you need it.
     * You may set it using `setNavigators` and get it using `getNavigators`.
     * @protected
     * @type {Navigators<T>}
     */
    this.navigators = {};

    /**
     * `builders` stores current builders customized for each route where you need it.
     * You may set it using `setBuilders` and get it using `getBuilders`.
     * @protected
     * @type {Builders<T>}
     */
    this.builders = {};

    /**
     * `redirections` stores current redirection functions customized for each route where you
     * need it. You may set it using `setRedirections` and get it using `getRedirections`.
     * @protected
     * @type {Redirections<T>}
     */
    this.redirections = {};

    /**
     * `history` stores `history` instance used for web navigation.
     * @protected
     * @web
     * @type {import('history').History | null}
     */
    this.history = null;

    /**
     * `listeners` stores list of listeners called when current state changes.
     * @protected
     * @type {Listener<T>[]}
     */
    this.listeners = [];

    /**
     * `regexpByParamDefs` stores path regexp for each route name to speed up `decodePath`.
     * @protected
     * @type {Partial<Record<keyof T, RegExp>>}
     */
    this.regexpByParamDefs = {};

    /**
     * Get path regexp from cache using route name.
     * @type {<N extends keyof T>(name: N) => RegExp}
     */
    this.getPathRegexp = (name) => {
      const { routeMap, safeEncodeURIComponent, regexpByParamDefs } = this;
      const segmentStr = '(?:/[^/]*)';
      const paramDefs = routeMap[name];
      const pathRegexp = regexpByParamDefs[name];
      if (pathRegexp) {
        return pathRegexp;
      }
      let minRepeats = 0;
      let maxRepeats = 0;
      let regexpStr = '';
      for (const key in paramDefs) {
        const paramDef = paramDefs[key];
        if (typeof paramDef === 'object') {
          if (paramDef.path) {
            if (paramDef.list) {
              maxRepeats = Infinity;
            } else {
              minRepeats += 1;
              maxRepeats += 1;
            }
          }
        } else {
          if (minRepeats > 0 || maxRepeats > 0) {
            regexpStr += `(${segmentStr}{${minRepeats},${
              maxRepeats === Infinity ? '' : maxRepeats
            }})`;
            minRepeats = 0;
            maxRepeats = 0;
          }
          const valueEncoded = safeEncodeURIComponent(paramDef);
          regexpStr += `/${valueEncoded}`;
        }
      }
      if (minRepeats > 0 || maxRepeats > 0) {
        regexpStr += `(${segmentStr}{${minRepeats},${maxRepeats === Infinity ? '' : maxRepeats}})`;
      }
      const newPathRegexp = RegExp(`^${regexpStr}$`);
      regexpByParamDefs[name] = newPathRegexp;
      return newPathRegexp;
    };

    /**
     * Safely gets the unencoded version of an encoded component of a Uniform Resource
     * Identifier (URI).
     * @protected
     * @type {(encodedURIComponent: string) => string}
     */
    this.safeDecodeURIComponent = (encodedURIComponent) => {
      try {
        return decodeURIComponent(encodedURIComponent);
      } catch (e) {
        return encodedURIComponent;
      }
    };

    /**
     * Safely encodes a text string as a valid component of a Uniform Resource
     * Identifier (URI).
     * @protected
     * @type {(uriComponent: string) => string}
     */
    this.safeEncodeURIComponent = (uriComponent) => {
      try {
        return encodeURIComponent(uriComponent);
      } catch (e) {
        return uriComponent;
      }
    };

    /**
     * Creates url path string from state name and params.
     * @type {<N extends keyof T>(name: N, params: StateMap<T>[N]['params']) => string}
     */
    this.encodePath = (name, params) => {
      const { routeMap, safeEncodeURIComponent } = this;
      const paramDefs = routeMap[name];
      let pathStr = '';
      let staticParamPos = 0;
      let undefinedParamLength = 0;
      for (const key in paramDefs) {
        const paramDef = paramDefs[key];
        if (typeof paramDef === 'object') {
          if (paramDef.path) {
            const { encode = String } = paramDef;
            const value = /** @type {any} */ (params)[key];
            if (paramDef.list) {
              if (Array.isArray(value)) {
                if (value.length > 0) {
                  const valueEncoded = value.map(encode).map(safeEncodeURIComponent).join('/');
                  pathStr += `/${valueEncoded}`;
                  pathStr += '/$';
                  undefinedParamLength = 2;
                } else {
                  pathStr += '/$';
                  undefinedParamLength += 2;
                }
              }
            } else {
              const valueStr = encode(value);
              const valueEncoded = safeEncodeURIComponent(valueStr);
              pathStr += `/${valueEncoded}`;
              undefinedParamLength = 0;
            }
          } else {
            pathStr += '/$';
            undefinedParamLength += 2;
          }
        } else {
          const valueEncoded = safeEncodeURIComponent(paramDef);
          const firstPart = pathStr.slice(0, staticParamPos);
          const lastPart = `${pathStr.slice(
            staticParamPos,
            undefinedParamLength ? -undefinedParamLength : undefined,
          )}/`
            .split(`/${valueEncoded}/`)
            .join(`/$${valueEncoded}/`);
          pathStr = `${firstPart}${lastPart}${valueEncoded}`;
          staticParamPos = pathStr.length;
          undefinedParamLength = 0;
        }
      }
      if (undefinedParamLength) {
        pathStr = pathStr.slice(0, undefinedParamLength ? -undefinedParamLength : undefined);
      }
      return pathStr;
    };

    /**
     * Creates url query string from state name and params.
     * @type {<N extends keyof T>(name: N, params: StateMap<T>[N]['params']) => string}
     */
    this.encodeQuery = (name, params) => {
      const { routeMap, safeEncodeURIComponent } = this;
      let queryStr = '';
      const paramDefs = routeMap[name];
      for (const key in paramDefs) {
        const paramDef = paramDefs[key];
        if (typeof paramDef === 'object' && !paramDef.path) {
          const value = /** @type {any} */ (params)[key];
          if (value !== undefined) {
            const keyEncoded = safeEncodeURIComponent(key);
            const { encode = String } = paramDef;
            if (paramDef.list) {
              if (Array.isArray(value)) {
                if (value.length > 0) {
                  const valueEncoded = value
                    .map(encode)
                    .map(safeEncodeURIComponent)
                    .join(`&${keyEncoded}=`);
                  queryStr += `&${keyEncoded}=${valueEncoded}`;
                } else {
                  queryStr += `&${keyEncoded}=$`;
                }
              }
            } else {
              const valueStr = encode(value);
              if (valueStr !== '') {
                const valueEncoded = safeEncodeURIComponent(valueStr);
                queryStr += `&${keyEncoded}=${valueEncoded}`;
              }
            }
          }
        }
      }
      queryStr = queryStr.slice(1);
      return queryStr;
    };

    /**
     * Create url from state name and params.
     * @type {(state: State<T>) => string}
     */
    this.encodeUrl = (state) => {
      const { encodePath, encodeQuery } = this;
      const { name, params } = state;
      const pathStr = encodePath(name, params);
      const queryStr = encodeQuery(name, params);
      const url = pathStr + (queryStr ? `?${queryStr}` : '');
      return url;
    };

    /**
     * Get required state params from path or null if path is not matched.
     * @type {<N extends keyof T>(name: N, pathStr: string) => StateMap<T>[N]['params'] | null}
     */
    this.decodePath = (name, pathStr) => {
      const { routeMap, safeDecodeURIComponent, getPathRegexp } = this;
      const paramDefs = routeMap[name];
      const regexp = getPathRegexp(name);
      const match = pathStr.match(regexp);
      if (!match) {
        return null;
      }
      const groups = match.slice(1).map((str) => (str ? str.slice(1).split('/') : []));
      let groupIndex = 0;
      let sectionIndex = 0;
      let isPrevDynamic = false;
      const params = /** @type {any} */ ({});
      for (const key in paramDefs) {
        const paramDef = paramDefs[key];
        if (typeof paramDef === 'object') {
          if (paramDef.path) {
            isPrevDynamic = true;
            const group = groups[groupIndex];
            const { decode } = paramDef;
            if (paramDef.list) {
              if (group[sectionIndex] === '$' || group[sectionIndex] === undefined) {
                sectionIndex += 1;
              } else {
                params[key] = [];
                while (sectionIndex < group.length) {
                  const valueStr = group[sectionIndex];
                  sectionIndex += 1;
                  if (valueStr === '$') {
                    break;
                  }
                  const valueStrUnescaped = valueStr[0] === '$' ? valueStr.slice(1) : valueStr;
                  const valueEncoded = safeDecodeURIComponent(valueStrUnescaped);
                  const value = decode ? decode(valueEncoded) : valueEncoded;
                  params[key].push(value);
                }
              }
            } else {
              const valueStr = group[sectionIndex];
              if (valueStr !== undefined && valueStr !== '$') {
                const valueStrUnescaped = valueStr[0] === '$' ? valueStr.slice(1) : valueStr;
                const valueEncoded = safeDecodeURIComponent(valueStrUnescaped);
                const value = decode ? decode(valueEncoded) : valueEncoded;
                params[key] = value;
              }
              sectionIndex += 1;
            }
          }
        } else if (isPrevDynamic) {
          groupIndex += 1;
          sectionIndex = 0;
          isPrevDynamic = false;
        }
      }
      return params;
    };

    /**
     * Creates query parameters from route name and url query string.
     * @type {<N extends keyof T>(name: N, queryStr: string) => StateMap<T>[N]['params']}
     */
    this.decodeQuery = (name, queryStr) => {
      const { routeMap, safeDecodeURIComponent } = this;
      const paramDefs = routeMap[name];
      const params = /** @type {any} */ ({});
      for (const keyValueStr of queryStr.split('&')) {
        const splitIndex = keyValueStr.indexOf('=');
        const keyEncoded = keyValueStr.slice(0, splitIndex === -1 ? undefined : splitIndex);
        const key = safeDecodeURIComponent(keyEncoded);
        const paramDef = paramDefs[key];
        if (typeof paramDef === 'object') {
          if (!paramDef.path) {
            const { decode } = paramDef;
            const valueStr = splitIndex === -1 ? '' : keyValueStr.slice(splitIndex + 1);
            const valueEncoded = safeDecodeURIComponent(valueStr);
            const value = decode ? decode(valueEncoded) : valueEncoded;
            if (paramDef.list) {
              if (valueStr === '$') {
                params[key] = params[key] || [];
              } else if (params[key]) {
                params[key].push(value);
              } else {
                params[key] = [value];
              }
            } else {
              params[key] = value;
            }
          }
        }
      }
      return params;
    };

    /**
     * Generates router state from url. If route not found then notFoundState returned.
     * @type {(url: string) => State<T>}
     */
    this.decodeUrl = (url) => {
      const { decodePath, routeMap, decodeQuery } = this;
      const [urlWithoutHash] = url.split('#');
      const [pathStr, queryStr = ''] = urlWithoutHash.split('?');
      for (const name in routeMap) {
        if (name !== '_') {
          const params = decodePath(name, pathStr);
          if (params) {
            const query = decodeQuery(name, queryStr);
            Object.assign(params, query);
            const state = /** @type {State<T>} */ ({
              name,
              /** @type {any} */
              params,
            });
            return state;
          }
        }
      }
      const state = /** @type {State<T> & {name: '_'}} */ ({
        name: '_',
        params: {
          ...decodePath('_', pathStr),
          ...decodeQuery('_', queryStr),
        },
        stack: [],
      });
      return state;
    };

    /**
     * Builds new state from a `state` by passing it and `parents`to
     * appropriate state builder if any.
     *
     * Note: `builtPaths` should not be passed cause it is created automatically for recursion
     * purposes.
     * @type {(state: State<T>, parents: State<T>[], builtPaths?: Set<string>) => State<T>}
     */
    this.buildState = (state, parents, builtPaths = new Set()) => {
      const { builders, buildState, encodePath } = this;
      const path = encodePath(state.name, state.params);
      builtPaths.add(path);
      const builder = builders[state.name];
      const builtState = builder && !state.stack ? builder(state, ...parents) : state;
      const { stack } = builtState;
      if (stack && stack.length > 0) {
        const stackStateParents = [builtState, ...parents];
        const builtStack = stack.map((stackState) =>
          buildState(stackState, stackStateParents, builtPaths),
        );
        const builtStateExt = { ...builtState, stack: builtStack };
        return builtStateExt;
      }
      const builtStateExt = { ...builtState, stack: [] };
      return builtStateExt;
    };

    /**
     * Get true if states are equal, false otherwise.
     * @type {(stateA: State<T>, stateB: State<T>) => boolean}
     */
    this.getAreStatesEqual = (stateA, stateB) => {
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
    };

    /**
     * Get current router state
     * @type {() => State<T>}
     */
    this.getRootState = () => {
      const { rootState } = this;
      return rootState;
    };

    /**
     * Build and set current router root state and call listeners with it but only if state is
     * changed. You may disable builders by using `disableBuilders` option.
     * @type {(state: State<T>, disableBuilders?: boolean) => void}
     */
    this.setRootState = (state, disableBuilders) => {
      const { rootState, getAreStatesEqual, buildState, listeners } = this;
      const builtState = disableBuilders ? state : buildState(state, []);
      if (getAreStatesEqual(rootState, builtState)) {
        return;
      }
      this.rootState = builtState;
      for (const listener of listeners) {
        listener(builtState);
      }
    };

    /**
     * Get list of focused states from top to root.
     * @protected
     * @type {(state: State<T>) => State<T>[]}
     */
    this.getFocusedStates = (state) => {
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
    };

    /**
     * Get merged state where params are merged and index and stack (if any) are replaced by
     * next state params.
     * @type {(prevState: State<T>, nextState: State<T>) => State<T>}
     */
    this.getMergedState = (prevState, nextState) => {
      const mergedState = /** @type {State<T>} */ ({
        name: nextState.name,
        params: { ...prevState.params, ...nextState.params },
        stack: nextState.stack ? nextState.stack : prevState.stack,
        index: nextState.index !== undefined ? nextState.index : prevState.index,
      });
      return mergedState;
    };

    /**
     * Go through the chain of actions to get next state.
     * @type {(...statesOrNulls: (State<T> | null)[]) => State<T>}
     */
    this.getNextState = (...statesOrNulls) => {
      const { rootState, navigators, getFocusedStates, buildState } = this;
      let nextState = rootState;
      for (const stateOrNull of statesOrNulls) {
        const focusedStates = getFocusedStates(nextState);
        for (let index = 0; index < focusedStates.length; index += 1) {
          const focusedState = focusedStates[index];
          const navigator = navigators[focusedState.name];
          if (navigator) {
            const parents = /** @type {[StateMap<T>[keyof T] & State<T>, ...State<T>[]]} */ (
              focusedStates.slice(index)
            );
            const builtStateOrNull = stateOrNull ? buildState(stateOrNull, parents) : stateOrNull;
            const subState = navigator(builtStateOrNull, ...parents);
            if (subState) {
              let childState = subState;
              for (const parent of parents.slice(1)) {
                const maybeStack = parent.stack;
                const stack = maybeStack && maybeStack.length > 1 ? [...maybeStack] : [childState];
                const maxIndex = stack.length - 1;
                const parentIndex = parent.index !== undefined ? parent.index : maxIndex;
                const childStateIndex = Math.min(Math.max(0, parentIndex), maxIndex);
                stack[childStateIndex] = childState;
                childState = { ...parent, stack };
              }
              nextState = childState;
              break;
            }
          }
        }
      }
      return nextState;
    };

    /**
     * Go through the chain of actions where `State<T>` is used for `goTo`
     * and `null` is used for `goBack`.
     * @type {(...statesOrNulls: (State<T> | null)[]) => void}
     */
    this.go = (...statesOrNulls) => {
      const { getNextState, setRootState, redirections } = this;
      /** @type {(State<T> | null)[]} */
      const statesOrNullsExt = [];
      for (const stateOrNull of statesOrNulls) {
        if (stateOrNull) {
          const state = stateOrNull;
          const redirection = redirections[state.name];
          if (redirection) {
            const redirectionStates = redirection(state);
            for (const redirectionState of redirectionStates) {
              statesOrNullsExt.push(redirectionState);
            }
            statesOrNullsExt.push(state);
          } else {
            statesOrNullsExt.push(state);
          }
        } else {
          statesOrNullsExt.push(null);
        }
      }
      const nextState = getNextState(...statesOrNullsExt);
      setRootState(nextState, true);
    };

    /**
     * Go to state using current stack navigator.
     * @type {<N extends keyof T>
     * (name: N, params: StateMap<T>[N]['params'], stack?: State<T>[], index?: number) => void}
     */
    this.goTo = (name, params, stack, index) => {
      const { go } = this;
      const state = /** @type {State<T> & {name: typeof name}} */ ({
        name,
        /** @type {any} */
        params,
        stack,
        index,
      });
      go(state);
    };

    /**
     * Go back using current stack navigator.
     * @type {() => void}
     */
    this.goBack = () => {
      const { getNextState, setRootState } = this;
      const nextState = getNextState(null);
      setRootState(nextState, true);
    };

    /**
     * Find state parents to use in `replace`.
     * @type {(state: State<T>, parents: State<T>[], encoder?: (state: State<T>) => string) => State<T>[]}
     */
    this.findParents = (state, parents, encoder) => {
      const { findParents } = this;
      const parent = parents[parents.length - 1];
      if (parent) {
        if (encoder ? encoder(parent) === encoder(state) : parent === state) {
          return parents.slice(0, -1);
        }
        for (const parentState of parent.stack || []) {
          const nextParents = findParents(state, [...parents, parentState], encoder);
          if (nextParents.length > 0) {
            return nextParents;
          }
        }
      }
      return [];
    };

    /**
     * Recursively iterates over inner states of current state and calls `replacer` for each state.
     * The `replacer` accepts current `state` and `parents` and returns `null` if current state
     * should be removed, modified state if current state should be modified or same state if
     * current state should not be touched.
     *
     * Note: `parents` should not be passed cause it is created automatically for recursion
     * purposes.
     * @type {(replacer: (state: State<T>, ...parents: State<T>[]) => State<T> | null, parents?: State<T>[]) => State<T>}
     */
    this.getReplacedState = (replacer, parents = [this.rootState]) => {
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
          if (replacedSubStateOrNull) {
            modifiedStack[i] = buildState(replacedSubStateOrNull, parents);
          } else {
            modifiedStack[i] = replacedSubStateOrNull;
          }
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
    };

    /**
     * Recursively iterates over inner states of current state applying `replacer` for each and
     * after that sets next state. The `replacer` accepts current `state` and `parents` and returns
     * `null` if current state should be removed, modified state if current state should be
     * modified or same state if current state should be skipped.
     * @type {(replacer: (state: State<T>, ...parents: State<T>[]) => State<T> | null) => void}
     */
    this.replace = (replacer) => {
      const { getReplacedState, setRootState } = this;
      const replacedState = getReplacedState(replacer);
      setRootState(replacedState, true);
    };

    /**
     * Adds new listener of router state changes to listeners and returns `unlisten` callback.
     * @type {(listener: Listener<T>) => () => void}
     */
    this.listen = (listener) => {
      this.listeners = [...this.listeners, listener];
      const unlisten = () => {
        this.listeners = this.listeners.filter((prevListener) => prevListener !== listener);
      };
      return unlisten;
    };

    /**
     * Get navigators map.
     * @type {() => Navigators<T>}
     */
    this.getNavigators = () => {
      const { navigators } = this;
      return navigators;
    };

    /**
     * Set navigators map.
     * @type {(navigators: Navigators<T>) => void}
     */
    this.setNavigators = (navigators) => {
      this.navigators = navigators;
    };

    /**
     * Get builders map.
     * @type {() => Builders<T>}
     */
    this.getBuilders = () => {
      const { builders } = this;
      return builders;
    };

    /**
     * Set builders map.
     * @type {(builders: Builders<T>) => void}
     */
    this.setBuilders = (builders) => {
      this.builders = builders;
    };

    /**
     * Get redirections map.
     * @type {() => redirections<T>}
     */
    this.getRedirections = () => {
      const { redirections } = this;
      return redirections;
    };

    /**
     * Set redirections map.
     * @type {(redirections: Redirections<T>) => void}
     */
    this.setRedirections = (redirections) => {
      this.redirections = redirections;
    };

    /**
     * Syncs current browser location with state.
     * @protected
     * @web
     * @type {Listener<T>}
     */
    this.syncLocationWithState = (state) => {
      const { history, getFocusedStates, encodeUrl } = this;
      const [focusedState] = getFocusedStates(state);
      if (history && focusedState.name !== '_') {
        const url = encodeUrl(focusedState);
        const { location } = history;
        const browserUrl = location.pathname + location.search;
        if (browserUrl !== url) {
          history.push(url);
        }
      }
    };

    /**
     * Syncs current state with browser location.
     * @protected
     * @web
     * @type {import('history').Listener}
     */
    this.syncStateWithLocation = ({ location }) => {
      const { decodeUrl, go } = this;
      const browserUrl = location.pathname + location.search;
      const state = decodeUrl(browserUrl);
      go(state);
    };

    /**
     * Enables `history` package for web browser support.
     * @web
     * @type {(history: import('history').History) => void}
     */
    this.enableHistory = (history) => {
      const { listen, syncLocationWithState, syncStateWithLocation } = this;
      this.history = history;
      listen(syncLocationWithState);
      history.listen(syncStateWithLocation);
      const action = /** @type {import('history').Action} */ ('PUSH');
      syncStateWithLocation({ location: history.location, action });
    };
  }
}

export default Gouter;
