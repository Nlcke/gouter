import { tokensToFunction, tokensToRegexp } from 'path-to-regexp';

/**
 * `PathSegment` is used to define a parameter inside parameters definition at route map.
 * It converts segment of url path into named parameter as string or string array and vice versa.
 * Modifier determines how url path should be treated:
 * - '' or undefined is required string
 * - '?' is optional string
 * - '+' is required string array with non-zero length
 * - '*' is optional string array with non-zero length
 * @typedef {[
 * prefix?: string,
 * regexp?: RegExp | null,
 * suffix?: string,
 * modifier?: '' | '?' | '+' | '*'
 * ]} PathSegment
 */

/**
 * `Serializable` is used to define optional query parameter inside parameters definition at
 * route map. It converts part of url query into named parameter using `decode` and vice versa
 * using `encode`.
 * @template T
 * @typedef {{
 * decode: (str: string) => T
 * encode: (val: T) => string
 * }} Serializable
 */

/**
 * `ParamValueDef` is used to define parts of url (`string`), required (`PathSegment`) and
 * optional (`Serializable`) parameters.
 * @typedef {string | PathSegment | Serializable<any>} ParamValueDef
 */

/**
 * `ParamsDef` is used to define parameters of a route at route map.
 * @typedef {Record<string, ParamValueDef>} ParamsDef
 */

/**
 * `Routes` is passed to Gouter to define route parameters for each route name
 * @typedef {Record<string, ParamsDef>} Routes
 */

/**
 * `StateMap<T>` is used to get route name and params from route name.
 * @template {Routes} T
 * @typedef {{[N in keyof T]: {
 * name: N
 * params: {[K in keyof T[N] as
 * T[N][K] extends PathSegment ?
 * T[N][K][3] extends '' ? K : T[N][K][3] extends '+' ?
 * K : T[N][K]['length'] extends 0 | 1 | 2 | 3 ? K : never : never]:
 * T[N][K] extends PathSegment ? T[N][K][3] extends '+' ? string[] : string : string}
 * & {[K in keyof T[N] as
 * T[N][K] extends PathSegment ?
 * T[N][K][3] extends '?' ? K : T[N][K][3] extends '*' ?
 * K : never : T[N][K] extends Serializable<any> ?
 * K : never]?: T[N][K] extends PathSegment ?
 * T[N][K][3] extends '?' ? string : T[N][K][3] extends '*' ?
 * string[] : never : T[N][K] extends Serializable<any> ?
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
 * `Navigators` is used to define `Navigator` for each route where you need it.
 * @template {Routes} T
 * @typedef {{[N in keyof T]?: Navigator<T, N>}} Navigators
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
 * `Builder` is a function called to modify state when a state without stack is added to current state
 * @template {Routes} T
 * @template {keyof T} N
 * @typedef {(state: StateMap<T>[N] & State<T>, ...parents: State<T>[]) => State<T>} Builder
 */

/**
 * `Listener` function is called with current state when it changes.
 * @template {Routes} T
 * @typedef {(state: State<T>) => void} Listener
 */

/**
 * `Builders` is used to define stack builder for each route where you need it.
 * @template {Routes} T
 * @typedef {{[N in keyof T]?: Builder<T, N>}} Builders
 */

/**
 * @typedef {Gouter<any>} GouterInstance
 */

/**
 * Creates `Gouter` instance with available routes. It's methods are used to modify navigation
 * state and then notify listeners about it.
 * @template {Routes} T
 * @param {T} routes map of routes
 */
