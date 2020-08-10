const { parse, stringify } = require('query-string');
const { compile, pathToRegexp } = require('path-to-regexp');
const valueEqual = require('value-equal');

/** @typedef {string} URL */

/** @typedef {string} Name e.g. 'user' */
/** @typedef {Readonly<Object<string, string>>} Params e.g. {id: '17'} */
/** @typedef {Readonly<Object<string, any>>} Query e.g. {color: 'red'}  */

/**
 * `RouterState` is readonly object with all url parts and hash
 * @typedef RouterState
 * @property {Name} name
 * @property {Params} params
 * @property {Query} query
 * @property {string} path
 */

/**
 * `RouterStateObject` is object with optional url parts
 * @typedef RouterStateObject
 * @property {Name} name
 * @property {Params} [params]
 * @property {Query} [query]
 */

/**
 * `ComponentOptions` is optional object with boolean or functional properties
 * @typedef ComponentOptions
 * @property {boolean} [href]
 * @property {boolean} [onClick]
 * @property {string} [className]
 * @property {boolean} [onPress]
 * @property {object} [style]
 */

/**
 * `RouterLinkProps` is props object for RouterLink
 * @typedef RouterLinkProps
 * @property {string} [name]
 * @property {Object.<string, string>} [params]
 * @property {Object} [query]
 * @property {string} [href]
 */

/**
 * `TransitionHookIterator` is function called to switch to next TransitionHook
 * @callback TransitionHookIterator
 * @returns {void}
 */

/**
 * `TransitionHook` is function called while transition between router states
 * @callback TransitionHook
 * @param {RouterState} fromState
 * @param {RouterState} toState
 * @returns {Promise<any>}
 */

/**
 * `Listener` is function which receives router state and called after state transition
 * @callback Listener
 * @param {RouterState} routerState
 * @returns {void}
 */

/** @typedef {string} Pattern */

/**
 * A `Route` consists of a name, a URL matching pattern and optional
 * enter/exit hooks. New gouter is initialized with an array
 * of routes which it uses to transition between states.
 * @typedef Route
 * @property {Name} name e.g. 'user'
 * @property {Pattern} [pattern] e.g. '/user/:id'
 * @property {TransitionHook} [beforeExit]
 * @property {TransitionHook} [beforeEnter]
 * @property {TransitionHook} [onExit]
 * @property {TransitionHook} [onEnter]
 */

/**
 * `RouterStateList` is a list of `RouterState`s
 * @typedef {RouterState[]} RouterStateList
 */

/**
 * `RouterStack` is a list of `RouterState`s or `RouterStack`s
 * @typedef {Array<RouterState>} Stack9
 * @typedef {Array<Stack9 | RouterState>} Stack8
 * @typedef {Array<Stack8 | RouterState>} Stack7
 * @typedef {Array<Stack7 | RouterState>} Stack6
 * @typedef {Array<Stack6 | RouterState>} Stack5
 * @typedef {Array<Stack5 | RouterState>} Stack4
 * @typedef {Array<Stack4 | RouterState>} Stack3
 * @typedef {Array<Stack3 | RouterState>} Stack2
 * @typedef {Array<Stack2 | RouterState>} Stack1
 * @typedef {Array<Stack1 | RouterState>} RouterStack
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
 * @returns {URL} `URL` instance
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
 *
 * @param {Name} name
 * @param {Params} params
 * @param {Query} query
 * @param {Route[]} routes
 * @returns {RouterState} `RouterState`
 * @example
 * ('about') ==> {name: 'about', params: {}, query: {}}
 * ('user', {id: 11}) ==> {name: 'user', params: {id: 11}, query: {}}
 * ('search', {}, {on: 1}) ==> {name: 'user', params: {}, query: {on: 1}
 * ('car', {id: 7}, {color: 'red'}) ==> {name: 'car', {id: 7}, {color: 'red'}}
 */
