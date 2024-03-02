/**
 * Map of names to route params.
 * @typedef {Record<any, Record<any, any>>} GouterConfig
 */

/**
 * Makes readonly properties writable for their type-safe modification.
 * @template T
 * @typedef {{-readonly [K in keyof T]: T[K]}} Mutable
 */

/**
 * Called when current state changes.
 * @template {GouterConfig} T
 * @template {keyof T} N
 * @typedef {(state: GouterState<T, N>) => void} GouterListener
 */

/**
 * Tree-like structure with name, params and stack to build complex navigation. Has useful methods
 * to access and control each part.
 * @template {GouterConfig} [T=GouterConfig]
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
    this.stack = GouterState.emptyStack;

    /** index of focused child state @readonly @type {number} */
    this.focusedIndex = -1;

    /** unique key mainly for view libraries @readonly @type {number} */
    this.key = GouterState.currentStateKey;

    /** unique serial number for enhanced focus system @protected @type {number} */
    this.focusKey = Number.MIN_SAFE_INTEGER;

    GouterState.currentStateKey += 1;

    if (stack.length) {
      this.setStack(stack);
    } else {
      this.stack = stack;
    }
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
   * @protected
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
  get isFocused() {
    const { parent } = this;
    return parent ? parent.focusedChild === this : false;
  }

  /**
   * Current listeners of this state.
   * @protected
   * @type {Set<GouterListener<T, N>>}
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
   * Set current `stack` and `focusedIndex` using internal `focusKey` which is assigned on `focus`
   * call. If `focus` is not called on some stack state then last stack state will be focused.
   * @param {GouterState<T>[]} stack
   */
  setStack(stack) {
    const shouldSchedule = this.stack !== GouterState.emptyStack;
    const prevFocusedChild = this.focusedChild;
    for (const state of this.stack) {
      state.parent = undefined;
    }
    /** @type {Mutable<typeof this>} */ (this).stack = stack;
    let maxFocusKey = Number.MIN_SAFE_INTEGER;
    let focusedIndex = -1;
    for (let i = 0; i < stack.length; i += 1) {
      const state = stack[i];
      state.parent = this;
      if (state.focusKey >= maxFocusKey) {
        maxFocusKey = state.focusKey;
        focusedIndex = i;
      }
    }
    /** @type {Mutable<typeof this>} */ (this).focusedIndex = focusedIndex;
    const { focusedChild } = this;
    if (focusedChild && focusedChild !== prevFocusedChild) {
      GouterState.currentFocusKey += 1;
      focusedChild.focusKey = GouterState.currentFocusKey;
    }
    if (shouldSchedule) {
      GouterState.schedule(this);
    }
    return this;
  }

  /**
   * Focuses on this state by changing `focusedIndex` of it's parents. If it has no parents yet then
   * it's internal `focusKey` is set which later will be used in `setStack` to set correct
   * `focusedIndex`.
   * @returns {this}
   */
  focus() {
    const { parent } = this;
    if (parent) {
      const { stack } = parent;
      const focusedIndex = stack.indexOf(this);
      if (parent.focusedIndex !== focusedIndex) {
        /** @type {Mutable<typeof parent>} */ (parent).focusedIndex = focusedIndex;
        GouterState.schedule(parent);
      }
      parent.focus();
    }
    GouterState.currentFocusKey += 1;
    this.focusKey = GouterState.currentFocusKey;
    return this;
  }

  /**
   * Adds new listener of router state changes to listeners and returns `unlisten` callback.
   * @param {GouterListener<T, N>} listener
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

  /**
   * Replaces current state fields including `name`, `params`, `focusedIndex` and `stack`.
   * @template {keyof T} R
   * @param {GouterState<T, R>} state
   * @returns {GouterState<T, R>}
   */
  replace(state) {
    const thisState = /** @type {Mutable<GouterState>} */ (this);
    thisState.name = state.name;
    thisState.params = state.params;
    thisState.focusedIndex = state.focusedIndex;
    this.setStack(state.stack);
    return /** @type {typeof state} */ (/** @type {GouterState} */ (this));
  }

  /**
   * Removes current state from it's parent stack or does nothing if it has no parent.
   * @returns {GouterState<T, N>}
   */
  remove() {
    const { parent } = this;
    if (parent) {
      const index = parent.stack.indexOf(this);
      const nextStack = [...parent.stack];
      nextStack.splice(index, 1);
      parent.setStack(nextStack);
    }
    return this;
  }
}

/**
 * Current state key. Incremented and assigned to each new state as `key`.
 * @type {number}
 */
GouterState.currentStateKey = Number.MIN_SAFE_INTEGER;

/**
 * Current focus key. Incremented and assigned to state `focusKey` on each `focus` call.
 * @type {number}
 */
GouterState.currentFocusKey = Number.MIN_SAFE_INTEGER;

/**
 * Empty stack for state initialization only.
 * @type {GouterState<any>[]}
 */
GouterState.emptyStack = [];

/**
 * Parents of each state.
 * @type {WeakMap<GouterState, GouterState<any>>}
 */
GouterState.parentByState = new WeakMap();

/**
 * Listeners of each state.
 * @type {WeakMap<GouterState, Set<GouterListener<any, any>>>}
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
 * Adds state to modified states. That states' listeners will be called using
 * {@link GouterState.notify}.
 * @param {GouterState} state
 * @returns
 */
GouterState.schedule = (state) => {
  if (GouterState.schedulerReady) {
    GouterState.schedulerReady = false;
    new Promise((resolve) => {
      resolve(undefined);
    }).then(GouterState.notify);
  }
  GouterState.modifiedStates.add(state);
  let { parent } = state;
  while (parent) {
    GouterState.modifiedStates.add(parent);
    parent = parent.parent;
  }
};
