const { compile, pathToRegexp } = require('path-to-regexp');

/** @typedef {string} Bar e.g. 'bottom-bar' */

/** @typedef {string} Name e.g. 'user' */

/** @typedef {string} Key e.g. 'home' */

/** @typedef {Record<string, string>} Params e.g. {id: '17'} */

/** @typedef {Record<string, any>} Query e.g. {color: 'red', category: 1}  */

/** @typedef {string} URL e.g. 'post/123' */

/**
 * @template T
 * @typedef {{
 * decode: (str: string) => T
 * encode: (val: T) => string
 * }} Serializable
 */

/** @typedef {Record<string, Serializable<any>>} SerializableQuery */

/**
 * `Listener` function receives state and is called after router transition
 * @template T
 * @callback Listener
 * @param {T} state
 * @returns {void}
 */

/** @typedef {string} Pattern e.g. 'user/:id' */

/** @typedef {{[K: string] : never}} EmptyObject */

/**
 * `Route` consists of all optional uri matching pattern, params object and query object
 * @typedef Route
 * @property {Pattern} [pattern]
 * @property {Params} [params]
 * @property {SerializableQuery} [query]
 */

/** @typedef {{regExp: RegExp, keys: import('path-to-regexp').Key[]}} PatternInfo */

/**
 * Creates `Gouter` instance.
 * It allows transitioning between states using `goTo` and `goBack` methods.
 * It allows to add and remove listeners via `listen` and `unlisten` methods.
 * @template {Record<keyof T, Route>} T
 * @param {T} routes map of routes
 */
