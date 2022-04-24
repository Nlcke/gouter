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
 * @typedef {Partial<{
 * onStackInit: (state: T) => T[]
 * shouldGoTo: (parents: T[], state: T) => boolean
 * shouldGoBack: (parents: T[]) => boolean
 * onGoTo: (parents: T[], state: T) => T
 * onGoBack: (parents: T[]) => T
 * beforeExit: (thisState: T, fromState: T, toState: T) => Promise<void | function>
 * beforeEnter: (thisState: T, fromState: T, toState: T) => Promise<void | function>
 * onExit: (thisState: T, fromState: T, toState: T) => void
 * onEnter: (thisState: T, fromState: T, toState: T) => void
 * }>} TransitionHooks
 */

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
   * params: T[N]['params'] extends Params ? T[N]['params'] : EmptyObject
   * query: T[N]['query'] extends Query ? Partial<T[N]['query']> : EmptyObject
   * }}} StateMap
   */

  /**
   * @typedef {{[N in keyof T]: T[N]['params'] extends Params ? {
   * name: N
   * params: NonNullable<T[N]['params']>
   * query?: StateMap[N]['query'] | ((query: StateMap[N]['query']) => StateMap[N]['query'])
   * } : {
   * name: N
   * params?: EmptyObject
   * query?: StateMap[N]['query'] | ((query: StateMap[N]['query']) => StateMap[N]['query'])
   * }}} PartialStateMap
   */

  /**
   * @typedef {(StateMap[keyof StateMap] & {url: string, key: string, stack: State[]})} State
   */

  /**
   * @typedef {PartialStateMap[keyof T] & {stack?: State[] | ((stack: State[]) => State[])}} PartialState
   */

  /** @type {keyof T} */
  // @ts-ignore
  const initialName = '';

  const gouter = {
    routeMap: routes,

    /** @type {Partial<Record<keyof T, TransitionHooks<State>>>} */
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
     * @type {<N extends keyof T>(partialState: T[N]['params'] extends Params ? {
     * name: N
     * params: T[N]['params']
     * query?: Partial<T[N]['query']>
     * stack?: State[]
     * } : {
     * name: N
     * params?: EmptyObject
     * query?: Partial<T[N]['query']>
     * stack?: State[]
     * }) => State & {name: N}}
     */
    newState: ({ name, params, query, stack }) => {
      const {
        generatePattern,
        generateUrl,
        routeMap,
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
      const route = routeMap[name];
      const hasPattern = route && route.pattern !== undefined;
      const pattern = hasPattern
        ? route.pattern
        : generatePattern(String(name), fullParams);
      const url = generateUrl(pattern, fullParams, fullQuery);
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

    /** @type {import('query-string').ParseOptions} */
    parseOptions: {},

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
      throw 'Handle # anchor tag!';
      for (const name in routeMap) {
        const route = routeMap[name];
        const pattern =
          route.pattern !== undefined
            ? route.pattern
            : generatePattern(name, route.params || {});
        const params = matchUrl(pathname, pattern);
        if (params) {
          const query = parse(search, parseOptions);
          // @ts-ignore
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

    /** @type {TransitionHooks<State>} */
    defaultHooks: {},

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
     * Run a chain of state modifiers from the callback
     * @param {() => void} callback
     */
    run: (callback) => {
      gouter.tempState = gouter.state;
      gouter.cancelHooks();
      try {
        callback();
        const { tempState } = gouter;
        gouter.tempState = null;
        gouter.setState(tempState);
      } catch (e) {
        gouter.tempState = null;
        throw e;
      }
    },

    /**
     * Find the state by it's name and it's params (if any)
     * Replace first found state in global state if any by next state
     * If found then update state query and/or state stack and then update state parents
     * @param {PartialState} partialState
     */
    goWith: (partialState) => {
      const { state: currentState, tempState, setState } = gouter;
      const prevState = tempState || currentState;
      // iterate over gouter.state and/or gouter.tempState
      // and call replacer on each state until
      for (const subState of prevState.stack) {
        // const nextSubState = replacer(subState);
        if (nextSubState !== subState) {
          // modify and save tempState or state
          // updating only state part and recreating it's parents
          const nextState = prevState; // rebuild parents and add next sub state
          setState(nextState);
          break;
        }
      }
    },

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
          console.warn('state', state);
          const focusedStates = getFocusedStates(nextState);
          for (let index = 0; index < focusedStates.length; index++) {
            const focusedState = focusedStates[index];

            // console.warn(JSON.stringify(focusedState, null, 4));

            const { onGoTo, shouldGoTo, onGoBack, shouldGoBack } =
              hookMap[focusedState.name] || defaultHooks;
            const hasHook = state ? shouldGoTo : shouldGoBack;
            if (hasHook) {
              console.warn(partialStateOrNull, index);
              const parents = focusedStates.slice(index);
              const should = state
                ? shouldGoTo && shouldGoTo(parents, state)
                : shouldGoBack && shouldGoBack(parents);
              if (should) {
                // console.warn(JSON.stringify(focusedStates, null, 4));
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
      console.log(JSON.stringify(nextState, null, 4));
      setState(nextState);

      // return {
      //   goTo,
      //   goBack,
      //   switchTo,
      // };

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
     * @param {Partial<Record<keyof T, Partial<TransitionHooks<State>>>>} hooks
     */
    withHooks: (hooks) => {
      gouter.hookMap = hooks;
    },
  };

  return gouter;
};

module.exports = Gouter;
