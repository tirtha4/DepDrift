/**
 * Manual mock for Node's path module
 */

const path = {
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  basename: jest.fn((path, ext) => {
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];
    if (ext && lastPart.endsWith(ext)) {
      return lastPart.slice(0, -ext.length);
    }
    return lastPart;
  }),
  dirname: jest.fn((path) => {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/');
  }),
  extname: jest.fn((path) => {
    const parts = path.split('.');
    if (parts.length <= 1) {
      return '';
    }
    return '.' + parts[parts.length - 1];
  })
};

module.exports = path; 