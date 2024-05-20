import { bindMethods } from '../index.js';

/**
 * Provides tools to decode and encode urls.
 * @template {import('../state').GouterConfig} T
 */
export class GouterLinking {
  /**
   * Creates GouterLinking using required `routes` and `create`.
   * @param {import('..').Routes<T>} routes map of names to route configurations
   * @param {import('..').GouterNavigation<T, keyof T>['create']} create tool for new states with stack auto-building
   */
  constructor(routes, create) {
    bindMethods(this);

    /**
     * map of names to route configurations
     * @protected
     * @type {import('..').Routes<T>}
     */
    this.routes = routes;

    /**
     * tool for new states with stack auto-building used in {@link decodeUrl}
     * @protected
     * @type {import('..').GouterNavigation<T, keyof T>['create']}
     */
    this.create = create;

    /**
     * Cache to speed up {@link decodePath}.
     * @protected
     * @type {{[N in keyof T]?: RegExp}}
     */
    this.pathRegexpByName = {};
  }

  /**
   * Safely encodes a text string as a valid component of a Uniform Resource Identifier (URI).
   * @protected
   * @param {string} uriComponent
   * @returns {string}
   */
  safeEncodeURIComponent(uriComponent) {
    return uriComponent.replace(/[/?&=#%]/g, encodeURIComponent);
  }

  /**
   * Creates url path string from state name and params. Uses `=` to escape params which equal to
   * next path key and also to represent empty string.
   * @template {keyof T} N
   * @param {N} name
   * @param {Partial<T[N]>} params
   * @returns {string}
   */
  encodePath(name, params) {
    const paramDefs = this.routes[name].path;
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
            const valueEncoded = this.safeEncodeURIComponent(key);
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
              .map(this.safeEncodeURIComponent)
              .map((item) => item || escapeChar)
              .join('/');
            pathStr += `/${valueEncoded}`;
          }
        } else {
          const valueStr = encode(value);
          const valueEncoded = this.safeEncodeURIComponent(valueStr);
          pathStr += `/${valueEncoded || escapeChar}`;
        }
      } else {
        const valueEncoded = this.safeEncodeURIComponent(paramDef);
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
  }

  /**
   * Creates url query string from state name and params. Uses `/` to represent empty array for
   * params with `list: true`.
   * @template {keyof T} N
   * @param {N} name
   * @param {Partial<T[N]>} params
   * @returns {string}
   */
  encodeQuery(name, params) {
    let queryStr = '';
    const paramDefs = this.routes[name].query;
    if (!paramDefs) {
      return queryStr;
    }
    const listChar = '/';
    for (const key in paramDefs) {
      const paramDef = /** @type {import('..').ParamDef<any>} */ (paramDefs[key]);
      const value = /** @type {any} */ (params)[key];
      if (value !== undefined) {
        const keyEncoded = this.safeEncodeURIComponent(key);
        const { encode = String } = paramDef;
        if (paramDef.list) {
          if (Array.isArray(value)) {
            if (value.length > 0) {
              for (const item of value) {
                const itemStr = encode(item);
                const itemEncoded = this.safeEncodeURIComponent(itemStr);
                queryStr += `&${keyEncoded}${itemEncoded ? '=' : ''}${itemEncoded}`;
              }
            } else {
              queryStr += `&${keyEncoded}=${listChar}`;
            }
          }
        } else {
          const valueStr = encode(value);
          const valueEncoded = this.safeEncodeURIComponent(valueStr);
          queryStr += `&${keyEncoded}${valueEncoded ? '=' : ''}${valueEncoded}`;
        }
      }
    }
    queryStr = queryStr.slice(1);
    return queryStr;
  }

  /**
   * Creates url from state using it's `name` and `params`.
   * @param {import('../state').GouterState<T>} state
   * @returns {string}
   */
  encodeUrl(state) {
    const { name, params } = state;
    const pathStr = this.encodePath(name, params);
    const queryStr = this.encodeQuery(name, params);
    const url = pathStr + (queryStr ? `?${queryStr}` : '');
    return url;
  }

  /**
   * Get path regexp for route name.
   * @protected
   * @param {keyof T} name
   * @returns {RegExp}
   */
  getPathRegexp(name) {
    const paramDefs = this.routes[name].path;
    const pathRegexp = this.pathRegexpByName[name];
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
            const valueEncoded = this.safeEncodeURIComponent(key);
            regexpStr += `/${valueEncoded}${listStr}`;
          } else {
            hasList = true;
            regexpStr += listStr;
          }
        } else {
          regexpStr += paramStr;
        }
      } else {
        const valueEncoded = this.safeEncodeURIComponent(paramDef);
        regexpStr += `/${valueEncoded}`;
        hasList = false;
      }
    }
    const newPathRegexp = RegExp(`^${regexpStr}$`);
    this.pathRegexpByName[name] = newPathRegexp;
    return newPathRegexp;
  }

  /**
   * Creates path parameters from route name and url path string or returns null if no route
   * matched.
   * @template {keyof T} N
   * @param {N} name
   * @param {string} pathStr
   * @returns {Partial<T[N]> | null}
   */
  decodePath(name, pathStr) {
    const paramDefs = this.routes[name].path;
    const regexp = this.getPathRegexp(name);
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
  }

  /**
   * Creates query parameters from route name and url query string.
   * @template {keyof T} N
   * @param {N} name
   * @param {string} queryStr
   * @returns {Partial<T[N]>}
   */
  decodeQuery(name, queryStr) {
    const paramDefs = this.routes[name].query;
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
  }

  /**
   *
   * @type {(url: string) => import('../state').GouterState<T> | null}
   */

  /**
   * Creates state from url or returns null if no route matched.
   * @param {string} url
   * @returns {import('../state').GouterState<T> | null}
   */
  decodeUrl(url) {
    const [, pathStr, queryStr] = /** @type {RegExpMatchArray} */ (
      url.match(/^([^?#]*)\??([^#]*)#?.*$/)
    );
    for (const name in this.routes) {
      const pathParams = this.decodePath(name, pathStr);
      if (pathParams) {
        const queryParams = this.decodeQuery(name, queryStr);
        const params = /** @type {T[typeof name]} */ ({ ...queryParams, ...pathParams });
        const state = this.create(name, params);
        return state;
      }
    }
    return null;
  }
}
