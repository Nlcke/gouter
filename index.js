const { parse, stringify } = require('query-string');
const { compile, pathToRegexp } = require('path-to-regexp');

/** @typedef {string} Bar e.g. 'bottom-bar' */

/** @typedef {string} Name e.g. 'user' */

/** @typedef {string} Key e.g. 'home' */

/** @typedef {Readonly<Object<string, string>>} Params e.g. {id: '17'} */

/** @typedef {Readonly<Object<string, any>>} Query e.g. {color: 'red', category: 1}  */

/** @typedef {string} URL e.g. 'post/123' */

/** @typedef {string} Segment e.g. 'TabBar' */

/**
 * `HookName` is one of 4 names for hooks which control transition
 * @typedef {'beforeExit' | 'beforeEnter' | 'onExit' | 'onEnter'} HookName
 */

/**
 * `TransitionHook` is function called while transition between router states
 * @template T
 * @callback TransitionHook<T>
 * @param {T} fromStack
 * @param {T} toStack
 * @returns {Promise<void | function>}
 */

/**
 * `Listener` function receives stack and is called after router transition
 * @template T
 * @callback Listener
 * @param {T} routerStack
 * @returns {void}
 */

/** @typedef {string} Pattern */

/**
 * A `Route` consists of a name, a URL matching pattern and optional
 * enter/exit hooks. New gouter is initialized with an array
 * of routes which it uses to transition between states.
 * @typedef Route
 * @property {Pattern} [pattern] e.g. '/user/:id'
 * @property {Params} [params]
 * @property {Query} [query]
 * @property {Segment[]} [segments]
 */

/**
 * Generator cache.
 * @type {Object.<string, import('path-to-regexp').PathFunction<object>>}
 */
const generatorCache = {};

/**
 * Creates a generator from a pattern.
 * @param {Pattern} pattern
 * @returns {import('path-to-regexp').PathFunction<object>} generator
 */
const getGenerator = (pattern) => {
  const generator = generatorCache[pattern];
  if (generator) return generator;
  const newGenerator = compile(pattern);
  generatorCache[pattern] = newGenerator;
  return newGenerator;
};

/**
 * Generates a URL from a pattern, parameters and query parameters.
 * @param {Pattern} pattern
 * @param {Params} params
 * @param {Query} query
 * @returns {URL} `URL`
 */
const generateUrl = (pattern = '/', params = {}, query = {}) => {
  const generator = getGenerator(pattern);
  const urlPatternStr = generator(params);
  if (Object.keys(query).length > 0) {
    return urlPatternStr + '?' + stringify(query);
  } else {
    return urlPatternStr;
  }
};

/** @typedef {{regExp: RegExp, keys: import('path-to-regexp').Key[]}} PatternInfo */

/**
 * pattern info cache
 * @type {Object.<string, PatternInfo>}
 */
const patternInfoCache = {};

/**
 * get pattern info
 * @param {Pattern} pattern
 * @returns {PatternInfo} pattern info
 */
const getPatternInfo = (pattern) => {
  const patternInfo = patternInfoCache[pattern];
  if (patternInfo) return patternInfo;
  /** @type {import('path-to-regexp').Key[]} */
  const keys = [];
  const regExp = pathToRegexp(pattern, keys, {});
  const newPatternInfo = { regExp, keys };
  patternInfoCache[pattern] = newPatternInfo;
  return newPatternInfo;
};

/**
 * Matches an URL to a pattern.
 * @param {URL} url
 * @param {Pattern} pattern
 * @returns {Params} `Params` instance
 */
const matchUrl = (url, pattern) => {
  const { regExp, keys } = getPatternInfo(pattern);
  const match = regExp.exec(url);
  if (match) {
    const values = match.slice(1);
    return Object.freeze(
      keys.reduce((params, key, index) => {
        params[key.name] = values[index];
        return params;
      }, {}),
    );
  }
};

/**
 * Generate default url pattern from route name and route params
 * @param {Name} name
 * @param {Params} params
 * @returns {Pattern}
 */
const generatePattern = (name, params) => {
  const paramNames = Object.getOwnPropertyNames(params);
  const urlParams = paramNames.map((paramName) => ':' + paramName).join('/');
  return '/' + name + (urlParams ? '/' + urlParams : '');
};

/**
 * Creates `Gouter` instance.
 * It allows transitioning between states using the `goTo` method.
 * It allows to add and remove listeners via `listen` and `unlisten` methods.
 * It automatically listens to history changes.
 * @template {Record<keyof T, Route>} T
 * @param {T} routeMap map of routes
 */
