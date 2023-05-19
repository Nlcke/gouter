import { tokensToFunction, tokensToRegexp } from 'path-to-regexp';

/**
 * `PathParamDef` is url path parameter definition inside parameters definition at route map.
 * It converts path parameter of url into named parameter as string or string array and vice versa.
 * String arrays should have at least one element.
 * Modifier determines how url path should be treated:
 * - '' or undefined is required string
 * - '?' is optional string
 * - '+' is required string array with non-zero length
 * - '*' is optional string array with non-zero length
 * @typedef {[
 * prefix?: string,
 * regexp?: RegExp,
 * suffix?: string,
 * modifier?: '' | '?' | '+' | '*'
 * ]} PathParamDef
 */

/**
 * `QueryParamDef` is url query parameter definition inside parameters definition at route map.
 * It converts query parameter of url into named parameter using `decode` and vice versa
 * using `encode`. If `required` is true then query parameter is required, otherwise it is optional.
 * @template T
 * @typedef {{
 * decode: (str: string) => T
 * encode: (val: T) => string
 * required?: boolean
 * }} QueryParamDef
 */

/**
 * `Param` is required static (`string`), path (`PathParamDef`) or query (`QueryParamDef`) parameter definition.
 * @typedef {string | PathParamDef | QueryParamDef<any>} ParamDef
 */

/**
 * `Params` is parameter collection, where key is parameter name, used inside route map.
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
 * params: {[K in keyof T[N] as
 * T[N][K] extends PathParamDef ?
 * T[N][K][3] extends '' ? K : T[N][K][3] extends '+' ?
 * K : T[N][K]['length'] extends 0 | 1 | 2 | 3 ? K : never :
 * T[N][K] extends QueryParamDef<any> ? T[N][K] extends {required: true} ?
 * K : never : never]:
 * T[N][K] extends QueryParamDef<any> ? ReturnType<T[N][K]['decode']> :
 * T[N][K] extends PathParamDef ? T[N][K][3] extends '+' ? string[] : string : string}
 * & {[K in keyof T[N] as
 * T[N][K] extends PathParamDef ?
 * T[N][K][3] extends '?' ? K : T[N][K][3] extends '*' ?
 * K : never : T[N][K] extends QueryParamDef<any> ? T[N][K] extends {required: true} ?
 * never : K : never]?:
 * T[N][K] extends PathParamDef ?
 * T[N][K][3] extends '?' ? string : T[N][K][3] extends '*' ?
 * string[] : never : T[N][K] extends QueryParamDef<any> ?
 * ReturnType<T[N][K]['decode']> : never}
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
 * `Builder` is a function called to modify state when a state without stack is added to current state.
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
 * `Builder` is a function called to modify state when a state without stack is added to current state.
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
 * `PathToRegexpOptions` are used to customize url decoding/encoding.
 * See https://www.npmjs.com/package/path-to-regexp
 * @typedef {import('path-to-regexp').ParseOptions
 * & import('path-to-regexp').TokensToRegexpOptions } PathToRegexpOptions
 */

/**
 * @typedef {Gouter<any>} GouterInstance
 */

