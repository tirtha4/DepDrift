/**
 * Mock for Node's path module (ESM version)
 */

const join = jest.fn((...args) => args.join('/'));
const resolve = jest.fn((...args) => args.join('/'));
const basename = jest.fn((path, ext) => {
  const parts = path.split('/');
  const lastPart = parts[parts.length - 1];
  if (ext && lastPart.endsWith(ext)) {
    return lastPart.slice(0, -ext.length);
  }
  return lastPart;
});
const dirname = jest.fn((path) => {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
});
const extname = jest.fn((path) => {
  const parts = path.split('.');
  if (parts.length <= 1) {
    return '';
  }
  return '.' + parts[parts.length - 1];
});

const __resetAllMocks = () => {
  join.mockClear();
  resolve.mockClear();
  basename.mockClear();
  dirname.mockClear();
  extname.mockClear();
};

export { join, resolve, basename, dirname, extname, __resetAllMocks };
export default { join, resolve, basename, dirname, extname, __resetAllMocks }; 