const Gouter = (routeMap) => {
  /** @type {(keyof T)[]} */
  // @ts-ignore
  const routeNames = Object.getOwnPropertyNames(routeMap);

  /**
   * @typedef {{[K in keyof T]: {
   * name: K
   * params: T[K]['params']
   * query: Partial<T[K]['query']>
   * url: string
   * key: string
   * }}} StateMap
   */

  /**
   * @typedef {StateMap[keyof StateMap]} State
   */

  /**
   * @typedef {Partial<State> & {name: State['name']}} PartialState
   */

  /**
   * @typedef {State[]} Stack
   */

  /**
   * Creates new `Gouter.State` from partial state
   * @type {<N extends keyof T>(partialState: {
   * name: N
   * params?: T[N]['params']
   * query?: Partial<T[N]['query']>
   * url?: string
   * key?: string
   * }) => {
   * name: N
   * params: T[N]['params']
   * query: Partial<T[N]['query']>
   * url: string
   * key: string
   * }}
   */
  const newState = ({ name, params = {}, query = {}, url = '', key = '' }) => {
    const route = routeMap[name];
    const hasPattern = route && route.pattern !== undefined;
    const pattern = hasPattern
      ? route.pattern
      : generatePattern(String(name), params);
    const generatedUrl = url || generateUrl(pattern, params, query);
    const generatedKey = key || generatedUrl.split('?')[0];
    return Object.freeze({
      name,
      params: Object.freeze({ ...params }),
      query: Object.freeze({ ...query }),
      url: generatedUrl,
      key: generatedKey,
    });
  };

  const gouter = {
    routeMap,

    /** @type {Partial<{[K in keyof T]: Partial<Record<HookName, TransitionHook<Stack>>>}>} */
    hookMap: {},

    /** @type {import('history').History<{}>}  */
    history: null,

    /** @type {Stack} */
    stack: [],

    /** @type {State} */
    notFoundState: null,

    /** @type {(reason: any) => PromiseLike<never>} */
    hookCatch: () => null,

    /** @type {boolean} is router stack attempts to change? */
    isTransitioning: false,

    matchUrl,

    generateUrl,

    newState,

    parse,

    /** @type {import('query-string').ParseOptions} */
    parseOptions: {},

    stringify,

    // /** @type {string[]} */
    // hookNames: ['beforeExit', 'beforeEnter', 'onExit', 'onEnter'],

    // /** @type {(hookCatch?: any) => void} */
    // nextHook: () => {},

    // /**
    //  * Get last state path
    //  * @param {RouterStack} stack
    //  * @returns {RouterStack[]} stack list
    //  */
    // getStackPath: (stack) => {
    //   /** @type {RouterStack[]} */
    //   const stackPath = [];
    //   let substack = stack;
    //   while (Array.isArray(substack)) {
    //     stackPath[stackPath.length] = substack;
    //     // @ts-ignore
    //     substack = substack[substack.length - 1];
    //   }
    //   return stackPath;
    // },

    // /**
    //  * Updates `RouterStack`
    //  * @param {RouterStack} nextStack
    //  * @returns {void}
    //  */
    // setStack: (nextStack) => {
    //   if (!nextStack.length) {
    //     return gouter.onStackExit && gouter.onStackExit();
    //   }

    //   const prevMountedStack = gouter.mountedStack;
    //   const nextMountedStack = gouter.toMountedStack(nextStack);

    //   const fromStateList = gouter.toStaleStack(
    //     prevMountedStack,
    //     nextMountedStack,
    //   );
    //   const toStateList = gouter.toFreshStack(
    //     prevMountedStack,
    //     nextMountedStack,
    //   );

    //   gouter.isInitializing = false;
    //   gouter.isTransitioning = true;

    //   const fromState = prevMountedStack[prevMountedStack.length - 1];
    //   const toState = nextMountedStack[nextMountedStack.length - 1];

    //   const fromRouteList = fromStateList.map((fromState) =>
    //     gouter.getRoute(fromState.name),
    //   );
    //   const toRouteList = toStateList.map((toState) =>
    //     gouter.getRoute(toState.name),
    //   );

    //   gouter.nextHook = gouter.getNextHookList(
    //     fromState,
    //     toState,
    //     fromStateList,
    //     toStateList,
    //     fromRouteList,
    //     toRouteList,
    //     nextStack,
    //     nextMountedStack,
    //     0,
    //   );

    //   gouter.nextHook();
    // },

    /**
     * Converts partial router state to url using route map
     * @param {PartialState} state
     * @returns {URL}
     */
    stateToUrl: (state) => {
      const { name, params, query } = state;
      const route = gouter.getRoute(name);
      const hasPattern = route && route.pattern !== undefined;
      const pattern = hasPattern ? route.pattern : '/' + name;
      return gouter.generateUrl(pattern, params, query);
    },

    /**
     * Converts url to router state using route map
     * @param {URL} url
     * @returns {State}
     */
    urlToState: (url) => {
      const splitPos = url.indexOf('?');
      const pathname = splitPos === -1 ? url : url.slice(0, splitPos);
      const search = splitPos === -1 ? '' : url.slice(splitPos);

      const { routeMap } = gouter;
      /** @type {(keyof T)[]} */
      // @ts-ignore
      const routeNames = Object.getOwnPropertyNames(routeMap);

      for (const routeName of routeNames) {
        const route = routeMap[routeName];
        const hasPattern = route.pattern !== undefined;
        const pattern = hasPattern ? route.pattern : '/' + routeName;
        const params = gouter.matchUrl(pathname, pattern);
        /** @type {Partial<T[keyof T]["query"]>} */
        // @ts-ignore
        const query = gouter.parse(search, gouter.parseOptions);
        if (params) return gouter.newState({ name: routeName, params, query });
      }
    },

    /**
     * Get route from routes if name matches
     * @param {keyof routeMap} name
     * @returns {Route} `Route` instance
     */
    getRoute: (name) => {
      return gouter.routeMap[name];
    },

    // /**
    //  * Makes new iterator function to iterate over hooks of two `RouterState`s.
    //  * @param { RouterStack } fromStack
    //  * @param { RouterStack } toStack
    //  * @param { Route[] } fromRoutes
    //  * @param { Route[] } toRoutes
    //  * @param { number } hookID
    //  */
    // getNextHook: (fromStack, toStack, fromRoutes, toRoutes, hookID) =>
    //   /**
    //    * Iterates over hooks and stops on hookCatch or on last hook
    //    * @param {any} [hookCatch]
    //    * @returns {void}
    //    */
    //   function nextHook(hookCatch) {
    //     const hookName = gouter.hookNames[hookID];
    //     const isExitHook = hookID % 2 === 0;
    //     const routes = isExitHook ? fromRoutes : toRoutes;

    //     /** @type {TransitionHook[]} */
    //     const hooks = routes
    //       .map((route) => route[hookName])
    //       .filter((hook) => hook !== undefined);

    //     hookID += 1;

    //     if (hookCatch === gouter.hookCatch || hookID === 0) {
    //       hookID = -1;
    //     } else if (hooks.length) {
    //       const promises = hooks.map((hook) => hook(fromStack, toStack));
    //       Promise.all(promises).then(nextHook).catch(gouter.hookCatch);
    //     } else if (hookName) {
    //       nextHook();
    //     } else {
    //       hookID = -1;
    //       gouter.isTransitioning = false;
    //       gouter.stack = toStack;
    //       for (const listener of gouter.listeners) {
    //         listener(toStack);
    //       }
    //     }
    //   },

    /**
     * Checks next state for type errors
     * @param {State} state
     * @returns {string} error
     */
    checkState: (state) => {
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

      if (!gouter.getRoute(name)) {
        return `Gouter: name '${name}' not found in routes`;
      }
    },

    /**
     * Compares two stacks for equality, returns true if equal, false otherwise
     * @param {Stack} fromStack
     * @param {Stack} toStack
     * @returns {boolean}
     */
    areStacksEqual: (fromStack, toStack) => {
      if (fromStack.length !== toStack.length) {
        return false;
      }
      for (let i = 0; i < fromStack.length; i++) {
        if (fromStack[i].url !== toStack[i].url) {
          return false;
        }
      }
      return true;
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
     * @param {Stack} toStack
     * @returns {void}
     */
    setStack: (toStack) => {
      gouter.isTransitioning = false;
      gouter.cancelHooks();

      const fromStack = gouter.stack;

      if (!gouter.areStacksEqual(fromStack, toStack) || gouter.isInitializing) {
        gouter.isInitializing = false;
        gouter.isTransitioning = true;

        // const fromRoutes = fromStack
        //   .filter((fromState) =>
        //     toStack.every((toState) => toState.key !== fromState.key),
        //   )
        //   .map(({ name }) => gouter.getRoute(name));
        // const toRoutes = toStack
        //   .filter((toState) =>
        //     fromStack.every((fromState) => fromState.key !== toState.key),
        //   )
        //   .map(({ name }) => gouter.getRoute(name));

        const fromRoutesHooks = fromStack
          .filter((fromState) =>
            toStack.every((toState) => toState.key !== fromState.key),
          )
          .map(({ name }) => gouter.hookMap[name])
          .filter(Boolean);
        const toRoutesHooks = toStack
          .filter((toState) =>
            fromStack.every((fromState) => fromState.key !== toState.key),
          )
          .map(({ name }) => gouter.hookMap[name])
          .filter(Boolean);

        let canceled = false;
        gouter.cancelHooks = () => {
          canceled = true;
        };

        /** @type {(callbacks: function[]) => void} */
        const onFinish = (callbacks) => {
          if (!canceled) {
            for (const callback of callbacks) {
              if (typeof callback === 'function') {
                callback();
              }
            }
            gouter.isTransitioning = false;
            gouter.stack = toStack;
            for (const listener of gouter.listeners) {
              listener(toStack);
            }
            for (const { onExit } of fromRoutesHooks) {
              onExit && onExit(fromStack, toStack);
            }
            for (const { onEnter } of toRoutesHooks) {
              onEnter && onEnter(fromStack, toStack);
            }
          }
        };

        const beforeExitHooks = fromRoutesHooks.map(
          ({ beforeExit }) => beforeExit,
        );
        const beforeEnterHooks = toRoutesHooks.map(
          ({ beforeEnter }) => beforeEnter,
        );
        const promises = [...beforeExitHooks, ...beforeEnterHooks]
          .filter(Boolean)
          .map((hook) => hook(fromStack, toStack));

        Promise.all(promises).then(onFinish, gouter.hookCatch);
      }
    },

    /**
     * Go to new router state
     * @param {PartialState} partialState
     */
    goTo: (partialState) => {
      const state = gouter.newState(partialState);
      gouter.setStack([state]);
    },

    goBack: () => {
      const isWeb = !!gouter.history;

      if (isWeb) {
        gouter.history.goBack();
      } else {
        throw 'unimplemented';
      }
    },

    /**
     * List of listeners
     * @type {Listener<Stack>[]}
     */
    listeners: [],

    /**
     * Add new listener of router state changes to listeners
     * @param {Listener<Stack>} listener
     */
    listen: (listener) => {
      const { listeners } = gouter;
      if (listeners.indexOf(listener) === -1) {
        listeners.push(listener);
      }
    },

    /**
     * Remove old listener of router state changes from listeners
     * @param {Listener<Stack>} listener
     */
    unlisten: (listener) => {
      const { listeners } = gouter;
      const listenerIndex = listeners.indexOf(listener);
      if (listenerIndex !== -1) {
        listeners.splice(listenerIndex, 1);
      }
    },

    /**
     * Updates browser/memory history and url from state
     * @param {Stack} stack
     */
    updateHistory: ([state]) => {
      const { notFoundState } = gouter;
      if (state.name !== notFoundState.name) {
        const routerUrl = gouter.stateToUrl(state);
        const { location } = gouter.history;
        const browserUrl = `${location.pathname}${location.search}`;
        if (browserUrl !== routerUrl) gouter.history.push(routerUrl);
      }
    },

    /**
     * Go to new router state from history location:
     * * history location is transformed into url
     * * url is transformed into new router state or not-found state
     * * router goes to router state if it is different from previous one
     * @type {import('history').LocationListener<{}>}
     */
    goToLocation: (location) => {
      const url = location.pathname + location.search;
      const [fromState] = gouter.stack;
      const toState = gouter.urlToState(url) || gouter.notFoundState;
      if (fromState.url !== toState.url) {
        gouter.setStack([toState]);
      }
    },

    /**
     * Set history and enable listeners for history and router events
     * @param {import('history').History<{}>} history
     */
    withHistory: (history) => {
      gouter.history = history;
      gouter.listen(gouter.updateHistory);
      history.listen(gouter.goToLocation);
      gouter.goToLocation(history.location, 'REPLACE');
      return gouter;
    },

    /**
     * Set NotFound state to fallback when route name does not exist
     * @param {PartialState} partialState
     */
    withNotFoundState: (partialState) => {
      gouter.notFoundState = gouter.newState(partialState);
      return gouter;
    },

    /**
     * Set hooks for routes
     * @param {Partial<{[K in keyof T]: Partial<Record<HookName, TransitionHook<Stack>>>}>} hookMap
     */
    withHooks: (hookMap) => {
      gouter.hookMap = hookMap;
      return gouter;
    },
  };

  return gouter;
};

module.exports = Gouter;
