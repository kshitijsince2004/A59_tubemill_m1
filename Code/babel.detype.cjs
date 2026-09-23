/** One-time / conversion-only: erase TypeScript types. Keeps JSX syntax (no React transform). */
module.exports = {
  presets: [
    [
      '@babel/preset-typescript',
      {
        allowDeclareFields: true,
        onlyRemoveTypeImports: true,
        isTSX: true,
        allExtensions: true,
      },
    ],
  ],
  plugins: [
    [
      '@babel/plugin-transform-typescript',
      {
        allowDeclareFields: true,
        onlyRemoveTypeImports: true,
        isTSX: true,
      },
    ],
  ],
  retainLines: true,
};
