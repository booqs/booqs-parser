module.exports = {
  env: {
    browser: true,
    es6: true
  },
  extends: [
    'standard'
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  plugins: [
    '@typescript-eslint'
  ],
  rules: {
    "space-before-function-paren": "off",
    "indent": "off",
    "semi": ["error", "always"],
    "quotes": ["error", "single"],
    "generator-star-spacing": ["error", "after"],
    "comma-dangle": ["off", "always"],
    "no-unneeded-ternary": "off",
  },
}