/**
 * Creates `Gouter` instance with available routes. It's methods are used to modify navigation
 * state and then notify listeners about it.
 * @template {Routes & {_: {url: []}}} T
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
     * `rootState` stores current router root state. Initially it set to not-found state so you need
     * to use `setRootState` method before navigation.
     * @type {State<T>}
     */
    this.rootState = { name: '_', params: /** @type {any} */ ({ url: '' }), stack: [] };

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
     * `redirections` stores current redirection functions customized for each route where you need it.
     * You may set it using `setRedirections` and get it using `getRedirections`.
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
     * `pathToRegexpOptions` are options used to encode states into urls' paths at `encodePath`.
     * @protected
     * @type {PathToRegexpOptions}
     *
     */
    this.pathToRegexpOptions = {};

    /**
     * `regexpFunctionCache` stores Regexp function cache used for `getRegexpFunction` to decode
     * urls into states.
     * @protected
     * @type {Partial<Record<keyof T, RegExp['exec']>>}
     */
    this.regexpFunctionCache = {};

    Object.assign(this.regexpFunctionCache, { _: () => null });

    /**
     * `pathFunctionCache` stores PathFunction cache used to encode states into urls' paths at
     * `encodePath`.
     * @protected
     * @type {Partial<Record<keyof T, import('path-to-regexp').PathFunction<object>>>}
     */
    this.pathFunctionCache = {};

    Object.assign(this.pathFunctionCache, {
      _: (/** @type {Record<String, any>} */ params) => ('url' in params ? String(params.url) : ''),
    });

    /**
     * `pathCacheByName` stores path cache for each route name to speed up `encodePath`.
     * @protected
     * @type {Partial<Record<keyof T, WeakMap<object, string>>>}
     */
    this.pathCacheByName = {};

    /**
     * `listeners` stores list of listeners called when current state changes.
     * @protected
     * @type {Listener<T>[]}
     */
    this.listeners = [];

    /**
     * `defaultPattern` stores default pattern string for current delimiter in pathToRegexpOptions.
     * @protected
     * @type {string}
     */
    this.defaultPattern = '[^\\/#\\?]+?';

    /**
     * Generates path-to-regexp tokens from parameters definition.
     * Generated tokens are used for `getRegexpFunction` and `encodePath`.
     * @protected
     * @type {(paramDefs: ParamDefs) => (string | import('path-to-regexp').Key)[]}
     */
    this.getTokensFromParamDefs = (paramDefs) => {
      const { defaultPattern } = this;
      /** @type {(string | import('path-to-regexp').Key)[]} */
      const tokens = [];
      for (const name in paramDefs) {
        const paramDef = paramDefs[name];
        if (Array.isArray(paramDef)) {
          const [prefix = '/', regexp, suffix = '', modifier = ''] = paramDef;
          const pattern = regexp ? regexp.toString().slice(1, -1) : defaultPattern;
          /** @type {import('path-to-regexp').Key} */
          const key = {
            name,
            prefix,
            suffix,
            pattern,
            modifier,
          };
          tokens[tokens.length] = key;
        } else if (typeof paramDef === 'string') {
          tokens[tokens.length] = paramDef;
        }
      }
      return tokens;
    };

    /**
     * Creates url path string from state name and params.
     * @type {(state: State<T>) => string}
     */
    this.encodePath = (state) => {
      const {
        routeMap,
        pathFunctionCache,
        pathToRegexpOptions,
        getTokensFromParamDefs,
        pathCacheByName,
      } = this;
      const { name, params } = state;
      const pathFunction = pathFunctionCache[name];
      if (pathFunction) {
        return pathFunction(params);
      }
      const paramDefs = routeMap[name];
      const tokens = getTokensFromParamDefs(paramDefs);
      const newPathFunction = tokensToFunction(tokens, pathToRegexpOptions);
      const pathCache = pathCacheByName[name] || new WeakMap();
      pathCacheByName[name] = pathCache;
      /** @type {import('path-to-regexp').PathFunction<object>} */
      const newPathFunctionWithCache = (parameters = {}) => {
        const path = pathCache.get(parameters);
        if (path !== undefined) {
          return path;
        }
        const newPath = newPathFunction(parameters);
        pathCache.set(parameters, newPath);
        return newPath;
      };
      pathFunctionCache[name] = newPathFunctionWithCache;
      return newPathFunctionWithCache(params);
    };

    /**
     * Create url query string from state name and params.
     * @type {(state: State<T>) => string}
     */
    this.encodeQuery = (state) => {
      const { routeMap } = this;
      const { name, params } = state;
      let queryStr = '';
      const paramDefs = routeMap[name];
      for (const key in params) {
        const paramDef = paramDefs[key];
        const encode = typeof paramDef === 'object' && !Array.isArray(paramDef) && paramDef.encode;
        if (encode) {
          const value = params[/** @type {keyof params} */ (key)];
          /** @type {string} */
          let keyEncoded = key;
          try {
            keyEncoded = encodeURIComponent(key);
          } catch (e) {
            /* empty */
          }
          const valueStr = encode(value);
          let valueEncoded = encodeURIComponent(valueStr);
          try {
            valueEncoded = encodeURIComponent(valueStr);
          } catch (e) {
            /* empty */
          }
          queryStr += `&${keyEncoded}=${valueEncoded}`;
        }
      }
      if (queryStr) {
        queryStr = `?${queryStr.slice(1)}`;
      }
      return queryStr;
    };

    /**
     * Create url from state name and params.
     * @type {(state: State<T>) => string}
     */
    this.encodeUrl = (state) => {
      const { encodePath, encodeQuery } = this;
      const pathStr = encodePath(state);
      const queryStr = encodeQuery(state);
      const url = pathStr + queryStr;
      return url;
    };

    /**
     * Get regexp function from route name. It is used for `decodePath`.
     * @protected
     * @type {(name: keyof T) => RegExp['exec']}
     */
    this.getRegexpFunction = (name) => {
      const { regexpFunctionCache, routeMap, pathToRegexpOptions, getTokensFromParamDefs } = this;
      const regexpFunction = regexpFunctionCache[name];
      if (regexpFunction) {
        return regexpFunction;
      }
      const paramDefs = routeMap[name];
      const tokens = getTokensFromParamDefs(paramDefs);
      const regexp =
        tokens.length > 0 ? tokensToRegexp(tokens, undefined, pathToRegexpOptions) : /^$/;
      const newRegexpFunction = regexp.exec.bind(regexp);
      regexpFunctionCache[name] = newRegexpFunction;
      return newRegexpFunction;
    };

    /**
     * Get required state params from path or null if path is not matched.
     * @type {<N extends keyof T>(name: N, path: string) => StateMap<T>[N]['params'] | null}
     */
    this.decodePath = (name, path) => {
      const { getRegexpFunction, routeMap } = this;
      const regexpFunction = getRegexpFunction(name);
      const match = regexpFunction(path);
      if (match) {
        const params = /** @type {StateMap<T>[typeof name]['params']} */ ({});
        const paramDefs = routeMap[name];
        let index = 0;
        for (const key in paramDefs) {
          const paramsKey = /** @type {keyof StateMap<T>[typeof name]['params']} */ (
            /** @type {unknown} */ (key)
          );
          const paramDef = paramDefs[key];
          if (Array.isArray(paramDef)) {
            index += 1;
            const result = match[index];
            const modifier = paramDef[3];
            if (modifier === '+' || modifier === '*') {
              const prefix = paramDef[0] || '';
              const suffix = paramDef[2] || '';
              const divider = prefix + suffix;
              params[paramsKey] = /** @type {params[paramsKey]} */ (
                divider ? result.split(divider) : [result]
              );
            } else {
              params[paramsKey] = /** @type {params[paramsKey]} */ (result);
            }
          }
        }
        return params;
      }
      return null;
    };

    /**
     * Creates optional route parameters from route name and url query string, if possible.
     * If not then returns null.
     * @type {<N extends keyof T>(name: N, queryStr: string) => StateMap<T>[N]['params'] | null}
     */
    this.decodeQuery = (name, queryStr) => {
      const { routeMap } = this;
      const params = /** @type {StateMap<T>[typeof name]['params']} */ ({});
      const paramDefs = routeMap[name];
      for (const keyValueStr of queryStr.split('&')) {
        const splitIndex = keyValueStr.indexOf('=');
        const keyEncoded = keyValueStr.slice(0, splitIndex);
        let key = keyEncoded;
        try {
          key = decodeURIComponent(keyEncoded);
        } catch (e) {
          /* empty */
        }
        const paramDef = paramDefs[key];
        const decode = typeof paramDef === 'object' && !Array.isArray(paramDef) && paramDef.decode;
        if (decode) {
          const valueStr = keyValueStr.slice(splitIndex + 1);
          let valueEncoded = valueStr;
          try {
            valueEncoded = decodeURIComponent(valueStr);
          } catch (e) {
            /* empty */
          }
          const value = decode(valueEncoded);
          params[/** @type {keyof StateMap<T>[typeof name]['params']} */ (key)] = value;
        }
      }
      for (const key in paramDefs) {
        if (!(key in params)) {
          const paramValue = paramDefs[key];
          const required =
            typeof paramValue === 'object' && !Array.isArray(paramValue) && paramValue.required;
          if (required) {
            return null;
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
      const [pathname, search = ''] = urlWithoutHash.split('?');
      for (const name in routeMap) {
        const params = decodePath(name, pathname);
        if (params) {
          const query = decodeQuery(name, search);
          if (!query) {
            break;
          }
          for (const key in query) {
            params[key] = query[key];
          }
          const state = /** @type {State<T> & {name: typeof name}} */ ({ name, params });
          return state;
        }
      }
      const state = { name: '_', params: /** @type {any} */ ({ url }), stack: [] };
      return state;
    };

    /**
     * Recursively creates flat list of every child state inside current state.
     * @protected
     * @type {(state: State<T>) => State<T>[]}
     */
    this.stateToStack = (state) => {
      const { stateToStack } = this;
      const stateList = [state];
      const stack = state.stack || [];
      for (const subState of stack) {
        stateList[stateList.length] = subState;
        if (subState.stack && subState.stack.length > 0) {
          const subStateStack = stateToStack(subState);
          for (const subStateStackState of subStateStack) {
            stateList[stateList.length] = subStateStackState;
          }
        }
      }
      return stateList;
    };

    /**
     * Builds new state from a `state` by passing it and `parents`to
     * appropriate state builder if any.
     *
     * Note: `builtPaths` should not be passed cause it is created automatically for recursion purposes.
     * @type {(state: State<T>, parents: State<T>[], builtPaths?: Set<string>) => State<T>}
     */
    this.buildState = (state, parents, builtPaths = new Set()) => {
      const { builders, buildState, encodePath } = this;
      const path = encodePath(state);
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
     * Build and set current router root state and call listeners with it but only if state is changed.
     * You may disable builders by using `disableBuilders` option.
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
          focusedStates[focusedStates.length] = focusedState;
        } else {
          return focusedStates.reverse();
        }
      }
    };

    /**
     * Get merged state where params are merged and index and stack (if any) are replaced by nextState ones.
     * @type {(prevState: State<T>, nextState: State<T>) => State<T>}
     */
    this.getMergedState = (prevState, nextState) => {
      /** @type {State<T>} */
      const mergedState = {
        name: nextState.name,
        params: { ...prevState.params, ...nextState.params },
        stack: nextState.stack ? nextState.stack : prevState.stack,
        index: nextState.index !== undefined ? nextState.index : prevState.index,
      };
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
              statesOrNullsExt[statesOrNullsExt.length] = redirectionState;
            }
            statesOrNullsExt[statesOrNullsExt.length] = state;
          } else {
            statesOrNullsExt[statesOrNullsExt.length] = state;
          }
        } else {
          statesOrNullsExt[statesOrNullsExt.length] = null;
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
      const state = /** @type {State<T> & {name: typeof name}} */ ({ name, params, stack, index });
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
     * The `replacer` accepts current `state` and `parents` and returns `null` if current state should be removed,
     * modified state if current state should be modified or same state if current state should not be touched.
     *
     * Note: `parents` should not be passed cause it is created automatically for recursion purposes.
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
     * Recursively iterates over inner states of current state applying `replacer` for each and after that sets next state.
     * The `replacer` accepts current `state` and `parents` and returns `null` if current state should be removed,
     * modified state if current state should be modified or same state if current state should be skipped.
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
      const { listeners } = this;
      this.listeners = [...listeners, listener];
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
     * Get path-to-regexp options.
     * `PathToRegexpOptions` are used to customize url decoding/encoding.
     * See https://www.npmjs.com/package/path-to-regexp
     * @type {() => PathToRegexpOptions}
     */
    this.getPathToRegexpOptions = () => {
      const { pathToRegexpOptions } = this;
      return pathToRegexpOptions;
    };

    /**
     * Set path-to-regexp options.
     * `PathToRegexpOptions` are used to customize url decoding/encoding.
     * See https://www.npmjs.com/package/path-to-regexp
     * @type {(pathToRegexpOptions: PathToRegexpOptions) => void}
     */
    this.setPathToRegexpOptions = (pathToRegexpOptions) => {
      this.pathToRegexpOptions = pathToRegexpOptions;
      const escapeRegexp = /([.+*?=^!:${}()[\]|/\\])/g;
      const delimiter = pathToRegexpOptions.delimiter || '/#?';
      this.defaultPattern = `[^${delimiter.replace(escapeRegexp, '\\$1')}]+?`;
    };

    /**
     * Syncs current browser location with state.
     * @protected
     * @web
     * @type {Listener<T>}
     */
    this.syncLocationWithState = (state) => {
      const { history, getFocusedStates } = this;
      const [focusedState] = getFocusedStates(state);
      if (history && focusedState.name !== '_') {
        const url = this.encodeUrl(focusedState);
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
