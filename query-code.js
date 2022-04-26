/** @type {(object: Record<string, any>, parent?: string | undefined) => string} */
const encode = (object, parent) => {
  let queryStr = '';
  for (const key in object) {
    const value = object[key];
    const type = typeof value;
    const isArray = Array.isArray(value);
    const keyEncoded =
      parent !== undefined
        ? `${parent}.${encodeURIComponent(key)}`
        : encodeURIComponent(key);
    if (type === 'string') {
      const valueEncoded = encodeURIComponent(value);
      queryStr += `&${keyEncoded}=${valueEncoded}`;
    } else if (type !== 'object' || value === null) {
      queryStr += `&${keyEncoded}=[${value}]`;
    } else {
      queryStr += `&${keyEncoded}=[${isArray ? '' : type}]`;
      queryStr += encode(value, keyEncoded);
    }
  }
  if (parent === undefined && queryStr) {
    queryStr = '?' + queryStr.slice(1);
  }
  return queryStr;
};

/** @type {(str: string) => Record<string, any>} */
const decode = (str) => {
  const query = {};
  if (str === '' || str === '?') {
    return query;
  }
  const list = (str[0] === '?' ? str.slice(1) : str).split('&');
  for (const e of list) {
    const [fullKey, valueStr] = e.split('=');
    let value = valueStr || '';
    if (
      valueStr !== undefined &&
      valueStr[0] === '[' &&
      valueStr[valueStr.length - 1] === ']'
    ) {
      const type = valueStr.slice(1, -1);
      if (type === '') {
        value = [];
      } else if (type === 'true') {
        value = true;
      } else if (type === 'false') {
        value = false;
      } else if (type === 'null') {
        value = null;
      } else if (type === 'undefined') {
        value = undefined;
      } else if (type === 'object') {
        value = {};
      } else {
        value = parseFloat(type);
      }
    }
    const keys = fullKey.split('.');
    let subQuery = query;
    const maxIndex = keys.length - 1;
    for (let index = 0; index < maxIndex; index++) {
      const key = keys[index];
      subQuery = subQuery[key] || {};
    }
    subQuery[keys[maxIndex]] = value;
  }
  return query;
};
