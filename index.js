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
 * Creates `Gouter` instance with available routes. It's methods are used to modify navigation
 * state and then notify listeners about it.
 * @template {Routes} T
 * @param {T} routes map of routes
 */
class Gouter {
  /**
   * @typedef {keyof T & string} Name
   */

  /**
   * `StateMap` is used to get route name and params from route name.
   * @typedef {{[N in Name]: {
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
   * `State` is Gouter unit with required name, params and optional stack of states to create
   * complex navigation.
   * @typedef {StateMap[keyof StateMap] & {stack?: State[]}} State
   */

  /**
   * `Navigator` is a function called when you attempt to change current state using `go`,
   * `goTo` or `goBack`.
   * @template {Name} N
   * @typedef {(stateOrNull: State | null, parent: StateMap[N] & State, ...parents: State[])
   * => State | null} Navigator
   */

  /**
   * `Builder` is a function called to modify state when a state without stack is added to current state
   * @template {Name} N
   * @typedef {(state: StateMap[N] & State, ...parents: State[]) => State} Builder
   */

  /**
   * `Listener` function is called with current state when it changes.
   * @callback Listener
   * @param {State} state
   * @returns {void}
   */

  /**
   * `Navigators` is used to define `Navigator` for each route where you need it.
   * @typedef {{[K in Name]?: Navigator<K>}} Navigators
   */

  /**
   * `Builders` is used to define `stackBuilder` for each route where you need it.
   * @typedef {{[K in Name]?: Builder<K>}} Builders
   */

  /** @param {T} routes map of routes  */
  constructor(routes) {
    /**
     * `routeMap` stores routes passed to Gouter. They are used to decode and encode states and
     * urls, and help with type suggestions for route parameters.
     * @protected
     * @type {T}
     */
    this.routeMap = routes;

    /**
     * @type {Navigator<Name>}
     */
    this.navigator = (_, parent) => parent;

    /**
     * @type {Builder<Name>}
     */
    this.builder = (state) => state;

    /**
     * `getNotFoundStateFromUrl` stores callback to create not-found state from url to use on web.
     * @protected
     * @web
     * @type {(url: string) => State}
     */
    this.getNotFoundStateFromUrl = (url) => ({
      name: '',
      params: /** @type {any} */ ({ url }),
      stack: [],
    });

    /**
     * `state` stores current router state. Initially it set to `notFoundState`.
     * @type {State}
     */
    this.state = { name: '', params: /** @type {any} */ ({}), stack: [] };

    /**
     * `navigators` stores current navigators customized for each route where you need it.
     * You may set it using `setNavigators` and get it using `getNavigators`.
     * @protected
     * @type {Navigators}
     */
    this.navigators = {};

    /**
     * `builders` stores current builders customized for each route where you need it.
     * You may set it using `setBuilders` and get it using `getBuilders`.
     * @protected
     * @type {Builders}
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
     * @type {Object<string, RegExp['exec']>}
     */
    this.regexpFunctionCache = {};

    /**
     * `pathFunctionCache` stores PathFunction cache used to encode states into urls' paths at
     * `encodePath`.
     * @protected
     * @type {Object<string, import('path-to-regexp').PathFunction<object>>}
     */
    this.pathFunctionCache = {};

    /**
     * `pathCacheByName` stores path cache for each route name to speed up `encodePath`.
     * @protected
     * @type {Record<string, WeakMap<object, string>>}
     */
    this.pathCacheByName = {};

    /**
     * `listeners` stores list of listeners called when current state changes.
     * @protected
     * @type {Listener[]}
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
          const [prefix = '', regexp = null, suffix = '', modifier = ''] = segment;
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
     * @type {(state: State) => string}
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
     * @type {(state: State) => string}
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
     * @type {(state: State) => string}
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
     * @type {(name: Name) => RegExp['exec']}
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
     * @type {<N extends Name>(name: N, path: string) => StateMap[N]['params'] | null}
     */
    this.decodePath = (name, path) => {
      const { getRegexpFunction, routeMap } = this;
      const regexpFunction = getRegexpFunction(name);
      const match = regexpFunction(path);
      if (match) {
        const params = /** @type {StateMap[typeof name]['params']} */ ({});
        const paramsDef = routeMap[name];
        let index = 0;
        for (const key in paramsDef) {
          const paramsKey = /** @type {keyof StateMap[typeof name]['params']} */ (
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
     * @type {<N extends Name>(name: N, queryStr: string) => StateMap[N]['params']}
     */
    this.decodeQuery = (name, queryStr) => {
      const { routeMap } = this;
      const params = /** @type {StateMap[typeof name]['params']} */ ({});
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
          params[/** @type {keyof StateMap[typeof name]['params']} */ (key)] = value;
        }
      }
      return params;
    };

    /**
     * Generates router state from url. If route not found then notFoundState returned.
     * @type {(url: string) => State | null}
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
          const state = /** @type {State & {name: typeof name}} */ ({ name, params });
          return state;
        }
      }
      return null;
    };