class Gouter {
  /** @param {T} routes map of routes  */
  constructor(routes) {
    /**
     * `routeMap` stores routes passed to Gouter. They are used to decode and encode states and
     * urls, and help with type suggestions for route parameters.
     * @type {T}
     */
    this.routeMap = routes;

    /**
     * @type {Navigator<T, keyof T>}
     */
    this.navigator = (_, parent) => parent;

    /**
     * @type {Builder<T, keyof T>}
     */
    this.builder = (state) => state;

    /**
     * `getNotFoundStateFromUrl` stores callback to create not-found state from url to use on web.
     * @protected
     * @web
     * @type {(url: string) => State<T>}
     */
    this.getNotFoundStateFromUrl = (url) => ({
      name: '',
      params: /** @type {any} */ ({ url }),
      stack: [],
    });

    /**
     * `state` stores current router state. Initially it set to `notFoundState`.
     * @type {State<T>}
     */
    this.state = { name: '', params: /** @type {any} */ ({}), stack: [] };

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
     * `history` stores `history` instance used for web navigation.
     * @protected
     * @web
     * @type {import('history').History | null}
     */
    this.history = null;

    /**
     * `pathToRegexpOptions` are options used to encode states into urls' paths at `encodePath`.
     * @type {import('path-to-regexp').ParseOptions
     * & import('path-to-regexp').TokensToRegexpOptions}
     */
    this.pathToRegexpOptions = {};

    /**
     * `regexpFunctionCache` stores Regexp function cache used for `getRegexpFunction` to decode
     * urls into states.
     * @protected
     * @type {Partial<Record<keyof T, RegExp['exec']>>}
     */
    this.regexpFunctionCache = {};

    /**
     * `pathFunctionCache` stores PathFunction cache used to encode states into urls' paths at
     * `encodePath`.
     * @protected
     * @type {Partial<Record<keyof T, import('path-to-regexp').PathFunction<object>>>}
     */
    this.pathFunctionCache = {};

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
     * Generates path-to-regexp tokens from parameters definition.
     * Generated tokens are used for `getRegexpFunction` and `encodePath`.
     * @protected
     * @type {(paramsDef: ParamsDef, options: import('path-to-regexp').ParseOptions)
     * => (string | import('path-to-regexp').Key)[]}
     */
    this.getTokensFromParamsDef = (paramsDef, options) => {
      /** @type {(string | import('path-to-regexp').Key)[]} */
      const tokens = [];
      const escapeRegexp = /([.+*?=^!:${}()[\]|/\\])/g;
      const defaultPattern = `[^${(options.delimiter || '/#?').replace(escapeRegexp, '\\$1')}]+?`;
      for (const name in paramsDef) {
        const segment = paramsDef[name];
        if (Array.isArray(segment)) {
          const [prefix = '/', regexp = null, suffix = '', modifier = ''] = segment;
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
        } else if (typeof segment === 'string') {
          tokens[tokens.length] = segment;
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
        getTokensFromParamsDef,
        pathCacheByName,
      } = this;
      const { name, params } = state;
      const pathFunction = pathFunctionCache[name];
      if (pathFunction) {
        return pathFunction(params);
      }
      const paramsDef = routeMap[name];
      const tokens = getTokensFromParamsDef(paramsDef, pathToRegexpOptions);
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
      const paramsDef = routeMap[name];
      for (const key in params) {
        const segment = paramsDef[key];
        const encode = typeof segment === 'object' && !Array.isArray(segment) && segment.encode;
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
      const { regexpFunctionCache, routeMap, pathToRegexpOptions, getTokensFromParamsDef } = this;
      const regexpFunction = regexpFunctionCache[name];
      if (regexpFunction) {
        return regexpFunction;
      }
      const paramsDef = routeMap[name];
      const tokens = getTokensFromParamsDef(paramsDef, pathToRegexpOptions);
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
        const paramsDef = routeMap[name];
        let index = 0;
        for (const key in paramsDef) {
          const paramsKey = /** @type {keyof StateMap<T>[typeof name]['params']} */ (
            /** @type {unknown} */ (key)
          );
          const segment = paramsDef[key];
          if (Array.isArray(segment)) {
            index += 1;
            const result = match[index];
            const modifier = segment[3];
            if (modifier === '+' || modifier === '*') {
              const prefix = segment[0] || '';
              const suffix = segment[2] || '';
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
     * Generates optional route parameters from url query string and route name.
     * @type {<N extends keyof T>(name: N, queryStr: string) => StateMap<T>[N]['params']}
     */
    this.decodeQuery = (name, queryStr) => {
      const { routeMap } = this;
      const params = /** @type {StateMap<T>[typeof name]['params']} */ ({});
      const paramsDef = routeMap[name];
      for (const keyValueStr of queryStr.split('&')) {
        const splitIndex = keyValueStr.indexOf('=');
        const keyEncoded = keyValueStr.slice(0, splitIndex);
        let key = keyEncoded;
        try {
          key = decodeURIComponent(keyEncoded);
        } catch (e) {
          /* empty */
        }
        const segment = paramsDef[key];
        const decode = typeof segment === 'object' && !Array.isArray(segment) && segment.decode;
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
      return params;
    };

    /**
     * Generates router state from url. If route not found then notFoundState returned.
     * @type {(url: string) => State<T> | null}
     */
    this.decodeUrl = (url) => {
      const { decodePath, routeMap, decodeQuery } = this;
      const [urlWithoutHash] = url.split('#');
      const [pathname, search = ''] = urlWithoutHash.split('?');
      for (const name in routeMap) {
        const params = decodePath(name, pathname);
        if (params) {
          if (search) {
            const query = decodeQuery(name, search);
            for (const key in query) {
              params[key] = query[key];
            }
          }
          const state = /** @type {State<T> & {name: typeof name}} */ ({ name, params });
          return state;
        }
      }
      return null;
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
     * Note: `builtPaths` should not be passed cause it is created automatically.
     * @type {(state: State<T>, parents: State<T>[], builtPaths?: Set<string>) => State<T>}
     */
    this.buildState = (state, parents, builtPaths = new Set()) => {
      const { builders, buildState, encodePath } = this;
      const path = encodePath(state);
      if (builtPaths.has(path)) {
        return state;
      }
      builtPaths.add(path);
      const builder = builders[state.name];
      const builtState = builder ? builder(state, ...parents) : state;
      const { stack } = builtState;
      if (stack && stack.length > 0) {
        const stackStateParents = [builtState, ...parents];
        const builtStack = stack.map((stackState) =>
          buildState(stackState, stackStateParents, builtPaths),
        );
        const builtStateExt = { ...builtState, stack: builtStack };
        return builtStateExt;
      }
      return builtState;
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
    this.getState = () => {
      const { state } = this;
      return state;
    };

    /**
     * Set current router state and call listeners with it but only if state is changed.
     * @type {(state: State<T>) => void}
     */
    this.setState = (state) => {
      const { state: currentState, getAreStatesEqual, listeners } = this;
      if (getAreStatesEqual(currentState, state)) {
        return;
      }
      this.state = state;
      for (const listener of listeners) {
        listener(state);
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
        ...prevState,
        ...nextState,
        params: { ...prevState.params, ...nextState.params },
      };
      return mergedState;
    };

    /**
     * Go through the chain of actions to get next state.
     * @type {(...statesOrNulls: (State<T> | null)[]) => State<T>}
     */
    this.getNextState = (...statesOrNulls) => {
      const {
        state: currentState,
        navigators,
        getFocusedStates,
        buildState,
        encodePath,
        findParents,
      } = this;
      let nextState = currentState;
      /** @type {Set<State<T>>} */
      const builtStatesSet = new Set();
      for (
        let stateOrNullIndex = 0;
        stateOrNullIndex < statesOrNulls.length;
        stateOrNullIndex += 1
      ) {
        const stateOrNull = statesOrNulls[stateOrNullIndex];
        const focusedStates = getFocusedStates(nextState);
        for (let index = 0; index < focusedStates.length; index += 1) {
          const focusedState = focusedStates[index];
          const navigator = navigators[focusedState.name];
          if (navigator) {
            const parents = /** @type {[StateMap<T>[keyof T] & State<T>, ...State<T>[]]} */ (
              focusedStates.slice(index)
            );
            const builtStateOrNull =
              stateOrNull && !builtStatesSet.has(stateOrNull)
                ? buildState(stateOrNull, parents)
                : stateOrNull;
            /** @type {State<T>[] | null} */
            const redirectedParents =
              stateOrNull &&
              builtStateOrNull &&
              encodePath(stateOrNull) !== encodePath(builtStateOrNull)
                ? findParents(stateOrNull, [builtStateOrNull], encodePath).map((parent) => ({
                    name: parent.name,
                    params: parent.params,
                  }))
                : null;
            const builtStateOrNullExt = redirectedParents ? redirectedParents[0] : builtStateOrNull;
            const subState = navigator(builtStateOrNullExt, ...parents);
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
              if (redirectedParents && stateOrNull) {
                builtStatesSet.add(stateOrNull);
                statesOrNulls.splice(
                  stateOrNullIndex,
                  0,
                  ...redirectedParents.slice(1),
                  stateOrNull,
                );
              }
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
      const { getNextState, setState } = this;
      const nextState = getNextState(...statesOrNulls);
      setState(nextState);
    };

    /**
     * Go to state using current stack navigator.
     * @type {<N extends keyof T>
     * (name: N, params: StateMap<T>[N]['params'], stack?: State<T>[], index?: number) => void}
     */
    this.goTo = (name, params, stack, index) => {
      const { getNextState, setState } = this;
      const state = /** @type {State<T> & {name: typeof name}} */ ({ name, params, stack, index });
      const nextState = getNextState(state);
      setState(nextState);
    };

    /**
     * Go back using current stack navigator.
     * @type {() => void}
     */
    this.goBack = () => {
      const { getNextState, setState } = this;
      const nextState = getNextState(null);
      setState(nextState);
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
     * Finds `searchState` and replaces it by `replaceState`. Returns `true` if state was replaced,
     * `false` otherwise. It compares states using strict equality (===) if `encoder` is not defined.
     * @type {(searchState: State<T>, replaceState: State<T>, encoder?: (state: State<T>) => string) => boolean}
     */
    this.replace = (searchState, replaceState, encoder) => {
      const { state, setState, findParents } = this;
      if (searchState === state) {
        setState(replaceState);
        return true;
      }
      const parents = findParents(searchState, [state], encoder);
      if (parents.length > 0) {
        const nextState = { ...state };
        let subState = nextState;
        for (const parent of [...parents.slice(1), searchState]) {
          if (!subState.stack) {
            break;
          }
          const index = subState.stack.indexOf(parent);
          subState.stack = [...subState.stack];
          const nextSubState = { ...parent };
          subState.stack[index] = parent === searchState ? replaceState : nextSubState;
          subState = nextSubState;
        }
        setState(nextState);
        return true;
      }
      return false;
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
     * Updates browser/memory history and url from state.
     * @protected
     * @web
     * @type {Listener<T>}
     */
    this.updateHistory = (state) => {
      const { history, getNotFoundStateFromUrl } = this;
      if (history && state.name !== getNotFoundStateFromUrl('').name) {
        const url = this.encodeUrl(state);
        const { location } = history;
        const browserUrl = `${location.pathname}${location.search}`;
        if (browserUrl !== url) {
          history.push(url);
        }
      }
    };

    /**
     * Goes to new router state from history location:
     * * history location is transformed into url
     * * url is transformed into new router state or not-found state
     * * router goes to router state if it is different from previous one
     * @protected
     * @web
     * @type {import('history').Listener}
     */
    this.goToLocation = ({ location }) => {
      const { decodeUrl, go, getNotFoundStateFromUrl } = this;
      const url = location.pathname + location.search;
      const state = decodeUrl(url) || getNotFoundStateFromUrl(url);
      go(state);
    };

    /**
     * Enables `history` package for web browser support.
     * @web
     * @type {(history: import('history').History, getNotFoundStateFromUrl: (url: string)=> State<T>)
     * => void}
     */
    this.enableHistory = (history, getNotFoundStateFromUrl) => {
      const { listen, updateHistory, goToLocation } = this;
      this.history = history;
      this.getNotFoundStateFromUrl = getNotFoundStateFromUrl;
      listen(updateHistory);
      history.listen(goToLocation);
      const action = /** @type {import('history').Action} */ ('PUSH');
      goToLocation({ location: history.location, action });
    };
  }
}

export default Gouter;
