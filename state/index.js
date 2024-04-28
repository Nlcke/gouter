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
   * @param {number} [focusedIndex] optional index of focused state in stack
   */
  constructor(name, params, stack, focusedIndex) {
    /** @readonly @type {N} string to distinguish states */
    this.name = name;

    /** @readonly @type {T[N]} collection of parameters to customize states */
    this.params = params;

    /** @readonly @type {number} index of focused child state */
    this.focusedIndex = -1;

    /** @readonly @type {GouterState<T>[]} list of inner states */
    this.stack = GouterState.emptyStack;

    if (focusedIndex !== undefined) {
      const focusedState = stack && stack[focusedIndex];
      if (focusedState) {
        focusedState.withFocus();
      }
    }

    if (stack && stack.length) {
      this.setStack(stack);
    } else {
      this.stack = /** @type {GouterState<T>[]} */ ([]);
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
   * Sets parent state of this state or removes it if `undefined` passed.
   * @protected
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
   * True when this state has a parent and it's `focusedIndex` points to this state.
   * @readonly
   * @type {boolean}
   */
  get isFocused() {
    const { parent } = this;
    return parent ? parent.focusedChild === this : GouterState.rootStates.has(this);
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
   * Sets current params.
   * @param {T[N]} params
   * @returns {this}
   */
  setParams(params) {
    /** @type {Mutable<typeof this>} */ (this).params = params;
    GouterState.schedule(this);
    return this;
  }

  /**
   * Merges partial params into current params.
   * @param {Partial<T[N]>} partialParams
   * @returns {this}
   */
  mergeParams(partialParams) {
    const mergedParams = { ...this.params, ...partialParams };
    /** @type {Mutable<typeof this>} */ (this).params = mergedParams;
    GouterState.schedule(this);
    return this;
  }

  /**
   * Replaces current `stack`. It also resets current `focusedIndex` to last stack state index so if
   * you need to preserve or modify that index you should call {@link focus} on some stack state
   * before this operation. If some state in new stack already has parent then it will be cloned using {@link clone}.
   * @param {GouterState<T>[]} stack
   * @returns {this}
   */
  setStack(stack) {
    const shouldSchedule = this.stack !== GouterState.emptyStack;
    for (const state of this.stack) {
      state.parent = undefined;
    }
    /** @type {Mutable<typeof this>} */ (this).stack = stack;
    let focusedIndex = stack.length - 1;
    const { parentByState, focusingStates } = GouterState;
    for (let index = 0; index < stack.length; index += 1) {
      const state = stack[index];
      if (focusingStates.has(state)) {
        focusingStates.delete(state);
        focusedIndex = index;
      }
      if (parentByState.has(state)) {
        if (this.stack === stack) {
          /** @type {Mutable<typeof this>} */ (this).stack = stack.slice();
        }
        const clonedState = state.clone();
        clonedState.parent = this;
        this.stack[index] = clonedState;
      } else {
        state.parent = this;
      }
    }
    /** @type {Mutable<typeof this>} */ (this).focusedIndex = focusedIndex;
    if (shouldSchedule) {
      GouterState.schedule(this);
    }
    return this;
  }

  /**
   * Focuses on stack state with provided `focusedIndex`. If that index is same as before or stack
   * state is not found then nothing happens.
   * @param {number} focusedIndex
   * @returns {this}
   */
  setFocusedIndex(focusedIndex) {
    if (focusedIndex !== this.focusedIndex && this.stack[focusedIndex]) {
      /** @type {Mutable<typeof this>} */ (this).focusedIndex = focusedIndex;
      GouterState.schedule(this);
    }
    return this;
  }

  /**
   * Adds this state to special set of focusing states. During parent {@link setStack} call it will be
   * automatically focused only once and then removed from focusing states. If two or more focusing
   * states occur in same stack then last one will be focused.
   * @returns {this}
   */
  withFocus() {
    GouterState.focusingStates.add(this);
    return this;
  }

  /**
   * Focuses on this state by recursively changing `focusedIndex` of it's parents. If it has no
   * parent or parent `focusedIndex` is same then nothing happens.
   * @returns {this}
   */
  focus() {
    const { parent } = this;
    if (!parent) {
      return this;
    }
    const focusedIndex = parent.stack.indexOf(this);
    if (parent.focusedIndex !== focusedIndex) {
      /** @type {Mutable<typeof parent>} */ (parent).focusedIndex = focusedIndex;
      GouterState.schedule(parent);
      parent.focus();
    }
    return this;
  }

  /**
   * Adds this listener of router state changes to set of listeners and returns `unlisten` callback.
   * Every listener will be called on each update of `params`, `stack` and/or `focusedIndex`.
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
   * Replaces current state fields including `name`, `params`, `stack` and `focusedIndex`.
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
   * Deeply clones this state without listeners. Automatically called when some state with parent
   * put into another stack during {@link setStack} call.
   * @returns {GouterState<T, N>}
   */
  clone() {
    const clonedState = new GouterState(
      this.name,
      this.params,
      this.stack.map((stackState) => stackState.clone()),
      this.focusedIndex,
    );
    return clonedState;
  }

  /**
   * Removes current state from it's parent stack or does nothing if it has no parent.
   * @returns {this}
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
 * Empty stack for internal state initialization only.
 * @type {GouterState<any>[]}
 */
GouterState.emptyStack = [];

/**
 * Set of states which will be focused when put into a stack.
 * @type {WeakSet<GouterState>}
 */
GouterState.focusingStates = new WeakSet();

/**
 * Set of special states which are focused when they have no parent.
 * @type {WeakSet<GouterState<any>>}
 */
GouterState.rootStates = new WeakSet();

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
 * @returns {void}
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
