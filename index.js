const { parse, stringify } = require('query-string');
const { compile, pathToRegexp } = require('path-to-regexp');

/** @typedef {string} Bar e.g. 'bottom-bar' */

/** @typedef {string} Name e.g. 'user' */

/** @typedef {string} Key e.g. 'home' */

/** @typedef {Readonly<Object<string, string>>} Params e.g. {id: '17'} */

/** @typedef {Readonly<Object<string, any>>} Query e.g. {color: 'red', category: 1}  */

/** @typedef {string} URL e.g. 'post/123' */

/** @typedef {string} Segment e.g. 'UserStack/userId' */

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

/** @typedef {string} Pattern e.g. 'user/:id' */

/**
 * `Route` consists of a name, a URL matching pattern
 * @typedef Route
 * @property {Pattern} [pattern]
 * @property {Params} [params]
 * @property {Query} [query]
 * @property {boolean} [initial]
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
  if (generator) {
    return generator;
  } else {
    const newGenerator = compile(pattern);
    generatorCache[pattern] = newGenerator;
    return newGenerator;
  }
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
  const hasQuery = Object.keys(query).length > 0;
  if (hasQuery) {
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
  const kebabName = name
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    .map((x) => x.toLowerCase())
    .join('-');
  return '/' + kebabName + (urlParams ? '/' + urlParams : '');
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
  /**
   * @typedef {{[N in keyof T]: {
   * name: N
   * params: T[N]['params']
   * query: Partial<T[N]['query']>
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
    const pattern = hasPattern ? route.pattern : generatePattern(String(name), params);
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

    /** @type {StateMap} */
    stateMap: null,

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
        if (params) {
          return gouter.newState({ name: routeName, params, query });
        }
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

      if (!gouter.areStacksEqual(fromStack, toStack)) {
        gouter.isTransitioning = true;

        const fromRoutesHooks = fromStack
          .filter((fromState) => toStack.every((toState) => toState.key !== fromState.key))
          .map(({ name }) => gouter.hookMap[name])
          .filter(Boolean);
        const toRoutesHooks = toStack
          .filter((toState) => fromStack.every((fromState) => fromState.key !== toState.key))
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

        const beforeExitHooks = fromRoutesHooks.map(({ beforeExit }) => beforeExit);
        const beforeEnterHooks = toRoutesHooks.map(({ beforeEnter }) => beforeEnter);
        const promises = [...beforeExitHooks, ...beforeEnterHooks]
          .filter(Boolean)
          .map((hook) => hook(fromStack, toStack));

        Promise.all(promises).then(onFinish, gouter.hookCatch);
      }
    },

    /**
     * Get stack indices
     * @param {Stack} stack
     * @param {State} state
     * @returns {[from: number, to: number][]}
     */
    getStackIndices: (stack, state) => {
      const { getRoute } = gouter;
      /** @type {[from: number, to: number][]} */
      const stackIndices = [];
      const targetRoute = getRoute(state.name);
      const targetSegments = targetRoute.segments || [];
      const targetParams = state.params;
      for (let index = 0; index < stack.length; index++) {
        const { name, params } = stack[index];
        const segments = getRoute(name).segments || [];
        for (
          let segmentIndex = 0;
          segmentIndex < Math.min(segments.length, targetSegments.length);
          segmentIndex++
        ) {
          const segment = segments[segmentIndex];
          if (segment !== undefined) {
            const targetSegment = targetSegments[segmentIndex];
            const paramNameList = (segment.match(/\/\:[^\/]+/g) || []).map((match) =>
              match.slice('/:'.length),
            );
            if (paramNameList.length > 0) {
              const areParamsEqual = paramNameList.every(
                (paramName) => targetParams[paramName] === params[paramName],
              );
              if (areParamsEqual) {
                if (stackIndices[segmentIndex]) {
                  stackIndices[segmentIndex][1] = index;
                } else {
                  stackIndices[segmentIndex] = [index, index];
                }
              }
            } else {
              if (segment === targetSegment) {
                if (stackIndices[segmentIndex]) {
                  stackIndices[segmentIndex][1] = index;
                } else {
                  stackIndices[segmentIndex] = [index, index];
                }
              }
            }
          }
        }
      }
      for (let i = 0; i < targetSegments.length; i++) {
        stackIndices[i] = stackIndices[i] || [-1, -1];
      }
      return stackIndices;
    },

    /**
     * Get initial stack
     * @param {State} state
     * @param {number} segmentIndex
     * @returns {Stack}
     */
    getInitialStack: (state, segmentIndex) => {
      // TODO: recursively restore initial substacks!
      const { routeMap, newState, getRoute } = gouter;
      /** @type {Stack} */
      const initialStack = [];
      const { params, key } = state;
      const segments = getRoute(state.name).segments || [];
      for (const name in routeMap) {
        const route = routeMap[name];
        if (route.initial) {
          const initialSegments = route.segments || [];
          if (initialSegments.length - 1 === segmentIndex) {
            let areSegmentsEqual = true;
            for (let i = 0; i < initialSegments.length; i++) {
              if (initialSegments[i] !== segments[i]) {
                areSegmentsEqual = false;
                break;
              }
            }
            if (areSegmentsEqual) {
              initialStack[initialStack.length] = newState({
                name,
                params,
              });
            }
          }
        }
      }
      return initialStack.filter((state) => state.key !== key);
    },

    /**
     * Get stack with updated state
     * @param {Stack} stack
     * @param {State} state
     * @returns {Stack}
     */
    getStackWithUpdatedState: (stack, state) => {
      const newStack = stack.slice();
      let stateUpdated = false;
      const { key } = state;
      for (let i = 0; i < newStack.length; i++) {
        if (newStack[i].key === key) {
          newStack[i] = state;
          stateUpdated = true;
          break;
        }
      }
      if (!stateUpdated) {
        newStack[newStack.length] = state;
      }
      return newStack;
    },

    /**
     * Get stack with focused top
     * @param {Stack} stack
     * @param {State} state
     * @returns {Stack}
     */
    getStackWithFocusedTop: (stack, state) => {
      const { getRoute, getStackIndices, getInitialStack } = gouter;

      const segments = getRoute(state.name).segments || [];
      const stackIndices = getStackIndices(stack, state);
      let offset = 0;
      let nextStack = stack;
      const initialStack = stack.length ? [] : getInitialStack(state, -1);
      if (initialStack.length > 0) {
        nextStack = [...nextStack, ...initialStack];
        offset += initialStack.length;
      }
      for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
        const [from, to] = stackIndices[segmentIndex];
        if (from !== -1) {
          const leftPart = nextStack.slice(0, offset + from);
          const innerPart = nextStack.slice(offset + from, offset + to + 1);
          const rightPart = nextStack.slice(offset + to + 1);
          nextStack = [...leftPart, ...rightPart, ...innerPart];
          offset += rightPart.length;
        } else {
          const initialStack = getInitialStack(state, segmentIndex);
          if (initialStack.length > 0) {
            nextStack = [...nextStack, ...initialStack];
            offset += initialStack.length;
          }
        }
      }
      return nextStack;
    },

    /**
     * Go to new router state
     * * if state not found in current stack:
     * * * recreate parent stacks with initials if any
     * * * remove every state after parent stacks
     * * * add new state to the top
     * * if state found in current stack:
     * * * remove found state and every possible state after it
     * * * add new state to the top
     * @param {PartialState} partialState
     * @returns {void}
     */
    goTo: (partialState) => {
      const {
        history,
        stack,
        newState,
        setStack,
        getRoute,
        getStackIndices,
        getInitialStack,
        getStackWithUpdatedState,
      } = gouter;
      const state = newState(partialState);
      if (history) {
        setStack([state]);
      } else {
        const { name, key } = state;
        const segments = getRoute(name).segments || [];
        const index = stack.findIndex((state) => state.key === key);

        if (segments.length > 0 && index === -1) {
          const stackIndices = getStackIndices(stack, state);
          let offset = 0;
          let nextStack = stack;

          const initialStack = stack.length ? [] : getInitialStack(state, -1);
          if (initialStack.length > 0) {
            nextStack = initialStack.length ? [...initialStack, ...stack] : stack;
            offset = initialStack.length;
          }
          for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
            const [from, to] = stackIndices[segmentIndex];
            if (from !== -1) {
              nextStack = nextStack.slice(0, offset + to + 1);
            } else {
              const initialStack = getInitialStack(state, segmentIndex);
              if (initialStack.length > 0) {
                nextStack = [...nextStack, ...initialStack];
                offset += initialStack.length;
              }
            }
          }
          nextStack = getStackWithUpdatedState(nextStack, state);
          setStack(nextStack);
        } else if (stack.length) {
          const nextStack = [...(index === -1 ? stack : stack.slice(0, index)), state];
          setStack(nextStack);
        } else {
          const initialStack = getInitialStack(state, -1);
          const nextStack = [...initialStack, state];
          setStack(nextStack);
        }
      }
    },

    /**
     * Switch to state stack
     * * recreate parent stacks with initials if any
     * * move parent stacks to the top if any
     * * add new state to the top if previous state not found
     * @param {PartialState} partialState
     * @returns {void}
     */
    switchTo: (partialState) => {
      const {
        history,
        stack,
        newState,
        setStack,
        getStackWithFocusedTop,
        getStackWithUpdatedState,
      } = gouter;
      const state = newState(partialState);
      if (history) {
        setStack([state]);
      } else {
        let nextStack = getStackWithFocusedTop(stack, state);
        nextStack = getStackWithUpdatedState(nextStack, state);
        setStack(nextStack);
      }
    },

    /**
     * Switch to state stack and go to state
     * * recreate parent stacks with initials if any
     * * move parent stacks to the top if any
     * * add new state to the top if previous state not found
     * @param {PartialState} partialState
     * @returns {void}
     */
    switchAndGoTo: (partialState) => {
      const { history, stack, newState, setStack, getStackWithFocusedTop } = gouter;
      const state = newState(partialState);
      if (history) {
        setStack([state]);
      } else {
        let nextStack = getStackWithFocusedTop(stack, state);
        const { key } = state;
        const index = nextStack.findIndex((state) => state.key === key);
        nextStack = [...(index === -1 ? nextStack : nextStack.slice(0, index)), state];
        setStack(nextStack);
      }
    },

    /**
     * Go back to previous state
     * @param {PartialState} partialState
     * @returns {void}
     */
    goBack: () => {
      const { history, stack: prevStack, setStack } = gouter;
      if (history) {
        history.goBack();
      } else {
        const nextStack = prevStack.slice(0, -1);
        setStack(nextStack);
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
      const { notFoundState, stateToUrl, history } = gouter;
      if (state.name !== notFoundState.name) {
        const routerUrl = stateToUrl(state);
        const { location } = history;
        const browserUrl = `${location.pathname}${location.search}`;
        if (browserUrl !== routerUrl) {
          history.push(routerUrl);
        }
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
  };

  return gouter;
};

module.exports = Gouter;
