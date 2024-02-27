/**
 * Main tools to decode and encode urls.
 * @template {import('..').Config} T
 * @typedef {Object} Linking
 * @prop {<N extends keyof T>(name: N, params: Partial<T[N]>) => string} encodePath Creates url path
 * string from state name and params. Uses `=` to escape params which equal to next path key and
 * also to represent empty string.
 * @prop {<N extends keyof T>(name: N, params: Partial<T[N]>) => string} encodeQuery Creates url
 * query string from state name and params. Uses `/` to represent empty array for params with `list:
 * true`.
 * @prop {(state: import('../state').GouterState<T>) => string} encodeUrl Creates url from state
 * using it's name and params.
 * @prop {<N extends keyof T>(name: N, pathStr: string) => Partial<T[N]> | null} decodePath Get
 * required state params from path or null if path is not matched.
 * @prop {<N extends keyof T>(name: N, queryStr: string) => Partial<T[N]>} decodeQuery Creates query
 * parameters from route name and url query string.
 * @prop {(url: string) => import('../state').GouterState<T> | null} decodeUrl Creates router state
 * from url or returns null if no route found.
 */

/**
 * Provides main tools to decode and encode urls.
 * @template {import('..').Config} T
 * @param {import('..').Routes<T>} routes
 * @param {import('..').CreateGouterState<T>} create
 * @returns {Linking<T>}
 */
