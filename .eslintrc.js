module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12
  },
  rules: {
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
    'semi': ['error', 'always'],
    'no-unused-vars': ['warn', { 
      'argsIgnorePattern': '^_', 
      'varsIgnorePattern': '^_' 
    }],
    'no-console': ['warn', { 
      allow: ['warn', 'error', 'info', 'debug'] 
    }],
    'comma-dangle': ['warn', 'never'],
    'complexity': ['warn', 15],
    'max-len': ['warn', { 
      'code': 100, 
      'ignoreComments': true, 
      'ignoreUrls': true, 
      'ignoreStrings': true,
      'ignoreTemplateLiterals': true
    }],
    'max-depth': ['warn', 4],
    'max-lines-per-function': ['warn', { 
      'max': 150, 
      'skipBlankLines': true, 
      'skipComments': true 
    }],
    'arrow-parens': ['warn', 'as-needed']
  },
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'dist/',
    'test/fixtures/'
  ]
}; 