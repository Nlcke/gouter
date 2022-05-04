const { tokensToFunction, tokensToRegexp } = require('path-to-regexp');

/**
 * @typedef {[
 * prefix?: string,
 * regexp?: RegExp | null,
 * suffix?: string,
 * modifier?: '' | '?' | '+' | '*'
 * ]} PathSegment
 */

/**
 * @template T
 * @typedef {{
 * decode: (str: string) => T
 * encode: (val: T) => string
 * }} Serializable
 */

/** @typedef {Record<string, PathSegment | string | Serializable<any>>} Route */

/**
 * `Listener` function receives state and is called after router transition
 * @template T
 * @callback Listener
 * @param {T} state
 * @returns {void}
 */

/**
 * Creates `Gouter` instance.
 * It allows transitioning between states using `goTo` and `goBack` methods.
 * It allows to add and remove listeners via `listen` and `unlisten` methods.
 * @template {Record<string, Route>} T
 * @param {T} routes map of routes
 */
const Gouter = (routes) => {
  /**
   * `Name`
   * @typedef {keyof T & string} Name
   */

  /**
   * `StateMap`
   * @typedef {{[N in Name]: {
   * name: N
   * params: {[K in keyof T[N] as
   * T[N][K] extends PathSegment ?
   * T[N][K][3] extends '' ? K : T[N][K][3] extends '+' ?
   * K : T[N][K]['length'] extends 0 | 1 | 2 | 3 ? K : never : never]: T[N][K] extends PathSegment ? T[N][K][3] extends '+' ? string[] : string : string}
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
   * `State`
   * @typedef {StateMap[keyof StateMap] & {url: string, key: string, stack: State[]}} State
   */

  /**
   * `TransitionHooks` is set of functions called while transition between router states
   * @template {Name} N
   * @typedef {{
   * onStackInit: (state: StateMap[N] & State) => State[]
   * shouldGoTo: (parents: State[], state: StateMap[N] & State) => boolean
   * shouldGoBack: (parents: State[]) => boolean
   * onGoTo: (parents: State[], state: StateMap[N] & State) => State
   * onGoBack: (parents: State[]) => State
   * beforeExit: (state: StateMap[N] & State, fromParents: State[], toParents: State[]) => Promise<void | function>
   * beforeEnter: (state: StateMap[N] & State, fromParents: State[], toParents: State[]) => Promise<void | function>
   * onExit: (state: StateMap[N] & State, fromParents: State[], toParents: State[]) => void
   * onEnter: (state: StateMap[N] & State, fromParents: State[], toParents: State[]) => void
   * }} TransitionHooks
   */

  const gouter = {
    routeMap: routes,

    /** @type {Partial<{[K in keyof T]: Partial<TransitionHooks<K>>}>} */
    hookMap: {},

    /** @type {import('history').History | null}  */
    history: null,

    /** @type {State} */
    // @ts-ignore
    state: {
      name: '',
      params: {},
      url: '',
      key: '',
      stack: [],
    },

    /** @type {State} */
    // @ts-ignore
    notFoundState: {
      name: '',
      params: {},
      url: '',
      key: '',
      stack: [],
    },

    /** @type {State | null} */
    tempState: null,

    emptyStack: [],

    /** @type {(reason: any) => void} */
    hookCatch: () => {},

    /** @type {boolean} is router state attempts to change? */
    isTransitioning: false,

    /**
     * PathFunction options.
     * @type {import('path-to-regexp').ParseOptions & import('path-to-regexp').TokensToRegexpOptions}
     */
    pathToRegexpOptions: {},

    /**
     * Generate path-to-regexp tokens from route.
     * Generated tokens should be used for `tokensToRegexp` and `tokensToFunction`.
     * @param {Route} route
     * @param {import('path-to-regexp').ParseOptions} options
     * @returns {(string | import('path-to-regexp').Key)[]} path-to-regexp tokens
     */
    getTokensFromRoute: (route, options) => {
      /** @type {(string | import('path-to-regexp').Key)[]} */
      const tokens = [];
      const escapeRegexp = /([.+*?=^!:${}()[\]|/\\])/g;
      const defaultPattern = `[^${(options.delimiter || '/#?').replace(
        escapeRegexp,
        '\\$1',
      )}]+?`;
      for (const name in route) {
        const segment = route[name];
        if (Array.isArray(segment)) {
          const [prefix = '', regexp = null, suffix = '', modifier = ''] =
            segment;
          const pattern = regexp
            ? regexp.toString().slice(1, -1)
            : defaultPattern;
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
    },

    /**
     * Regexp function cache.
     * @type {Object<string, RegExp['exec']>}
     */
    regexpFunctionCache: {},

    /**
     * Get pattern info
     * @param {Name} name
     * @returns {RegExp['exec']} regexp function
     */
    getRegexpFunction: (name) => {
      const {
        regexpFunctionCache,
        routeMap,
        pathToRegexpOptions,
        getTokensFromRoute,
      } = gouter;
      const regexpFunction = regexpFunctionCache[name];
      if (regexpFunction) {
        return regexpFunction;
      } else {
        const route = routeMap[name];
        const tokens = getTokensFromRoute(route, pathToRegexpOptions);
        const regexp = tokensToRegexp(tokens, undefined, pathToRegexpOptions);
        const newRegexpFunction = regexp.exec.bind(regexp);
        regexpFunctionCache[name] = newRegexpFunction;
        return newRegexpFunction;
      }
    },

    /**
     * Matches path to params.
     * @template {Name} N
     * @param {string} path
     * @param {Name} name
     * @returns {StateMap[N]['params'] | null} params
     */
    decodePath: (path, name) => {
      const { getRegexpFunction, routeMap } = gouter;
      const regexpFunction = getRegexpFunction(name);
      const match = regexpFunction(path);
      if (match) {
        /** @type {StateMap[N]['params']} */
        // @ts-ignore
        const params = {};
        const route = routeMap[name];
        let index = 1;
        for (const key in route) {
          const segment = route[key];
          if (Array.isArray(segment)) {
            // @ts-ignore
            params[key] = match[index++];
          }
        }
        return params;
      } else {
        return null;
      }
    },

    /**
     * PathFunction cache.
     * @type {Object<string, import('path-to-regexp').PathFunction<object>>}
     */
    pathFunctionCache: {},

    /**
     * Creates a pathFunction from a pattern.
     * @param {Name} name
     * @returns {import('path-to-regexp').PathFunction<object>} pathFunction
     */
    getPathFunction: (name) => {
      const {
        routeMap,
        pathFunctionCache,
        pathToRegexpOptions,
        getTokensFromRoute,
      } = gouter;
      const pathFunction = pathFunctionCache[name];
      if (pathFunction) {
        return pathFunction;
      } else {
        const route = routeMap[name];
        const tokens = getTokensFromRoute(route, pathToRegexpOptions);
        const newPathFunction = tokensToFunction(tokens, pathToRegexpOptions);
        pathFunctionCache[name] = newPathFunction;
        return newPathFunction;
      }
    },

    /**
     * Generates query string from state name and params.
     * @param {Name} name
     * @param {StateMap[Name]['params']} params
     * @returns {string} query string
     */
    encodeQuery: (name, params) => {
      const { routeMap } = gouter;
      let queryStr = '';
      const route = routeMap[name];
      for (const key in params) {
        const value = params[key];
        const keyEncoded = encodeURIComponent(key);
        const segment = route[key];
        const encode =
          typeof segment === 'object' &&
          !Array.isArray(segment) &&
          segment.encode;
        if (encode) {
          const valueEncoded = encodeURIComponent(encode(value));
          queryStr += `&${keyEncoded}=${valueEncoded}`;
        }
      }
      if (queryStr) {
        queryStr = '?' + queryStr.slice(1);
      }
      return queryStr;
    },

    /**
     * Generates URL from state name and params.
     * @param {Name} name
     * @param {StateMap[Name]['params']} params
     * @returns {string} `URL`
     */
    generateUrl: (name, params) => {
      const { getPathFunction, encodeQuery } = gouter;
      const pathFunction = getPathFunction(name);
      const path = pathFunction(params);
      const queryStr = encodeQuery(name, params);
      const url = path + queryStr;
      return url;
    },

    /**
     * Creates new `Gouter.State` from partial state
     * @template {Name} N
     * @param {N} name
     * @param {StateMap[N]['params']} params
     * @param {State[]} [stack]
     * @returns {State & {name: N}}
     */
    newState: (name, params, stack) => {
      const { emptyStack, generateUrl, hookMap, defaultHooks } = gouter;
      /** @type {StateMap[Name]['params']} */
      // @ts-ignore
      const fullParams = params;
      const fullStack = stack || emptyStack;
      const url = generateUrl(name, fullParams);
      const [key] = url.split('?');
      /** @type {State & {name: N}} */
      const state = {
        name,
        params: fullParams,
        stack: fullStack,
        url,
        key,
      };
      if (!stack) {
        const { onStackInit } = hookMap[name] || defaultHooks;
        if (onStackInit) {
          state.stack = onStackInit(state);
        }
      }
      return state;
    },

    /**
     * Generates query object from query string and route name.
     * @param {string} queryStr
     * @param {Name} name
     * @returns {State['params']} query object
     */
    decodeQuery: (queryStr, name) => {
      const { routeMap } = gouter;
      /** @type {State['params']} */
      // @ts-ignore
      const params = {};
      const route = routeMap[name];
      for (const keyValueStr of queryStr.split('&')) {
        const splitIndex = keyValueStr.indexOf('=');
        const key = decodeURIComponent(keyValueStr.slice(0, splitIndex));
        const rawValue = decodeURIComponent(keyValueStr.slice(splitIndex + 1));
        const routeValue = route[key];
        const decode =
          typeof routeValue === 'object' &&
          !Array.isArray(routeValue) &&
          routeValue.decode;
        if (decode) {
          const value = decode(rawValue);
          // @ts-ignore
          params[key] = value;
        }
      }
      return params;
    },

    /**
     * Generates router state from url
     * @param {string} url
     * @returns {State | null} state or null
     */
    newStateFromUrl: (url) => {
      const { decodePath, routeMap, newState, decodeQuery } = gouter;
      const [urlWithoutHash] = url.split('#');
      const [pathname, search = ''] = urlWithoutHash.split('?');
      for (const name in routeMap) {
        const params = decodePath(pathname, name);
        if (params) {
          if (search) {
            const query = decodeQuery(search, name);
            for (const key in query) {
              params[key] = query[key];
            }
          }
          const state = newState(name, params);
          return state;
        }
      }
      return null;
    },

    /**
     * Creates flat array of every state inside current state at any depth
     * @param {State} state
     * @returns {State[]}
     */
    stateToStack: (state) => {
      const { stateToStack } = gouter;
      const stateList = [state];
      const { stack } = state;
      for (const subState of stack) {
        stateList[stateList.length] = subState;
        if (subState.stack.length > 0) {
          const subStateStack = stateToStack(subState);
          for (const subStateStackState of subStateStack) {
            stateList[stateList.length] = subStateStackState;
          }
        }
      }
      return stateList;
    },

    /**
     * Cancels current hooks
     */
    cancelHooks: () => {},

    /**
     * Attempts to change current stack
     * * If gouter.cancelHooks() called then transition aborted
     * * Each route with beforeExit/beforeEnter hooks can return a callback
     * * If a callback returned then and no cancelHooks called then they are executed
     * * Executed only after all beforeEnter and beforeExit promises are resolved.
     *
     * @param {State} toState
     * @returns {State}
     */
    setState: (toState) => {
      const {
        cancelHooks,
        tempState,
        state: fromState,
        defaultHooks,
        hookMap,
      } = gouter;
      if (tempState) {
        gouter.tempState = toState;
        return toState;
      }
      gouter.isTransitioning = false;
      cancelHooks();

      // const fromStack = stateToStack(fromState);
      // const toStack = stateToStack(toState);

      const promises = [];

      /** @type {(fromState: State, toState: State) => void} */
      const compareStates = (fromState, toState) => {
        if (fromState !== toState) {
          //           if (fromState.key !== toState.key) {
          //   promises[promises.length] = {}
          // }
          const fromStack = fromState.stack;
          const toStack = toState.stack;
          for (const subState of fromStack) {
            const { key } = subState;
            let subStateRemoved = true;
            for (const subStateX of toStack) {
              if (subStateX.key === key) {
                subStateRemoved = false;
                break;
              }
            }
            if (subStateRemoved) {
              // run beforeExit for all inner states
              // call beforeExit for it then call onExit for it
              const { beforeExit } = hookMap[subState.name] || defaultHooks;
              if (beforeExit) {
                beforeExit(subState, [], []);
              }
            } else {
              // call something
            }
          }
          for (const subState of toStack) {
            const { key } = subState;
            let subStateAdded = true;
            for (const subStateX of fromStack) {
              if (subStateX.key === key) {
                subStateAdded = false;
                break;
              }
            }
            if (subStateAdded) {
              // run beforeEnter for all inner states
              // call beforeEnter for it then call onEnter for it
              const { beforeEnter } = hookMap[subState.name] || defaultHooks;
              if (beforeEnter) {
                beforeEnter(subState, [], []);
              }
            } else {
              // call something
            }
          }
        }
      };

      const areStatesEqual =
        fromStack.length === toStack.length &&
        fromStack.every(({ url }, index) => url === toStack[index].url);

      // console.log(JSON.stringify(fromStack, null, 4));
      // console.log(JSON.stringify(toStack, null, 4));
      console.warn('check areStatesEqual condition!', areStatesEqual);

      if (!areStatesEqual) {
        gouter.isTransitioning = true;

        const fromRoutesHooks = fromStack
          .filter(({ key: fromStateKey }) =>
            toStack.every(({ key: toStateKey }) => toStateKey !== fromStateKey),
          )
          .map(({ name }) => hookMap[name]);

        const toRoutesHooks = toStack
          .filter(({ key: toStateKey }) =>
            fromStack.every(
              ({ key: fromStateKey }) => fromStateKey !== toStateKey,
            ),
          )
          .map(({ name }) => hookMap[name]);

        let canceled = false;
        gouter.cancelHooks = () => {
          canceled = true;
        };

        /** @type {(callbacks: (void | Function)[]) => void} */
        const onFinish = (callbacks) => {
          if (!canceled) {
            for (const callback of callbacks) {
              if (typeof callback === 'function') {
                callback();
              }
            }
            console.warn('onFinish');
            gouter.isTransitioning = false;
            gouter.state = toState;
            for (const listener of gouter.listeners) {
              listener(toState);
            }
            for (const fromRoutesHook of fromRoutesHooks) {
              if (fromRoutesHook && fromRoutesHook.onExit) {
                fromRoutesHook.onExit(fromState, toState);
              }
            }
            for (const toRoutesHook of toRoutesHooks) {
              if (toRoutesHook && toRoutesHook.onEnter) {
                toRoutesHook.onEnter(fromState, toState);
              }
            }
          }
        };

        const promises = [];

        for (const fromRoutesHook of fromRoutesHooks) {
          if (fromRoutesHook && fromRoutesHook.beforeExit) {
            promises[promises.length] = fromRoutesHook.beforeExit(
              fromState,
              toState,
            );
          }
        }
        for (const toRoutesHook of toRoutesHooks) {
          if (toRoutesHook && toRoutesHook.beforeEnter) {
            promises[promises.length] = toRoutesHook.beforeEnter(
              fromState,
              toState,
            );
          }
        }

        Promise.all(promises).then(onFinish, (reason) => {
          gouter.isTransitioning = false;
          gouter.hookCatch(reason);
        });

        return toState;
      } else {
        return fromState;
      }
    },

    /**
     * Get focused states as list from top to root
     * @param {State} state
     * @returns {State[]}
     */
    getFocusedStates: (state) => {
      const focusedStates = [state];
      let lastState = state;
      while (true) {
        const { stack } = lastState;
        lastState = stack[stack.length - 1];
        if (lastState && focusedStates.indexOf(lastState) === -1) {
          focusedStates[focusedStates.length] = lastState;
        } else {
          return focusedStates.reverse();
        }
      }
    },

    /** @type {Partial<TransitionHooks>} */
    defaultHooks: {},

    /**
     * Go to state
     * @param {...(State | null)} statesOrNulls
     */
    goOn: (...statesOrNulls) => {
      const {
        history,
        state: currentState,
        hookMap,
        setState,
        defaultHooks,
        getFocusedStates,
      } = gouter;
      let nextState = currentState;
      for (const state of statesOrNulls) {
        if (history) {
          if (state) {
            history.push(state.url);
          } else {
            history.back();
          }
        } else {
          const focusedStates = getFocusedStates(nextState);
          for (let index = 0; index < focusedStates.length; index++) {
            const focusedState = focusedStates[index];
            const { onGoTo, shouldGoTo, onGoBack, shouldGoBack } =
              hookMap[focusedState.name] || defaultHooks;
            const hasHook = state ? shouldGoTo : shouldGoBack;
            if (hasHook) {
              const parents = focusedStates.slice(index);
              const should = state
                ? shouldGoTo && shouldGoTo(parents, state)
                : shouldGoBack && shouldGoBack(parents);
              if (should) {
                const subState = state
                  ? onGoTo && onGoTo(parents, state)
                  : onGoBack && onGoBack(parents);
                if (subState) {
                  let childState = subState;
                  for (const parent of parents.slice(1)) {
                    childState = {
                      ...parent,
                      stack: [...parent.stack.slice(0, -1), childState],
                    };
                  }
                  nextState = childState;
                  break;
                }
              }
            }
          }
        }
      }
      setState(nextState);
    },

    /**
     * Go to partial state
     * @template {Name} N
     * @param {N} name
     * @param {StateMap[N]['params']} params
     * @param {State[]} [stack]
     * @returns {void}
     */
    goTo: (name, params, stack) => {
      const { newState, goOn } = gouter;
      const state = newState(name, params, stack);
      goOn(state);
    },

    /**
     * Go back to previous state
     * @returns {void}
     */
    goBack: () => {
      const { goOn } = gouter;
      goOn(null);
    },

    /**
     * List of listeners
     * @type {Listener<State>[]}
     */
    listeners: [],

    /**
     * Add new listener of router state changes to listeners
     * @param {Listener<State>} listener
     */
    listen: (listener) => {
      const { listeners } = gouter;
      gouter.listeners = [...listeners, listener];
    },

    /**
     * Remove old listener of router state changes from listeners
     * @param {Listener<State>} listener
     */
    unlisten: (listener) => {
      const { listeners } = gouter;
      gouter.listeners = listeners.filter(
        (prevListener) => prevListener !== listener,
      );
    },

    /**
     * Updates browser/memory history and url from state
     * @param {State} state
     * @returns {void}
     */
    updateHistory: (state) => {
      const { notFoundState, history } = gouter;
      if (history && state.name !== notFoundState.name) {
        const stateUrl = state.url;
        const { location } = history;
        const browserUrl = `${location.pathname}${location.search}`;
        if (browserUrl !== stateUrl) {
          history.push(stateUrl);
        }
      }
    },

    /**
     * Go to new router state from history location:
     * * history location is transformed into url
     * * url is transformed into new router state or not-found state
     * * router goes to router state if it is different from previous one
     * @type {import('history').Listener}
     */
    goToLocation: ({ location, action }) => {
      const {
        state: fromState,
        newStateFromUrl,
        notFoundState,
        setState,
      } = gouter;
      const url = location.pathname + location.search;
      const toState = newStateFromUrl(url) || notFoundState;
      if (toState && (!fromState || fromState.url !== toState.url)) {
        setState(toState);
      }
    },

    /**
     * Set initial state to start from
     * @param {State} state
     */
    withInitialState: (state) => {
      gouter.state = state;
      return gouter;
    },

    /**
     * Set NotFound state to fallback when route name does not exist
     * @param {State} state
     */
    withNotFoundState: (state) => {
      gouter.notFoundState = state;
      return gouter;
    },

    /**
     * Set history and enable listeners for history and router events
     * @param {import('history').History} history
     */
    withHistory: (history) => {
      const { listen, updateHistory, goToLocation } = gouter;
      gouter.history = history;
      listen(updateHistory);
      history.listen(goToLocation);
      /** @type {import('history').Action} */
      // @ts-ignore
      const action = 'PUSH';
      goToLocation({ location: history.location, action });
      return gouter;
    },

    // /**
    //  * Set struct
    //  * @param {ExtPartialState} struct
    //  */
    // withStruct: (struct) => {
    //   /** @type {Partial<Record<keyof T, ExtPartialState[][]>>} */
    //   const pathMap = {};
    //   /** @type {(subStruct: ExtPartialState, path: ExtPartialState[]) => void} */
    //   const fillPaths = (subStruct, path) => {
    //     /** @type {ExtPartialState[]} */
    //     const nextPath = [...path, subStruct];
    //     /** @type {ExtPartialState[][]} */
    //     const pathList = pathMap[subStruct.name] || [];
    //     pathList[pathList.length] = nextPath;
    //     pathMap[subStruct.name] = pathList;
    //     if (subStruct.stack) {
    //       for (const subSubStruct of subStruct.stack) {
    //         fillPaths(subSubStruct, nextPath);
    //       }
    //     }
    //   };
    //   fillPaths(struct, []);
    //   gouter.pathMap = pathMap;
    //   return gouter;
    // },

    /**
     * Set hooks
     * @param {Partial<{[K in keyof T]: Partial<TransitionHooks<K>>}>} hooks
     */
    withHooks: (hooks) => {
      gouter.hookMap = hooks;
      return gouter;
    },
  };

  return gouter;
};

module.exports = Gouter;