const Gouter = (routes) => {
  /**
   * `StateMap`
   * @typedef {{[N in keyof T]: {
   * name: N
   * params: T[N]['params'] extends Params ? T[N]['params'] : EmptyObject
   * query: T[N]['query'] extends SerializableQuery ? Partial<{[K in keyof T[N]['query']]: ReturnType<T[N]['query'][K]['decode']>}> : EmptyObject
   * }}} StateMap
   */

  /**
   * `State`
   * @typedef {StateMap[keyof StateMap] & {url: string, key: string, stack: State[]}} State
   */

  /**
   * `PartialStateMap`
   * @typedef {{[N in keyof T]: T[N]['params'] extends Params ? {
   * name: N
   * params: NonNullable<T[N]['params']>
   * query?: StateMap[N]['query'] | ((query: StateMap[N]['query']) => StateMap[N]['query'])
   * stack?: State[] | ((stack: State[]) => State[])
   * } : {
   * name: N
   * params?: EmptyObject
   * query?: StateMap[N]['query'] | ((query: StateMap[N]['query']) => StateMap[N]['query'])
   * stack?: State[] | ((stack: State[]) => State[])
   * }}[keyof T]} PartialState
   */

  /**
   * `TransitionHooks` is set of functions called while transition between router states
   * @typedef {{
   * onStackInit: (state: State) => State[]
   * shouldGoTo: (parents: State[], state: State) => boolean
   * shouldGoBack: (parents: State[]) => boolean
   * onGoTo: (parents: State[], state: State) => State
   * onGoBack: (parents: State[]) => State
   * beforeExit: (thisState: State, fromState: State, toState: State) => Promise<void | function>
   * beforeEnter: (thisState: State, fromState: State, toState: State) => Promise<void | function>
   * onExit: (thisState: State, fromState: State, toState: State) => void
   * onEnter: (thisState: State, fromState: State, toState: State) => void
   * }} TransitionHooks
   */

  /** @type {keyof T} */
  // @ts-ignore
  const initialName = '';

  const gouter = {
    routeMap: routes,

    /** @type {Partial<Record<keyof T, Partial<TransitionHooks>>>} */
    hookMap: {},

    /** @type {import('history').History | null}  */
    history: null,

    /** @type {State} */
    state: {
      name: initialName,
      params: {},
      query: {},
      url: '',
      key: '',
      stack: [],
    },

    /** @type {State} */
    notFoundState: {
      name: initialName,
      params: {},
      query: {},
      url: '',
      key: '',
      stack: [],
    },

    /** @type {State | null} */
    tempState: null,

    emptyStack: [],

    /** @type {EmptyObject} */
    emptyParams: {},

    emptyQuery: {},

    /** @type {(reason: any) => void} */
    hookCatch: () => {},

    /** @type {boolean} is router state attempts to change? */
    isTransitioning: false,

    /**
     * pattern info cache
     * @type {Object.<string, PatternInfo>}
     */
    patternInfoCache: {},

    /**
     * get pattern info
     * @param {Pattern} pattern
     * @returns {PatternInfo} pattern info
     */
    getPatternInfo: (pattern) => {
      const { patternInfoCache } = gouter;
      const patternInfo = patternInfoCache[pattern];
      if (patternInfo) {
        return patternInfo;
      } else {
        /** @type {import('path-to-regexp').Key[]} */
        const keys = [];
        const regExp = pathToRegexp(pattern, keys, {});
        const newPatternInfo = { regExp, keys };
        patternInfoCache[pattern] = newPatternInfo;
        return newPatternInfo;
      }
    },

    /**
     * Matches an URL to a pattern.
     * @param {URL} url
     * @param {Pattern} pattern
     * @returns {Params | null} `Params` instance
     */
    matchUrl: (url, pattern) => {
      const { getPatternInfo } = gouter;
      const { regExp, keys } = getPatternInfo(pattern);
      const match = regExp.exec(url);
      if (match) {
        const values = match.slice(1);
        /** @type {Record<string, string>} */
        const initialValue = {};
        return keys.reduce((params, key, index) => {
          params[key.name] = values[index];
          return params;
        }, initialValue);
      } else {
        return null;
      }
    },

    /**
     * Generator cache.
     * @type {Object.<string, import('path-to-regexp').PathFunction<object>>}
     */
    generatorCache: {},

    /**
     * Creates a generator from a pattern.
     * @param {Pattern} pattern
     * @returns {import('path-to-regexp').PathFunction<object>} generator
     */
    getGenerator: (pattern) => {
      const { generatorCache } = gouter;
      const generator = generatorCache[pattern];
      if (generator) {
        return generator;
      } else {
        const newGenerator = compile(pattern);
        generatorCache[pattern] = newGenerator;
        return newGenerator;
      }
    },

    /**
     * Generates a URL from a name, parameters and query parameters.
     * @param {keyof T} name
     * @param {Params} params
     * @param {Query} query
     * @returns {URL} `URL`
     */
    generateUrl: (name, params, query) => {
      const { routeMap, generatePattern, getGenerator } = gouter;
      const route = routeMap[name];
      const pattern =
        route && route.pattern !== undefined
          ? route.pattern
          : generatePattern(String(name), params);
      const generator = getGenerator(pattern);
      const path = generator(params);
      let queryStr = '';
      for (const key in query) {
        const value = query[key];
        const keyEncoded = encodeURIComponent(key);
        const encode =
          (route &&
            route.query &&
            route.query[key] &&
            route.query[key].encode) ||
          String;
        const valueEncoded = encodeURIComponent(encode(value));
        queryStr += `&${keyEncoded}=${valueEncoded}`;
      }
      if (queryStr) {
        queryStr = '?' + queryStr.slice(1);
      }
      const url = path + queryStr;
      return url;
    },

    /**
     * Generate default url pattern from route name and route params
     * @param {Name} name
     * @param {Params} params
     * @returns {Pattern}
     */
    generatePattern: (name, params) => {
      const urlParams = Object.keys(params).join('/:');
      const regex =
        /[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g;
      const kebabName = (name.match(regex) || []).join('-').toLowerCase();
      return '/' + kebabName + (urlParams ? '/:' + urlParams : '');
    },

    /**
     * Creates new `Gouter.State` from partial state
     * @type {<N extends keyof T>(partialState: T[N]['params'] extends Params ? {
     * name: N
     * params: StateMap[N]['params']
     * query?: StateMap[N]['query']
     * stack?: State[]
     * } : {
     * name: N
     * params?: StateMap[N]['params']
     * query?: StateMap[N]['query']
     * stack?: State[]
     * }) => State & {name: N}}
     */
    newState: ({ name, params, query, stack }) => {
      const {
        generateUrl,
        emptyParams,
        emptyQuery,
        emptyStack,
        hookMap,
        defaultHooks,
      } = gouter;
      /** @type {Params & T[typeof name]["params"] extends Params ? T[typeof name]['params'] : EmptyObject} */
      const fullParams = params || emptyParams;
      const fullQuery = query || emptyQuery;
      const fullStack = stack || emptyStack;
      const url = generateUrl(name, fullParams, fullQuery);
      const [key] = url.split('?');
      const state = {
        name,
        params: fullParams,
        query: fullQuery,
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
     * Converts url to router state using route map
     * @param {URL} url
     * @returns {State}
     */
    urlToState: (url) => {
      const { matchUrl, routeMap, generatePattern, newState, notFoundState } =
        gouter;
      const [urlWithoutHash] = url.split('#');
      const [pathname, search = ''] = urlWithoutHash.split('?');
      for (const name in routeMap) {
        const route = routeMap[name];
        const pattern =
          route.pattern !== undefined
            ? route.pattern
            : generatePattern(name, route.params || {});
        /** @type {StateMap[name]['params']} */
        // @ts-ignore
        const params = matchUrl(pathname, pattern) || gouter.emptyParams;
        if (params) {
          /** @type {StateMap[name]['query']} */
          const query = {};
          for (const keyValueStr of search.split('&')) {
            const splitIndex = keyValueStr.indexOf('=');
            const key = decodeURIComponent(keyValueStr.slice(0, splitIndex));
            const rawValue = decodeURIComponent(
              keyValueStr.slice(splitIndex + 1),
            );
            const decode =
              (route &&
                route.query &&
                route.query[key] &&
                route.query[key].decode) ||
              String;
            const value = decode(rawValue);
            // @ts-ignore
            query[key] = value;
          }
          const state = newState({ name, params, query });
          return state;
        }
      }
      return notFoundState;
    },

    /**
     * Checks next state for type errors
     * @param {State} state
     * @returns {string | void} error
     */
    checkState: (state) => {
      const { routeMap } = gouter;
      if (typeof state !== 'object') {
        const type = typeof state;
        return `Gouter: state is not an object but ${type}`;
      }

      const { name, params, query } = state;

      if (
        typeof name !== 'string' ||
        (params !== undefined && typeof params !== 'object') ||
        (query !== undefined && typeof query !== 'object')
      ) {
        const type = `{name: ${typeof name}, params: ${typeof params}, query: ${typeof query}}`;
        return `Gouter: state is not {name: string, params?: object, query?: object} but ${type}`;
      }

      if (!routeMap[name]) {
        return `Gouter: name '${name}' not found in routes`;
      }
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
        stateToStack,
        hookMap,
      } = gouter;
      if (tempState) {
        gouter.tempState = toState;
        return toState;
      }
      gouter.isTransitioning = false;
      cancelHooks();

      const fromStack = stateToStack(fromState);
      const toStack = stateToStack(toState);

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
     * @param {...(PartialState | null)} partialStatesOrNulls
     */
    goTo: (...partialStatesOrNulls) => {
      const {
        history,
        state: currentState,
        newState,
        hookMap,
        setState,
        defaultHooks,
        getFocusedStates,
      } = gouter;
      let nextState = currentState;
      for (const partialStateOrNull of partialStatesOrNulls) {
        /** @type {State | null} */
        const state = partialStateOrNull ? newState(partialStateOrNull) : null;
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
     * Go back to previous state
     * @returns {void}
     */
    goBack: () => {
      const { goTo } = gouter;
      goTo(null);
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
      const { state: fromState, urlToState, notFoundState, setState } = gouter;
      const url = location.pathname + location.search;
      const toState = urlToState(url) || notFoundState;
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
     * @param {Partial<Record<keyof T, Partial<TransitionHooks>>>} hooks
     */
    withHooks: (hooks) => {
      gouter.hookMap = hooks;
    },
  };

  return gouter;
};

module.exports = Gouter;
