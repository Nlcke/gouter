const { parse, stringify } = require('query-string');
const { compile, pathToRegexp } = require('path-to-regexp');

/** @typedef {string} Bar e.g. 'bottom-bar' */

/** @typedef {string} Name e.g. 'user' */

/** @typedef {string} Key e.g. 'home' */

/** @typedef {Record<string, string>} Params e.g. {id: '17'} */

/** @typedef {Record<string, any>} Query e.g. {color: 'red', category: 1}  */

/** @typedef {string} URL e.g. 'post/123' */

/**
 * `TransitionHooks` is set of functions called while transition between router states
 * @template T
 * @typedef {{
 * onBack?: (state: T, focusedStates: T[]) => T | null
 * onInit?: (state: T, focusedStates: T[]) => T
 * onSwitch?: (state: T, focusedStates: T[]) => T
 * beforeExit?: (fromState: T, toState: T) => Promise<void | function>
 * beforeEnter?: (fromState: T, toState: T) => Promise<void | function>
 * onExit?: (fromState: T, toState: T) => Promise<void | function>
 * onEnter?: (fromState: T, toState: T) => Promise<void | function>
 * }} TransitionHooks
 */

/**
 * `Listener` function receives state and is called after router transition
 * @template T
 * @callback Listener
 * @param {T} state
 * @returns {void}
 */

/** @typedef {string} Pattern e.g. 'user/:id' */