export const getLinking = (routes, create) => {
  /**
   * Safely encodes a text string as a valid component of a Uniform Resource Identifier (URI).
   * @type {(uriComponent: string) => string}
   */
  const safeEncodeURIComponent = (uriComponent) => {
    return uriComponent.replace(/[/?&=#%]/g, encodeURIComponent);
  };

  /**
   * Cache to speed up `decodePath`.
   * @type {{[N in keyof T]?: RegExp}}
   */
  const pathRegexpByName = {};

  /** @type {<N extends keyof T>(name: N, params: Partial<T[N]>) => string} */
  const encodePath = (name, params) => {
    const paramDefs = routes[name].path;
    let pathStr = '';
    let hasList = false;
    let sectionPos = 0;
    const escapeChar = '=';
    for (const key in paramDefs) {
      const paramDef = /** @type {import('..').ParamDef<any> | string} */ (
        paramDefs[/** @type {any} */ (key)]
      );
      if (typeof paramDef === 'object') {
        const { encode = String } = paramDef;
        const value = /** @type {any} */ (params)[key];
        if (paramDef.list) {
          if (hasList) {
            const valueEncoded = safeEncodeURIComponent(key);
            if (`/${pathStr.slice(sectionPos)}/`.includes(`/${valueEncoded}/`)) {
              const head = pathStr.slice(0, sectionPos);
              const section = pathStr
                .slice(sectionPos + 1)
                .split('/')
                .map((item) =>
                  item === valueEncoded ? `${escapeChar}${valueEncoded}` : item || escapeChar,
                )
                .join('/');
              pathStr = `${head}/${section}`;
            }
            pathStr += `/${valueEncoded}`;
            hasList = false;
            sectionPos = pathStr.length;
          } else {
            hasList = true;
          }
          if (Array.isArray(value) && value.length > 0) {
            const valueEncoded = value
              .map(encode)
              .map(safeEncodeURIComponent)
              .map((item) => item || escapeChar)
              .join('/');
            pathStr += `/${valueEncoded}`;
          }
        } else {
          const valueStr = encode(value);
          const valueEncoded = safeEncodeURIComponent(valueStr);
          pathStr += `/${valueEncoded || escapeChar}`;
        }
      } else {
        const valueEncoded = safeEncodeURIComponent(paramDef);
        if (`/${pathStr.slice(sectionPos)}/`.includes(`/${valueEncoded}/`)) {
          const head = pathStr.slice(0, sectionPos);
          const section = pathStr
            .slice(sectionPos + 1)
            .split('/')
            .map((item) =>
              item === valueEncoded ? `${escapeChar}${valueEncoded}` : item || escapeChar,
            )
            .join('/');
          pathStr = `${head}/${section}`;
        }
        pathStr += `/${valueEncoded}`;
        hasList = false;
        sectionPos = pathStr.length;
      }
    }
    return pathStr;
  };

  /** @type {<N extends keyof T>(name: N, params: Partial<T[N]>) => string} */
  const encodeQuery = (name, params) => {
    let queryStr = '';
    const paramDefs = routes[name].query;
    if (!paramDefs) {
      return queryStr;
    }
    const listChar = '/';
    for (const key in paramDefs) {
      const paramDef = /** @type {import('..').ParamDef<any>} */ (paramDefs[key]);
      const value = /** @type {any} */ (params)[key];
      if (value !== undefined) {
        const keyEncoded = safeEncodeURIComponent(key);
        const { encode = String } = paramDef;
        if (paramDef.list) {
          if (Array.isArray(value)) {
            if (value.length > 0) {
              for (const item of value) {
                const itemStr = encode(item);
                const itemEncoded = safeEncodeURIComponent(itemStr);
                queryStr += `&${keyEncoded}${itemEncoded ? '=' : ''}${itemEncoded}`;
              }
            } else {
              queryStr += `&${keyEncoded}=${listChar}`;
            }
          }
        } else {
          const valueStr = encode(value);
          const valueEncoded = safeEncodeURIComponent(valueStr);
          queryStr += `&${keyEncoded}${valueEncoded ? '=' : ''}${valueEncoded}`;
        }
      }
    }
    queryStr = queryStr.slice(1);
    return queryStr;
  };

  /**
   * Create url from state name and params.
   * @type {(state: import('../state').GouterState<T>) => string}
   */
  const encodeUrl = (state) => {
    const { name, params } = state;
    const pathStr = encodePath(name, params);
    const queryStr = encodeQuery(name, params);
    const url = pathStr + (queryStr ? `?${queryStr}` : '');
    return url;
  };

  /** @type {(name: keyof T) => RegExp} */
  const getPathRegexp = (name) => {
    const paramDefs = routes[name].path;
    const pathRegexp = pathRegexpByName[name];
    if (pathRegexp) {
      return pathRegexp;
    }
    const paramStr = '/([^/]*)';
    const listStr = '(.*)';
    let regexpStr = '';
    let hasList = false;
    for (const key in paramDefs) {
      const paramDef = /** @type {import('..').ParamDef<any> | string} */ (
        paramDefs[/** @type {any} */ (key)]
      );
      if (typeof paramDef === 'object') {
        if (paramDef.list) {
          if (hasList) {
            const valueEncoded = safeEncodeURIComponent(key);
            regexpStr += `/${valueEncoded}${listStr}`;
          } else {
            hasList = true;
            regexpStr += listStr;
          }
        } else {
          regexpStr += paramStr;
        }
      } else {
        const valueEncoded = safeEncodeURIComponent(paramDef);
        regexpStr += `/${valueEncoded}`;
        hasList = false;
      }
    }
    const newPathRegexp = RegExp(`^${regexpStr}$`);
    pathRegexpByName[name] = newPathRegexp;
    return newPathRegexp;
  };

  /** @type {<N extends keyof T>(name: N, pathStr: string) => Partial<T[N]> | null} */
  const decodePath = (name, pathStr) => {
    const paramDefs = routes[name].path;
    const regexp = getPathRegexp(name);
    const groups = pathStr.match(regexp);
    if (!groups) {
      return null;
    }
    const escapeChar = '=';
    const params = /** @type {any} */ ({});
    let groupIndex = 0;
    for (const key in paramDefs) {
      const paramDef = /** @type {import('..').ParamDef<any> | string} */ (
        paramDefs[/** @type {any} */ (key)]
      );
      if (typeof paramDef === 'object') {
        groupIndex += 1;
        const group = groups[groupIndex];
        const { decode = String } = paramDef;
        if (paramDef.list) {
          params[key] = [];
          if (group) {
            for (const valueStr of group.slice(1).split('/')) {
              const valueStrUnescaped = valueStr[0] === escapeChar ? valueStr.slice(1) : valueStr;
              try {
                const valueEncoded = decodeURIComponent(valueStrUnescaped);
                const value = decode(valueEncoded);
                params[key].push(value);
              } catch (e) {
                return null;
              }
            }
          }
        } else {
          const valueStr = group;
          const valueStrUnescaped = valueStr[0] === escapeChar ? valueStr.slice(1) : valueStr;
          try {
            const valueEncoded = decodeURIComponent(valueStrUnescaped);
            const value = decode(valueEncoded);
            params[key] = value;
          } catch (e) {
            return null;
          }
        }
      }
    }
    return params;
  };

  /** @type {<N extends keyof T>(name: N, queryStr: string) => Partial<T[N]>} */
  const decodeQuery = (name, queryStr) => {
    const paramDefs = routes[name].query;
    const params = /** @type {any} */ ({});
    if (!paramDefs) {
      return params;
    }
    for (const keyValueStr of queryStr.split('&')) {
      const splitIndex = keyValueStr.indexOf('=');
      const keyEncoded = keyValueStr.slice(0, splitIndex === -1 ? undefined : splitIndex);
      try {
        const key = decodeURIComponent(keyEncoded);
        const paramDef = /** @type {import('..').ParamDef<any>} */ (
          paramDefs[/** @type {keyof typeof paramDefs} */ (key)]
        );
        const { decode } = paramDef;
        const valueStr = splitIndex === -1 ? '' : keyValueStr.slice(splitIndex + 1);
        const valueEncoded = decodeURIComponent(valueStr);
        const value = decode ? decode(valueEncoded) : valueEncoded;
        if (paramDef.list) {
          if (valueStr === '/') {
            params[key] = params[key] || [];
          } else if (params[key]) {
            params[key].push(value);
          } else {
            params[key] = [value];
          }
        } else {
          params[key] = value;
        }
      } catch (e) {
        /* empty */
      }
    }
    return params;
  };

  /**
   * Creates router state from url or returns null if no route found.
   * @type {(url: string) => import('../state').GouterState<T> | null}
   */
  const decodeUrl = (url) => {
    const [, pathStr, queryStr] = /** @type {RegExpMatchArray} */ (
      url.match(/^([^?#]*)\??([^#]*)#?.*$/)
    );
    for (const name in routes) {
      const pathParams = decodePath(name, pathStr);
      if (pathParams) {
        const queryParams = decodeQuery(name, queryStr);
        const params = /** @type {any} */ ({ ...queryParams, ...pathParams });
        const state = create(name, params);
        return state;
      }
    }
    return null;
  };

  return {
    decodePath,
    decodeQuery,
    decodeUrl,
    encodePath,
    encodeQuery,
    encodeUrl,
  };
};
