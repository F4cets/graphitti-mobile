module.exports = {
  root: true,
  extends: '@react-native',
  parserOptions: {
    requireConfigFile: false,
  },
  rules: {
    "@react-native/no-deep-imports": "off",
    "@typescript-eslint/no-unused-vars": "off"  // Disable temporarily
  },
  ignorePatterns: ["babel.config.js"]
};