/**
 * `Route` consists of all optional uri matching pattern, params object and query object
 * @typedef Route
 * @property {Pattern} [pattern]
 * @property {Params} [params]
 * @property {Query} [query]
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
   * @typedef {{[N in keyof T]: {
   * name: N
   * params: T[N]['params']
   * query: Partial<T[N]['query']>
   * }}} StateMap
   */

  /**
   * @typedef {StateMap[keyof StateMap]} SimpleState
   */

  /**
   * @typedef {(SimpleState & {url: string, key: string, stack: State[]})} State
   */

  /**
   * @typedef {Partial<SimpleState> & {name: State['name'], stack?: PartialState[]}} PartialState
   */

  /**
   * @typedef {Partial<SimpleState> & TransitionHooks<State> & {
   * name: SimpleState['name']
   * stack?: ExtPartialState[]
   * initial?: boolean
   * }} ExtPartialState
   */

  /** @type {keyof T} */
  // @ts-ignore
  const initialName = '';

  const gouter = {
    routeMap: routes,

    /** @type {Partial<Record<keyof T, ExtPartialState[]>>} */
    pathMap: {},

    /** @type {import('history').History<{}> | null}  */
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
     * Generates a URL from a pattern, parameters and query parameters.
     * @param {Pattern} pattern
     * @param {Params} params
     * @param {Query} query
     * @returns {URL} `URL`
     */
    generateUrl: (pattern = '/', params = {}, query = {}) => {
      const { getGenerator } = gouter;
      const generator = getGenerator(pattern);
      const urlPatternStr = generator(params);
      const hasQuery = Object.keys(query).length > 0;
      if (hasQuery) {
        return urlPatternStr + '?' + stringify(query);
      } else {
        return urlPatternStr;
      }
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
     * @type {<N extends keyof T>(partialState: {
     * name: N
     * params?: T[N]['params']
     * query?: Partial<T[N]['query']>
     * stack?: PartialState[]
     * }) => {
     * name: N
     * params: T[N]['params']
     * query: Partial<T[N]['query']>
     * url: string
     * key: string
     * stack: State[]
     * }}
     */
    newState: ({ name, params = {}, query = {}, stack = [] }) => {
      const { newState, generatePattern, generateUrl, routeMap } = gouter;
      const route = routeMap[name];
      const hasPattern = route && route.pattern !== undefined;
      const pattern = hasPattern
        ? route.pattern
        : generatePattern(String(name), params);
      const url = generateUrl(pattern, params, query);
      const key = url.split('?')[0];
      const fullStack = stack.map(newState);
      return {
        name,
        params,
        query,
        url,
        key,
        stack: fullStack,
      };
    },

    /** @type {import('query-string').ParseOptions} */
    parseOptions: {},

    /**
     * Converts partial router state to url using route map
     * @param {PartialState} partialState
     * @returns {URL}
     */
    stateToUrl: (partialState) => {
      const { routeMap, generatePattern, generateUrl } = gouter;
      const { name, params, query } = partialState;
      const route = routeMap[name];
      const pattern =
        route && route.pattern !== undefined
          ? route.pattern
          : generatePattern(String(name), params || {});
      return generateUrl(pattern, params, query);
    },

    /**
     * Converts url to router state using route map
     * @param {URL} url
     * @returns {State}
     */
    urlToState: (url) => {
      const {
        matchUrl,
        routeMap,
        generatePattern,
        parseOptions,
        newState,
        notFoundState,
      } = gouter;
      const [pathname, search = ''] = url.split('?');
      for (const name in routeMap) {
        const route = routeMap[name];
        const pattern =
          route.pattern !== undefined
            ? route.pattern
            : generatePattern(name, route.params || {});
        const params = matchUrl(pathname, pattern);
        if (params) {
          /** @type {Partial<T[keyof T]["query"]>} */
          // @ts-ignore
          const query = parse(search, parseOptions);
          return newState({ name, params, query });
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
     * @returns {void}
     */
    setState: (toState) => {
      const { cancelHooks, state: fromState, stateToStack, pathMap } = gouter;
      gouter.isTransitioning = false;
      cancelHooks();

      const fromStack = stateToStack(fromState);
      const toStack = stateToStack(toState);

      const areStatesEqual =
        fromStack.length !== toStack.length ||
        fromStack.some(({ url }) => url !== toState.url);

      console.log('check areStatesEqual condition!');

      if (!areStatesEqual) {
        gouter.isTransitioning = true;

        /** @type {(state: State) => ExtPartialState | null} */
        const getHooksForState = (state) => {
          const extPartialState = pathMap[state.name];
          if (extPartialState) {
            return extPartialState[extPartialState.length - 1];
          } else {
            return null;
          }
        };

        const fromRoutesHooks = fromStack
          .filter(({ key: fromStateKey }) =>
            toStack.every(({ key: toStateKey }) => toStateKey !== fromStateKey),
          )
          .map(getHooksForState);
        const toRoutesHooks = toStack
          .filter(({ key: toStateKey }) =>
            fromStack.every(
              ({ key: fromStateKey }) => fromStateKey !== toStateKey,
            ),
          )
          .map(getHooksForState);

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
            gouter.state = toState;
            for (const listener of gouter.listeners) {
              listener(toState);
            }
            for (const fromRoutesHook of fromRoutesHooks) {
              fromRoutesHook?.onExit?.(fromState, toState);
            }
            for (const toRoutesHook of toRoutesHooks) {
              toRoutesHook?.onEnter?.(fromState, toState);
            }
          }
        };

        const beforeExitHooks = fromRoutesHooks.map(
          (fromRoutesHook) => fromRoutesHook?.beforeExit,
        );
        const beforeEnterHooks = toRoutesHooks.map(
          (toRoutesHook) => toRoutesHook?.beforeEnter,
        );
        const promises = [...beforeExitHooks, ...beforeEnterHooks]
          .filter(Boolean)
          .map((hook) => hook?.(fromState, toState));

        Promise.all(promises).then(onFinish, gouter.hookCatch);
      }
    },

    /**
     * Get focused states as list from top to bottom
     * @param {State} state
     * @returns {State[]}
     */
    getFocusedStates: (state) => {
      const focusedStates = [state];
      let lastState = state;
      while (true) {
        const { stack } = lastState;
        lastState = stack[stack.length - 1];
        if (lastState && !focusedStates.includes(lastState)) {
          focusedStates[focusedStates.length] = lastState;
        } else {
          return focusedStates;
        }
      }
    },

    /**
     * Default `onBack` handler
     * @type {Required<TransitionHooks<State>>['onBack']}
     */
    onBack: (state, focusedStates) =>
      state.stack.length > 1
        ? {
            ...state,
            stack: state.stack.slice(0, -1),
          }
        : null,

    /**
     * Default `onInit` handler
     * @type {Required<TransitionHooks<State>>['onInit']}
     */
    onInit: (state, focusedStates) => state,

    /**
     * Default `onSwitch` handler
     * @type {Required<TransitionHooks<State>>['onSwitch']}
     */
    onSwitch: (state, focusedStates) => state,

    // /**
    //  *
    //  * @param {keyof T} name
    //  * @returns {(keyof T)[]}
    //  */
    // getStatePathByName: (name) => {
    //   const { struct, routeMap } = gouter;
    //   /** @type {(keyof T)[]} */
    //   const statePath = [struct.name];
    //   let currentStruct = struct;
    //   const maxLength = Object.keys(routeMap).length;
    //   for (let i = 0; i < maxLength; i++) {
    //     if (currentStruct.name === name) {
    //       return statePath;
    //     } else {
    //     }
    //   }
    //   return statePath;
    // },

    // /**
    //  * Find state
    //  * @param {State} state
    //  * @returns {State[]}
    //  */
    // getPathStates: (state) => {
    //   const { state: prevState, struct, getStatePathByName } = gouter;
    //   if (prevState.key === state.key) {
    //     return [prevState];
    //   } else {
    //     /** @type {State[]} */
    //     const pathStates = [];
    //     let currentState = prevState;
    //     while (true) {
    //       if (currentState.stack) {
    //         return pathStates;
    //       }
    //     }
    //   }
    // },

    /**
     * Go to state
     * @param {PartialState} partialState
     */
    goTo: (partialState) => {
      const { history, state: prevState, newState, pathMap, setState } = gouter;
      const state = newState(partialState);
      if (history) {
        history.push(state.url);
      } else {
        const path = pathMap[state.name];
        if (path) {
          let currentState = prevState;
          for (let index = 0; index < path.length; index++) {
            // TODO: find real path
            /** @type {keyof T} */
            const name = path[index].name;
            if (name === currentState.name) {
            }
          }
        } else {
          setState(state);
        }
      }

      // find if state is exist

      // get stack chain from topStack till partialState
      // from first missing stack till partialState stack call onGoTo
      // each result should be passed to bottom onGoTo call
      // in the end call set
      // const state = newState(partialState);

      // const prevFocusedStates = getFocusedStates(prevState);
      // const nextFocusedStates = getNextFocusedStates(partialState);
    },

    /**
     * Go back to previous state
     * @returns {void}
     */
    goBack: () => {
      const {
        history,
        state: prevState,
        getFocusedStates,
        pathMap,
        onBack: defaultOnBack,
        setState,
      } = gouter;
      if (history) {
        history.goBack();
      } else {
        const focusedStates = getFocusedStates(prevState);
        const maxIndex = focusedStates.length - 2;
        for (let index = maxIndex; index >= 0; index--) {
          const focusedState = focusedStates[maxIndex];
          const { name } = focusedState;
          const path = pathMap[name];
          const onBack = path
            ? path[path.length - 1].onBack || defaultOnBack
            : defaultOnBack;
          const nextFocusedState = onBack(focusedState, focusedStates);
          if (nextFocusedState) {
            if (nextFocusedState !== focusedState) {
              let nextState = { ...prevState };
              let currentState = nextState;
              for (let i = 0; i <= index; i++) {
                const stack = nextState.stack;
                currentState =
                  i === index ? currentState : { ...stack[stack.length - 1] };
                nextState.stack = [...stack.slice(0, -1), currentState];
              }
              setState(nextState);
            }
            return;
          }
        }
      }
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
      const { notFoundState, stateToUrl, history } = gouter;
      if (history && state.name !== notFoundState.name) {
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
      const { state: fromState, urlToState, notFoundState, setState } = gouter;
      const url = location.pathname + location.search;
      const toState = urlToState(url) || notFoundState;
      if (toState && (!fromState || fromState.url !== toState.url)) {
        setState(toState);
      }
    },

    /**
     * Set initial state to start from
     * @param {PartialState} partialState
     */
    withInitialState: (partialState) => {
      const { newState } = gouter;
      gouter.state = newState(partialState);
      return gouter;
    },

    /**
     * Set NotFound state to fallback when route name does not exist
     * @param {PartialState} partialState
     */
    withNotFoundState: (partialState) => {
      const { newState } = gouter;
      gouter.notFoundState = newState(partialState);
      return gouter;
    },

    /**
     * Set history and enable listeners for history and router events
     * @param {import('history').History<{}>} history
     */
    withHistory: (history) => {
      const { listen, updateHistory, goToLocation } = gouter;
      gouter.history = history;
      listen(updateHistory);
      history.listen(goToLocation);
      goToLocation(history.location, 'REPLACE');
      return gouter;
    },

    /**
     * Set struct
     * @param {ExtPartialState} struct
     */
    withStruct: (struct) => {
      /** @type {Partial<Record<keyof T, ExtPartialState[]>>} */
      const pathMap = {};

      /** @type {(subStruct: ExtPartialState, path: ExtPartialState[]) => void} */
      const fillPaths = (subStruct, path) => {
        /** @type {ExtPartialState[]} */
        const nextPath = [...path, subStruct];
        if (pathMap[subStruct.name]) {
          throw Error(
            `Struct has duplicate definitions for '${subStruct.name}' name. Use only one definition per name.`,
          );
        } else {
          pathMap[subStruct.name] = nextPath;
        }
        if (subStruct.stack) {
          for (const subSubStruct of subStruct.stack) {
            fillPaths(subSubStruct, nextPath);
          }
        }
      };

      fillPaths(struct, []);
      gouter.pathMap = pathMap;
      return gouter;
    },
  };

  return gouter;
};

module.exports = Gouter;
