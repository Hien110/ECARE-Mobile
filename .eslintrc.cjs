module.exports = {
  root: true,
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: true, // vì bây giờ đã có babel.config.js
    babelOptions: {
      // không cần configFile path nếu babel.config.js ở root
      presets: ['module:metro-react-native-babel-preset'],
    },
  },
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended', 'plugin:react/recommended'],
  plugins: ['react'],
  rules: {},
  settings: {
    react: { version: 'detect' },
  },
};
