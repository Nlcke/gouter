/**
 * Map of names to route params.
 * @typedef {Record<any, Record<any, any>>} Config
 */

/**
 * Makes readonly properties writable for their type-safe modification.
 * @template T
 * @typedef {{-readonly [K in keyof T]: T[K]}} Mutable
 */

/**
 * `Listener` callback is called when current state changes.
 * @template {Config} T
 * @template {keyof T} N
 * @typedef {(state: GouterState<T, N>) => void} Listener
 */

/**
 * Tree-like structure with name, params and stack to build complex navigation. Has useful methods
 * to access and control each part.
 * @template {Config} [T=Config]
 * @template {keyof T} [N=keyof T]
 */
export class GouterState {
  /**
   * Creates GouterState using required `name`, `params` and optional `stack`.
   * @param {N} name string to distinguish states
   * @param {T[N]} params collection of parameters to customize states
   * @param {GouterState<T>[]} [stack] optional list of inner states
   */
  constructor(name, params, stack = []) {
    /** string to distinguish states @readonly @type {N} */
    this.name = name;

    /** collection of parameters to customize states @readonly @type {T[N]} */
    this.params = params;

    /** list of inner states @readonly @type {GouterState<T>[]} */
    this.stack = stack;

    /** index of focused child state @readonly @type {number} */
    this.focusedIndex = -1;

    /** unique key mainly for view libraries @readonly @type {number} */
    this.key = GouterState.currentStateKey;

    /** unique serial number for enhanced focus system @private @type {number} */
    this.focusKey = GouterState.currentFocusKey;

    GouterState.currentStateKey += 1;

    GouterState.currentFocusKey += 1;
  }

  /**
   * Parent state when this state in a stack, `undefined` otherwise.
   * @readonly
   * @type {GouterState<T> | undefined}
   */
  get parent() {
    return GouterState.parentByState.get(this);
  }

  /**
   * Set parent state of this state or remove it by passing `undefined`.
   * @private
   * @type {(nextParent: GouterState<T> | undefined) => void}
   */
  set parent(nextParent) {
    if (nextParent) {
      GouterState.parentByState.set(this, nextParent);
    } else {
      GouterState.parentByState.delete(this);
    }
  }

  /**
   * Focused state from this state stack when the stack is not empty, `undefined` otherwise.
   * @readonly
   * @type {GouterState<T> | undefined}
   */
  get focusedChild() {
    return this.stack[this.focusedIndex];
  }

  /**
   * True when this state has parent and this state is it's focused child.
   * @readonly
   * @type {boolean}
   */
  get focused() {
    const { parent } = this;
    return parent ? parent.focusedChild === this : false;
  }

  /**
   * Current listeners of this state.
   * @private
   * @type {Set<Listener<T, N>>}
   * @see {@link listen}
   */
  get listeners() {
    const prevListeners = GouterState.listenersByState.get(this);
    if (prevListeners) {
      return prevListeners;
    }
    const nextListeners = new Set();
    GouterState.listenersByState.set(this, nextListeners);
    return nextListeners;
  }

  /**
   * Set current params.
   * @param {T[N]} params
   */
  setParams(params) {
    /** @type {Mutable<typeof this>} */ (this).params = params;
    GouterState.schedule(this);
    return this;
  }

  /**
   * Merge partial params with current params.
   * @param {Partial<T[N]>} partialParams
   */
  mergeParams(partialParams) {
    const mergedParams = { ...this.params, ...partialParams };
    /** @type {Mutable<typeof this>} */ (this).params = mergedParams;
    GouterState.schedule(this);
    return this;
  }

  /**
   * Set current stack.
   * @param {GouterState<T>[]} stack
   */
  setStack(stack) {
    for (const state of this.stack) {
      state.parent = undefined;
    }
    /** @type {Mutable<typeof this>} */ (this).stack = stack;
    let maxfocusKey = Number.MIN_SAFE_INTEGER;
    let focusedIndex = -1;
    for (let i = 0; i < stack.length; i += 1) {
      const state = stack[i];
      state.parent = this;
      if (state.focusKey >= maxfocusKey) {
        maxfocusKey = state.focusKey;
        focusedIndex = i;
      }
    }
    /** @type {Mutable<typeof this>} */ (this).focusedIndex = focusedIndex;
    GouterState.schedule(this);
    return this;
  }

  /**
   * Focuses parent state on this state.
   * @returns {this}
   */
  focus() {
    const { parent } = this;
    if (parent) {
      const { stack } = parent;
      let focusedIndex = -1;
      for (let i = 0; i < stack.length; i += 1) {
        const state = stack[i];
        const focused = state === this;
        if (focused) {
          focusedIndex = i;
        }
      }
      const prevFocusedIndex = parent.focusedIndex;
      if (focusedIndex !== prevFocusedIndex) {
        /** @type {Mutable<typeof parent>} */ (parent).focusedIndex = focusedIndex;
        const focusedChild = stack[focusedIndex];
        if (focusedChild) {
          GouterState.schedule(focusedChild);
        }
        parent.focus();
      }
    }
    this.focusKey = GouterState.currentFocusKey;
    GouterState.currentFocusKey += 1;
    return this;
  }

  /**
   * Adds new listener of router state changes to listeners and returns `unlisten` callback.
   * @param {Listener<T, N>} listener
   * @returns {() => void} `unlisten` callback
   */
  listen(listener) {
    const { listeners } = this;
    listeners.add(listener);
    const unlisten = () => {
      listeners.delete(listener);
    };
    return unlisten;
  }
}

/**
 * Current state key. Incremented and assigned to each new state as `key`.
 * @type {number}
 */
GouterState.currentStateKey = Number.MIN_SAFE_INTEGER;

/**
 * Current focus key. Incremented and assigned on each new `GouterState` as `key`.
 * @type {number}
 */
GouterState.currentFocusKey = Number.MIN_SAFE_INTEGER;

/**
 * Parents of each state.
 * @type {WeakMap<GouterState, GouterState<any>>}
 */
GouterState.parentByState = new WeakMap();

/**
 * Listeners of each state.
 * @type {WeakMap<GouterState, Set<Listener<any, any>>>}
 */
GouterState.listenersByState = new WeakMap();

/**
 * Collection of modified states controlled by `schedule` and `notify` functions.
 * @type {Set<GouterState>}
 */
GouterState.modifiedStates = new Set();

/**
 * To check if new scheduler promise could be created. When that promise resolves, each modified
 * state listeners will be called.
 * @type {boolean}
 */
GouterState.schedulerReady = true;

/**
 * Notifies every listener of currently modified states about changes. Modified states could be
 * added using {@link GouterState.schedule}.
 * @returns {void}
 * @see {@link GouterState.notify}
 */
GouterState.notify = () => {
  if (GouterState.schedulerReady) {
    return;
  }
  GouterState.schedulerReady = true;
  for (const state of GouterState.modifiedStates) {
    GouterState.modifiedStates.delete(state);
    const listeners = GouterState.listenersByState.get(state);
    if (listeners) {
      for (const listener of listeners) {
        listener(state);
      }
    }
  }
};

/**
 * Adds state to modified states. That states' listeners will be called using {@link GouterState.notify}.
 * @param {GouterState} state
 * @returns
 */
GouterState.schedule = (state) => {
  if (!GouterState.listenersByState.has(state)) {
    return;
  }
  if (GouterState.schedulerReady) {
    GouterState.schedulerReady = false;
    new Promise((resolve) => {
      resolve(undefined);
    }).then(GouterState.notify);
  }
  GouterState.modifiedStates.add(state);
};
