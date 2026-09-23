/**
 * Runtime build for shared/server: ESM-syntax .js → CommonJS dist
 * (matches previous tsc module:commonjs emit; preserves __dirname).
 */
module.exports = {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
  retainLines: true,
  ignore: ['**/*.json', '**/*.xlsx', '**/*.xls', '**/*.csv'],
};
