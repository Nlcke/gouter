import { tokensToFunction, tokensToRegexp } from 'path-to-regexp';

/**
 * `PathSegment` is used to define required parameter inside parameters definition at route map.
 * It will convert segment of url path into named parameter as string and vice versa.
 * @typedef {[
 * prefix?: string,
 * regexp?: RegExp | null,
 * suffix?: string,
 * modifier?: '' | '?' | '+' | '*'
 * ]} PathSegment
 */

/**
 * `Serializable` is used to define optional query parameter inside parameters definition at
 * route map. It will convert part of url query into named parameter using `decode` and vice versa
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
 * Creates `Gouter` instance with available routes. It's methods are used to modify navigation
 * state and then notify listeners about it.
 * @template {Record<string, ParamsDef>} T
 * @param {T} routes map of routes
 */
class Gouter {
  /** @param {T} routes map of routes  */
  constructor(routes) {
    /** @typedef {keyof T & string} Name */

    /**
     * `StateMap` is used to get route state from route name.
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
     * `TransitionHooks` is set of functions called when you attempt to change current state:
     * * `onInit` is called when you use `newState`.
     * * `shouldGoTo` and `onGoTo` are called on `goTo`.
     * * `shouldGoBack` and `onGoBack` are called on `goBack`.
     * @template {Name} N
     * @typedef {{
     * onInit: (state: StateMap[N] & State) => StateMap[N] & State
     * shouldGoTo: (state: State, parent: StateMap[N] & State, ...parents: State[]) => boolean
     * onGoTo: (state: State, parent: StateMap[N] & State, ...parents: State[]) => State
     * shouldGoBack: (state: State, parent: StateMap[N] & State, ...parents: State[]) => boolean
     * onGoBack: (state: State, parent: StateMap[N] & State, ...parents: State[]) => State
     * }} TransitionHooks
     */

    /**
     * `Listener` function is called with current state when it changes.
     * @callback Listener
     * @param {State} state
     * @returns {void}
     */

    /**
     * `HookMap` is used to define `TransitionHooks` for each route where you need it.
     * @typedef {Partial<{[K in Name]: Partial<TransitionHooks<K>>}>} HookMap
     */

    /**
     * `routeMap` stores routes passed to Gouter. They are used to decode and encode states and
     * urls, and help with type suggestions for route parameters.
     * @type {T}
     */
    this.routeMap = routes;

    /**
     * `initialState` is initial state passed to current `state` and `notFoundState` at
     * Gouter instantiation.
     * @type {State}
     */
    const initialState = {
      name: '',
      params: /** @type {any} */ ({}),
      url: '',
      key: '',
      stack: [],
    };

    /**
     * `state` stores current router state.
     * @type {State}
     */
    this.state = initialState;

    /**
     * `notFoundState` stores router state used when `decodeUrl` fails to find appropriate route.
     * @type {State}
     */
    this.notFoundState = initialState;

    /**
     * `hookMap` stores current TransitionHooks customized for each route where you need it.
     * You may set it using `setHooks` and get it using `getHooks`.
     * @type {HookMap}
     */
    this.hookMap = {};

    /**
     * `defaultHooks` stores current default hooks used when customized route hook not found in
     * `hookMap`. You may set them directly.
     * @type {Partial<TransitionHooks<Name>>}
     */
    this.defaultHooks = {};

    /**
     * `history` stores `history` instance used for web navigation.
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
     * @type {Object<string, RegExp['exec']>}
     */
    this.regexpFunctionCache = {};

    /**
     * `pathFunctionCache` stores PathFunction cache used to encode states into urls' paths at
     * `encodePath`.
     * @type {Object<string, import('path-to-regexp').PathFunction<object>>}
     */
    this.pathFunctionCache = {};

    /**
     * `pathCacheByName` stores path cache for each route name to speed up `encodePath`.
     * @type {Record<string, WeakMap<object, string>>}
     */
    this.pathCacheByName = {};

    /**
     * `listeners` stores list of listeners called when current state changes.
     * @type {Listener[]}
     */
    this.listeners = [];

    /**
     * Generates path-to-regexp tokens from parameters definition.
     * Generated tokens are used for `getRegexpFunction` and `encodePath`.
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
     * Get regexp function from route name. It is used for `decodePath`.
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
     * Creates url path string from state name and params.
     * @type {<N extends Name>(name: N, params: StateMap[N]['params']) => string}
     */
    this.encodePath = (name, params) => {
      const {
        routeMap,
        pathFunctionCache,
        pathToRegexpOptions,
        getTokensFromParamsDef,
        pathCacheByName,
      } = this;
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
     * @type {(name: Name, params: StateMap[Name]['params']) => string}
     */
    this.encodeQuery = (name, params) => {
      const { routeMap } = this;
      let queryStr = '';
      const paramsDef = routeMap[name];
      for (const key in params) {
        const segment = paramsDef[key];
        const encode = typeof segment === 'object' && !Array.isArray(segment) && segment.encode;
        if (encode) {
          const value = params[key];
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
     * @type {(name: Name, params: StateMap[Name]['params']) => string}
     */
    this.encodeUrl = (name, params) => {
      const { encodePath, encodeQuery } = this;
      const pathStr = encodePath(name, params);
      const queryStr = encodeQuery(name, params);
      const url = pathStr + queryStr;
      return url;
    };

    /**
     * Create new `State` from route name, params and optional stack. If `onInit` hook set for
     * route name then it's called to modify this state.
     * @type {<N extends Name>(name: N, params: StateMap[N]['params'], stack?: State[])
     * => State & {name: N}}
     */
    this.newState = (name, params, stack) => {
      const { hookMap, defaultHooks } = this;
      const state = /** @type {State & {name: typeof name}} */ ({
        name,
        params,
        stack,
      });
      const { onInit } = hookMap[name] || defaultHooks;
      if (onInit) {
        const stateAfterInit = /** @type {State & {name: typeof name}} */ (
          onInit(/** @type {any} */ (state))
        );
        return stateAfterInit;
      }
      return state;
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
     * @type {(url: string) => State}
     */
    this.decodeUrl = (url) => {
      const { decodePath, routeMap, newState, decodeQuery, notFoundState } = this;
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
          const state = newState(name, params);
          return state;
        }
      }
      const state = { ...notFoundState, url, key: pathname };
      return state;
    };

    /**
     * Recursively creates flat list of every child state inside current state.
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
      const { listeners } = this;
      this.state = state;
      for (const listener of listeners) {
        listener(state);
      }
    };

    /**
     * Get list of focused states from top to root.
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
      const { state: currentState, hookMap, setState, defaultHooks, getFocusedStates } = this;
      let nextState = currentState;
      for (const state of statesOrNulls) {
        const focusedStates = getFocusedStates(nextState);
        for (let index = 0; index < focusedStates.length; index += 1) {
          const focusedState = focusedStates[index];
          const { shouldGoTo, onGoTo, shouldGoBack, onGoBack } =
            hookMap[focusedState.name] || defaultHooks;
          const shouldGo = state ? shouldGoTo : shouldGoBack;
          const onGo = state ? onGoTo : onGoBack;
          if (shouldGo && onGo) {
            const parents = /** @type {[StateMap[Name] & State, ...State[]]} */ (
              focusedStates.slice(index)
            );
            const [firstParent] = parents;
            const passedState =
              state ||
              (firstParent &&
                firstParent.stack &&
                firstParent.stack[firstParent.stack.length - 1]) ||
              currentState;
            const should = shouldGo(passedState, ...parents);
            if (should) {
              const subState = onGo(passedState, ...parents);
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
      }
      setState(nextState);
    };

    /**
     * Go to state using `shouldGoTo` and `onGoTo` hooks.
     * @type {<N extends Name>(name: N, params: StateMap[N]['params'], stack?: State[]) => void}
     */
    this.goTo = (name, params, stack) => {
      const { newState, go } = this;
      const state = newState(name, params, stack);
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
     * Get state parents to use for `replace`.
     * @type {(state: State, parents?: State[]) => State[]}
     */
    this.getStateParents = (state, parents = [this.state]) => {
      const parent = parents[parents.length - 1];
      if (parent) {
        if (parent === state) {
          return parents.slice(0, -1);
        }
        for (const parentState of parent.stack || []) {
          const nextParents = this.getStateParents(state, [...parents, parentState]);
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
      const { state, setState, getStateParents } = this;
      if (searchState === state) {
        setState(replaceState);
        return true;
      }
      const parents = getStateParents(searchState);
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
     * Get transition hooks.
     * @type {() => HookMap}
     */
    this.getHooks = () => {
      const { hookMap } = this;
      return hookMap;
    };

    /**
     * Set transition hooks.
     * @type {(hooks: HookMap) => void}
     */
    this.setHooks = (hooks) => {
      this.hookMap = hooks;
    };

    /**
     * Updates browser/memory history and url from state.
     * @web
     * @type {(state: State) => void}
     */
    this.updateHistory = (state) => {
      const { notFoundState, history } = this;
      if (history && state.name !== notFoundState.name) {
        const stateUrl = this.encodeUrl(state.name, state.params);
        const { location } = history;
        const browserUrl = `${location.pathname}${location.search}`;
        if (browserUrl !== stateUrl) {
          history.push(stateUrl);
        }
      }
    };

    /**
     * Goes to new router state from history location:
     * * history location is transformed into url
     * * url is transformed into new router state or not-found state
     * * router goes to router state if it is different from previous one
     * @web
     * @type {import('history').Listener}
     */
    this.goToLocation = ({ location }) => {
      const { decodeUrl, go } = this;
      const url = location.pathname + location.search;
      const toState = decodeUrl(url);
      go(toState);
    };

    /**
     * Enables `history` package for web browser support.
     * @web
     * @type {(history: import('history').History) => void}
     */
    this.enableHistory = (history) => {
      const { listen, updateHistory, goToLocation } = this;
      this.history = history;
      listen(updateHistory);
      history.listen(goToLocation);
      const action = /** @type {import('history').Action} */ ('PUSH');
      goToLocation({ location: history.location, action });
    };
  }
}

export default Gouter;
