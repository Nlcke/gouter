const fs = require('fs');
const path = require('path');

/** @type {(filename: string) => string} */
const normalize = filename => path.normalize(`${__dirname}/${filename}`);

/** @type {(src: string, dest: string, exclude: string[]) => void} */
const copyDir = (src, dest, exclude) => {
  if (exclude.includes(src)) {
    return;
  }
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats && stats.isDirectory();
  if (isDirectory) {
    try {
      fs.mkdirSync(dest);
    } catch (e) {
      if (/** @type {any} */ (e).code !== 'EEXIST') {
        throw e;
      }
    }
    fs.readdirSync(src).forEach(name =>
      copyDir(path.join(src, name), path.join(dest, name), exclude),
    );
  } else {
    fs.copyFileSync(src, dest);
  }
};

copyDir(
  normalize('../../../gouter'),
  normalize('./node_modules/gouter'),
  [
    '../../.git',
    '../../native/example',
    '../../node_modules',
    '../node_modules',
  ].map(normalize),
);