    /**
     * Recursively creates flat list of every child state inside current state.
     * @protected
     * @type {(state: State) => State[]}
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
     * Builds new state from a state
     * @type {(state: State, parents: State[]) => State}
     */
    this.buildState = (state, parents) => {
      const { builders, buildState } = this;
      const { stack } = state;
      if (stack && stack.length === 0) {
        return state;
      }
      const builder = builders[state.name];
      const builtState = builder && !stack ? builder(state, ...parents) : state;
      const stackStateParents = [builtState, ...parents];
      const builtStack = (builtState.stack || []).map((stackState) =>
        buildState(stackState, stackStateParents),
      );
      if (
        state.stack &&
        state.stack.every((stackState, index) => stackState === builtStack[index])
      ) {
        return state;
      }
      const builtStateWithStack = { ...builtState, stack: builtStack };
      return builtStateWithStack;
    };

    /**
     * Get current router state
     * @type {() => State}
     */
    this.getState = () => {
      const { state } = this;
      return state;
    };

    /**
     * Set current router state and call listeners with it if any.
     * @type {(state: State) => void}
     */
    this.setState = (state) => {
      const { buildState, listeners } = this;
      const builtState = buildState(state, []);
      this.state = builtState;
      for (const listener of listeners) {
        listener(builtState);
      }
    };

    /**
     * Get list of focused states from top to root.
     * @protected
     * @type {(state: State) => State[]}
     */
    this.getFocusedStates = (state) => {
      const focusedStates = [state];
      let lastState = state;
      for (;;) {
        const stack = lastState.stack || [];
        lastState = stack[stack.length - 1];
        if (lastState && focusedStates.indexOf(lastState) === -1) {
          focusedStates[focusedStates.length] = lastState;
        } else {
          return focusedStates.reverse();
        }
      }
    };

    /**
     * Go through the chain of actions where `State` is used for `goTo` and `null` is used
     * for `goBack`.
     * @type {(...statesOrNulls: (State | null)[]) => void}
     */
    this.go = (...statesOrNulls) => {
      const { state: currentState, navigators, getFocusedStates, listeners, buildState } = this;
      let nextState = currentState;
      for (const state of statesOrNulls) {
        const focusedStates = getFocusedStates(nextState);
        for (let index = 0; index < focusedStates.length; index += 1) {
          const focusedState = focusedStates[index];
          const navigator = navigators[focusedState.name];
          if (navigator) {
            const parents = /** @type {[StateMap[Name] & State, ...State[]]} */ (
              focusedStates.slice(index)
            );
            const builtState = state ? buildState(state, parents) : null;
            const subState = navigator(builtState, ...parents);
            if (subState) {
              let childState = subState;
              for (const parent of parents.slice(1)) {
                childState = {
                  ...parent,
                  stack: [...(parent.stack ? parent.stack.slice(0, -1) : []), childState],
                };
              }
              nextState = childState;
              break;
            }
          }
        }
      }
      this.state = nextState;
      for (const listener of listeners) {
        listener(nextState);
      }
    };

    /**
     * Go to state using `shouldGoTo` and `onGoTo` hooks.
     * @type {<N extends Name>(name: N, params: StateMap[N]['params'], stack?: State[]) => void}
     */
    this.goTo = (name, params, stack) => {
      const { go } = this;
      const state = /** @type {State & {name: typeof name}} */ ({ name, params, stack });
      go(state);
    };

    /**
     * Go back using `shouldGoBack` and `onGoBack` hooks.
     * @type {() => void}
     */
    this.goBack = () => {
      const { go } = this;
      go(null);
    };

    /**
     * Find state parents to use in `replace`.
     * @type {(state: State, parents?: State[]) => State[]}
     */
    this.findParents = (state, parents = [this.state]) => {
      const parent = parents[parents.length - 1];
      if (parent) {
        if (parent === state) {
          return parents.slice(0, -1);
        }
        for (const parentState of parent.stack || []) {
          const nextParents = this.findParents(state, [...parents, parentState]);
          if (nextParents.length > 0) {
            return nextParents;
          }
        }
      }
      return [];
    };

    /**
     * Finds `searchState` and replaces it by `replaceState`. Return `true` if state was replaced,
     * `false` otherwise. It compares states using strict equality (===).
     * @type {(searchState: State, replaceState: State) => boolean}
     */
    this.replace = (searchState, replaceState) => {
      const { state, setState, findParents } = this;
      if (searchState === state) {
        setState(replaceState);
        return true;
      }
      const parents = findParents(searchState);
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
     * @type {(listener: Listener) => () => void}
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
     * @type {() => navigators}
     */
    this.getNavigators = () => {
      const { navigators } = this;
      return navigators;
    };

    /**
     * Set navigators map.
     * @type {(navigators: Navigators) => void}
     */
    this.setNavigators = (navigators) => {
      this.navigators = navigators;
    };

    /**
     * Get builders map.
     * @type {() => Builders}
     */
    this.getBuilders = () => {
      const { builders } = this;
      return builders;
    };

    /**
     * Set builders map.
     * @type {(builders: Builders) => void}
     */
    this.setBuilders = (builders) => {
      this.builders = builders;
    };

    /**
     * Updates browser/memory history and url from state.
     * @protected
     * @web
     * @type {(state: State) => void}
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
     * @type {(history: import('history').History, getNotFoundStateFromUrl: (url: string)=> State)
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