const newRouterState = (name, params = {}, query = {}, routes) => {
  const route = routes.find((route) => route.name === name);
  const hasPattern = route && route.pattern !== void 0;
  const pattern = hasPattern
    ? route.pattern
    : '/' + (route ? route.name : name);
  const path = generateUrl(pattern, params);
  return Object.freeze({
    name,
    params: Object.freeze({ ...params }),
    query: Object.freeze({ ...query }),
    path,
  });
};

/**
 * Creates `Gouter` instance.
 * It allows transitioning between states using the `goTo` method.
 * It allows to add and remove listeners via `listen` and `unlisten` methods.
 * It automatically listens to history changes.
 *
 * @param {Route[]} routes list of `Route` instances
 * @example
 * const gouter = Gouter([
 *     {
 *          name: 'home',
 *          pattern: '/'
 *     },
 *     {
 *          name: 'user',
 *          pattern: '/user/:id'
 *     },
 * ])
 */
const Gouter = (routes) => {
  const gouter = {
    routes,

    /** @type {import('history').History<{}>}  */
    history: null,

    /** @type {RouterStack} */
    stack: [],

    /** @type {() => void} */
    onStackExit: null,

    /** @type {(tabs: RouterStateList) => void} */
    onStackTabs: null,

    /** @type {(reason: any) => PromiseLike<never>} */
    hookCatch: () => null,

    /** @type {RouterStateList} */
    mountedStack: [],

    /** @type {RouterStateList} */
    unmountedStack: [],

    // get initial router state from first route in routes
    routerState: newRouterState(routes[0].name, {}, {}, routes),

    // get not-found state from last route in routes
    notFoundState: newRouterState(
      routes[routes.length - 1].name,
      {},
      {},
      routes,
    ),

    /** @type {boolean} is router state transitioning? */
    isTransitioning: false,

    /** @type {boolean} is router state initializing? */
    isInitializing: true,

    matchUrl,

    generateUrl,

    newRouterState,

    parse,

    /** @type {import('query-string').ParseOptions} */
    parseOptions: {},

    stringify,

    /** @type {string[]} */
    hookNames: ['beforeExit', 'beforeEnter', 'onExit', 'onEnter'],

    /** @type {(hookCatch?: any) => void} */
    nextHook: () => {},

    /**
     * Get `RouterStack` path
     * @param {RouterStack} stack
     * @returns {RouterStack[]}
     */
    getStackPath: (stack) => {
      /** @type {RouterStack[]} */
      const stackPath = [];
      let substack = stack;
      while (Array.isArray(substack)) {
        stackPath[stackPath.length] = substack;
        // @ts-ignore
        substack = substack[substack.length - 1];
      }
      return stackPath;
    },

    /**
     * Get mounted `RouterState`s
     * @param {RouterStack} stack
     * @returns {RouterStateList}
     */
    toMountedStack: (stack) => {
      /** @type  {RouterStateList}*/
      const mountedStack = [];
      for (let i = 0; i < stack.length; i++) {
        const substackOrState = stack[i];
        if (Array.isArray(substackOrState)) {
          const renderedSubList = gouter.toMountedStack(substackOrState);
          for (let j = 0; j < renderedSubList.length; j++) {
            mountedStack[mountedStack.length] = renderedSubList[j];
          }
        } else {
          mountedStack[mountedStack.length] = substackOrState;
        }
      }
      return mountedStack;
    },

    /**
     * Get stale `RouterState`s from previous mounted stack
     * @param {RouterStateList} prevStack
     * @param {RouterStateList} nextStack
     * @returns {RouterStateList}
     */
    toStaleStack: (prevStack, nextStack) => {
      /** @type  {RouterStateList}*/
      const unmountedStack = [];
      const nextStackPathMap = {};
      for (let i = 0; i < nextStack.length; i++) {
        const state = nextStack[i];
        const { path } = state;
        nextStackPathMap[path] = true;
      }
      for (let i = 0; i < prevStack.length; i++) {
        const state = prevStack[i];
        const { path } = state;
        if (!nextStackPathMap[path]) {
          unmountedStack[unmountedStack.length] = state;
        }
      }
      return unmountedStack;
    },

    /**
     * Get fresh `RouterState`s from next mounted stack
     * @param {RouterStateList} prevStack
     * @param {RouterStateList} nextStack
     * @returns {RouterStateList}
     */
    toFreshStack: (prevStack, nextStack) => {
      /** @type  {RouterStateList}*/
      const freshStack = [];
      const prevStackPathMap = {};
      for (let i = 0; i < prevStack.length; i++) {
        const state = prevStack[i];
        const { path } = state;
        prevStackPathMap[path] = true;
      }
      for (let i = 0; i < nextStack.length; i++) {
        const state = nextStack[i];
        const { path } = state;
        if (!prevStackPathMap[path]) {
          freshStack[freshStack.length] = state;
        }
      }
      return freshStack;
    },

    /**
     * Updates `RouterStack`
     * @param {RouterStack} nextStack
     */
    setStack: (nextStack) => {
      if (!nextStack.length) {
        return gouter.onStackExit && gouter.onStackExit();
      }

      const prevMountedStack = gouter.mountedStack;
      const nextMountedStack = gouter.toMountedStack(nextStack);

      const fromStateList = gouter.toStaleStack(
        prevMountedStack,
        nextMountedStack,
      );
      const toStateList = gouter.toFreshStack(
        prevMountedStack,
        nextMountedStack,
      );

      gouter.isInitializing = false;
      gouter.isTransitioning = true;

      const fromState = prevMountedStack[prevMountedStack.length - 1];
      const toState = nextMountedStack[nextMountedStack.length - 1];

      const fromRouteList = fromStateList.map((fromState) =>
        gouter.getRoute(fromState.name),
      );
      const toRouteList = toStateList.map((toState) =>
        gouter.getRoute(toState.name),
      );

      gouter.nextHook = gouter.getNextHookList(
        fromState,
        toState,
        fromStateList,
        toStateList,
        fromRouteList,
        toRouteList,
        nextStack,
        nextMountedStack,
        0,
      );

      gouter.nextHook();
    },

    /**
     * Converts routerState to url
     * @param {RouterState} routerState router state
     * @returns {string} url
     */
    routerStateToUrl: (routerState) => {
      const { name, params, query } = routerState;
      const route = gouter.getRoute(name);
      const hasPattern = route && route.pattern !== void 0;
      const pattern = hasPattern
        ? route.pattern
        : '/' + (route ? route.name : name);
      return gouter.generateUrl(pattern, params, query);
    },

    /**
     * Converts url to routerState
     * @param {string} url url
     * @returns {RouterState} router state
     */
    urlToRouterState: (url) => {
      const splitPos = url.indexOf('?');
      const pathname = splitPos === -1 ? url : url.slice(0, splitPos);
      const search = splitPos === -1 ? '' : url.slice(splitPos);

      const { routes } = gouter;

      for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        const hasPattern = route.pattern !== void 0;
        const pattern = hasPattern ? route.pattern : '/' + route.name;
        const params = gouter.matchUrl(pathname, pattern);
        const query = gouter.parse(search, gouter.parseOptions);
        if (params)
          return gouter.newRouterState(route.name, params, query, routes);
      }
    },

    /**
     * Get route from routes if name matches
     * @param {Name} name
     * @returns {Route} `Route` instance
     */
    getRoute: (name) => {
      const { routes } = gouter;
      for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        if (route.name === name) return route;
      }
    },

    /**
     * Updates browser/memory history and url from state
     * @param {RouterState} routerState
     * @returns {void}
     */
    updateHistory: (routerState) => {
      const { notFoundState } = gouter;
      if (routerState.name !== notFoundState.name) {
        const routerUrl = gouter.routerStateToUrl(routerState);
        const { location } = gouter.history;
        const browserUrl = `${location.pathname}${location.search}`;
        if (browserUrl !== routerUrl) gouter.history.push(routerUrl);
      }
    },

    /**
     * Makes new iterator function to iterate over hooks of two `RouterState` lists.
     * @param { RouterState } fromState
     * @param { RouterState } toState
     * @param { RouterStateList } fromStateList
     * @param { RouterStateList } toStateList
     * @param { Route[] } fromRouteList
     * @param { Route[] } toRouteList
     * @param { RouterStack } nextStack
     * @param { RouterStateList } nextMountedStack
     * @param { number } hookID
     */
    getNextHookList: (
      fromState,
      toState,
      fromStateList,
      toStateList,
      fromRouteList,
      toRouteList,
      nextStack,
      nextMountedStack,
      hookID,
    ) =>
      /**
       * Iterates over hooks and stops on hookCatch or on last hook
       * @param {any} [hookCatch]
       * @returns {void}
       */
      function nextHook(hookCatch) {
        const hookName = gouter.hookNames[hookID];
        const isExitHook = hookID % 2 === 0;

        const routeList = isExitHook ? fromRouteList : toRouteList;

        /** @type {TransitionHook[]} */
        const hookList = routeList
          .map((route) => route[hookName])
          .filter((hook) => hook !== undefined);

        hookID += 1;

        if (hookCatch === gouter.hookCatch || hookID === 0) {
          hookID = -1;
        } else if (hookList.length) {
          const stateList = (isExitHook ? fromStateList : toStateList)
            .map((state, index) =>
              routeList[index][hookName] ? state : undefined,
            )
            .filter((state) => state !== undefined);
          const promiseList = hookList.map((hook, index) =>
            hook(
              isExitHook ? stateList[index] : fromState,
              isExitHook ? toState : stateList[index],
            ),
          );
          Promise.all(promiseList).then(nextHook).catch(gouter.hookCatch);
        } else if (hookName) {
          nextHook();
        } else {
          hookID = -1;
          gouter.isTransitioning = false;
          gouter.routerState = toState;

          gouter.mountedStack = nextMountedStack;
          gouter.unmountedStack = [...gouter.unmountedStack, ...fromStateList];
          gouter.stack = nextStack;

          if (gouter.onStackTabs) {
            const stackPath = gouter.getStackPath(nextStack);
            const lastStack = stackPath[stackPath.length - 1];
            const penultStack = stackPath[stackPath.length - 2];
            const isTabVisible =
              lastStack.length === 1 &&
              Array.isArray(penultStack && penultStack[0]);
            const stackTabs = isTabVisible
              ? penultStack.map((stack) => stack[0])
              : [];
            gouter.onStackTabs(stackTabs);
          }

          for (const listener of gouter.listeners) {
            listener(toState);
          }
        }
      },

    /**
     * Makes new iterator function to iterate over hooks of two `RouterState`s.
     * @param { RouterState } fromState
     * @param { RouterState } toState
     * @param { Route } fromRoute
     * @param { Route } toRoute
     * @param { number } hookID
     */
    getNextHook: (fromState, toState, fromRoute, toRoute, hookID) =>
      /**
       * Iterates over hooks and stops on hookCatch or on last hook
       * @param {any} [hookCatch]
       * @returns {void}
       */
      function nextHook(hookCatch) {
        const hookName = gouter.hookNames[hookID];
        const isExitHook = hookID % 2 === 0;

        /** @type {TransitionHook} */
        const hook = isExitHook ? fromRoute[hookName] : toRoute[hookName];

        hookID += 1;

        if (hookCatch === gouter.hookCatch || hookID === 0) {
          if (!isExitHook && hookID !== 0) {
            gouter.routerState = gouter.notFoundState;
          }
          hookID = -1;
        } else if (hook) {
          const promise = hook(fromState, toState);
          promise.then(nextHook).catch(gouter.hookCatch);
        } else if (hookName) {
          nextHook();
        } else {
          hookID = -1;
          gouter.isTransitioning = false;
          gouter.routerState = toState;
          for (const listener of gouter.listeners) {
            listener(toState);
          }
        }
      },

    /**
     * Checks `RouterStateObject` for type errors
     * @param {RouterStateObject} state
     * @returns {string} error
     */
    checkState: (state) => {
      if (typeof state !== 'object') {
        const type = typeof state;
        return `Router: state is not an object but ${type}`;
      }

      const { name, params, query } = state;

      if (
        typeof name !== 'string' ||
        (params !== void 0 && typeof params !== 'object') ||
        (query !== void 0 && typeof query !== 'object')
      ) {
        const type = `{name: ${typeof name}, params: ${typeof params}, query: ${typeof query}}`;
        return `Router: state is not {name: string, params?: object, query?: object} but ${type}`;
      }

      if (!gouter.getRoute(name)) {
        return `Router: state name '${name}' not found in routes`;
      }
    },

    /**
     * Attempts to transit to a new router state:
     * * Checks received state for type errors and route matching.
     * * Stops any running hooks for previous state.
     * * If state is the same as before stops current transition.
     * * Runs `beforeExit` hook if previous state has it.
     * * Runs `beforeEnter` hook if current state has it.
     * * Runs `onExit` hook if previous state has it.
     * * Runs `onEnter` hook if current state has it.
     * * Updates current state to received state.
     * * Updates document title and meta (browser only).
     * * Updates browser/memory history.
     * * Runs every listener with current state.
     *
     * Note: current transiton will be stopped on new `goTo` call.
     * @param {RouterStateObject | RouterStateObject[]} stateOrStateList
     * @example
     * goTo({ name: 'about' })
     * goTo({ name: 'user', params: {id: '14'}, query: {online: true} })
     */
    goTo: (stateOrStateList) => {
      const stateObjectList = Array.isArray(stateOrStateList)
        ? stateOrStateList
        : [stateOrStateList];

      const stateListLength = stateObjectList.length;

      /** @type {RouterStateList} */
      const stateList = [];

      for (let i = 0; i < stateListLength; i++) {
        const stateObject = stateObjectList[i];
        const error = gouter.checkState(stateObject);
        if (error) {
          throw Error(error);
        }
        stateList[i] = gouter.newRouterState(
          stateObject.name,
          stateObject.params,
          stateObject.query,
          gouter.routes,
        );
      }

      gouter.isTransitioning = false;
      gouter.nextHook(gouter.hookCatch);

      if (gouter.history) {
        if (stateListLength > 0) {
          const fromState = gouter.routerState;
          const toState = stateList[stateListLength - 1];

          if (
            fromState.path !== toState.path ||
            !valueEqual(fromState.query, toState.query) ||
            gouter.isInitializing
          ) {
            const fromRoute = gouter.getRoute(fromState.name);
            const toRoute = gouter.getRoute(toState.name);

            gouter.isInitializing = false;
            gouter.isTransitioning = true;

            gouter.nextHook = gouter.getNextHook(
              fromState,
              toState,
              fromRoute,
              toRoute,
              0,
            );

            gouter.nextHook();
          }
        } else {
          gouter.history[gouter.history['back'] ? 'back' : 'goBack']();
        }
      } else {
        if (stateListLength === 1) {
          const [state] = stateList;
          const stackPath = gouter.getStackPath(gouter.stack);
          // go to tab if any
          for (let i = stackPath.length - 2; i >= 0; i--) {
            const substack = stackPath[i];
            if (Array.isArray(substack[0]) && Array.isArray(substack[1])) {
              for (let n = substack.length - 2; n >= 0; n--) {
                const subsubstack = substack[n];
                if (Array.isArray(subsubstack)) {
                  const tabFirstState =
                    Array.isArray(subsubstack) &&
                    !Array.isArray(subsubstack[0]) &&
                    subsubstack[0];
                  if (tabFirstState.path === state.path) {
                    let stack = [
                      ...substack.slice(0, n),
                      ...substack.slice(n + 1),
                      [state, ...subsubstack.slice(1)],
                    ];
                    for (let j = i - 1; j >= 0; j--) {
                      stack = [...stackPath[j].slice(0, -1), stack];
                    }
                    return gouter.setStack(stack);
                  }
                }
              }
            }
          }
          // go to state
          for (let i = stackPath.length - 1; i >= 0; i--) {
            const substack = stackPath[i];
            for (let n = substack.length - 1; n >= 0; n--) {
              const substate = substack[n];
              if (!Array.isArray(substate) && substate.path === state.path) {
                const lastStack = substack.slice(0, n);
                let stack = [...lastStack, state];
                for (let j = i - 1; j >= 0; j--) {
                  stack = [...stackPath[j].slice(0, -1), stack];
                }
                return gouter.setStack(stack);
              }
            }
          }
          // if state not found in stacks then add it to the tail
          const lastStack = stackPath[stackPath.length - 1];
          let stack = [...lastStack, state];
          for (let i = stackPath.length - 2; i >= 0; i--) {
            stack = [...stackPath[i].slice(0, -1), stack];
          }
          return gouter.setStack(stack);
        } else if (stateListLength > 1) {
          // go into tabs
          const stackPath = gouter.getStackPath(gouter.stack);
          const lastStack = stackPath[stackPath.length - 1];
          let stack = [...lastStack, stateList.map((state) => [state])];
          for (let i = stackPath.length - 2; i >= 0; i--) {
            stack = [...stackPath[i].slice(0, -1), stack];
          }
          return gouter.setStack(stack);
        } else {
          // goBack
          const stackPath = gouter.getStackPath(gouter.stack);
          for (let i = stackPath.length - 1; i >= 0; i--) {
            const substack = stackPath[i];
            if (substack.length > 1) {
              const lastStack = substack.slice(0, -1);
              let stack = lastStack;
              for (let j = i - 1; j >= 0; j--) {
                stack = [...stackPath[j].slice(0, -1), stack];
              }
              return gouter.setStack(stack);
            } else if (substack.length === 1) {
              if (i > 0) {
                const tabStack = stackPath[i - 1];
                const isTabStack = Array.isArray(tabStack[0]);
                if (isTabStack) {
                  const tabParentStack = stackPath[i - 2];
                  const lastStack = tabParentStack.slice(0, -1);
                  let stack = lastStack;
                  for (let j = i - 3; j >= 0; j--) {
                    stack = [...stackPath[j].slice(0, -1), stack];
                  }
                  return gouter.setStack(stack);
                }
              } else {
                const stack = [];
                return gouter.setStack(stack);
              }
            } else if (i === 0) {
              const stack = [];
              return gouter.setStack(stack);
            }
            if (substack.length) {
              return;
            }
          }
        }
      }
    },

    /**
     * Go to new router state from history location:
     * * history location is transformed into url
     * * url is transformed into new router state or not-found state
     * * router goes to router state if it is different from previous one
     */
    goToLocation: (stateOrLocation) => {
      /** @type {import('history').Location} */
      const location = stateOrLocation.location || stateOrLocation;
      const url = location.pathname + location.search;
      const fromState = gouter.routerState;
      const toState = gouter.urlToRouterState(url) || gouter.notFoundState;
      if (
        fromState.path !== toState.path ||
        !valueEqual(fromState.query, toState.query)
      ) {
        gouter.goTo(toState);
      }
    },

    /**
     * List of listeners
     * @type {Listener[]}
     */
    listeners: [],

    /**
     * Add new listener of router state changes to listeners
     * @param {Listener} listener
     */
    listen: (listener) => {
      const { listeners } = gouter;
      if (listeners.indexOf(listener) === -1) {
        listeners.push(listener);
      }
    },

    /**
     * Remove old listener of router state changes from listeners
     * @param {Listener} listener
     */
    unlisten: (listener) => {
      const { listeners } = gouter;
      const listenerIndex = listeners.indexOf(listener);
      if (listenerIndex !== -1) {
        listeners.splice(listenerIndex, 1);
      }
    },

    /**
     * Set history and enable listeners for history and router events
     * @param {import('history').History<{}>} history
     */
    setHistory: (history) => {
      gouter.history = history;
      gouter.listen(gouter.updateHistory);
      history.listen(gouter.goToLocation);
      gouter.goToLocation(history.location);
    },
  };

  return gouter;
};

module.exports = Gouter;
