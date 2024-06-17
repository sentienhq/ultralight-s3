export { import_ };
export default import_;

// Using @brillout/import instead of direclty using import() avoids TypeScript from transpiling `import()` to `require()`:
// - [GitHub - TypeScript - Add flag to not transpile dynamic import() when module is CommonJS #43329](https://github.com/microsoft/TypeScript/issues/43329)
// - [GitHub - TypeScript - Allow ES Module Type-Only Imports from CJS Modules #49721](https://github.com/microsoft/TypeScript/issues/49721)
// Otherwise, for TypeScript to not transpile `import()` to `require()` for CJS builds, it needs to be configured with `"moduleResolution": "nodenext"`, see https://github.com/microsoft/TypeScript/issues/43329#issuecomment-1079559627

function import_(id) {
  id = fixWindowsBug(id);
  // - Skip webpack from bundling dynamic imports with unknown IDs: https://github.com/webpack/webpack/issues/7644#issuecomment-402123392
  return import(/*webpackIgnore: true*/ id);
}

// Avoid:
// ```
// Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only file and data URLs are supported by the default ESM loader. On Windows, absolute paths must be valid file:// URLs. Received protocol 'd:'
// ```
// See https://stackoverflow.com/questions/69665780/error-err-unsupported-esm-url-scheme-only-file-and-data-urls-are-supported-by/70057245#70057245
const prefix = 'file://';
function fixWindowsBug(id) {
  if (process.platform === 'win32' && isAbsolute(id) && !id.startsWith(prefix)) {
    return prefix + id;
  } else {
    return id;
  }
}

// Copied from https://github.com/unjs/pathe/blob/ae583c899ed9ebf44c94ab451da5fd7c3094dea9/src/path.ts#L14
// Alternative: https://github.com/nodejs/node/blob/49a77a5a996a49e8cb728eed42e55a7c1a9eef6e/lib/path.js#L402
// - Extracted version: https://github.com/brillout/import/commit/6127f900bb769354727115cd7ba433fb04815a1b
function isAbsolute(path) {
  return /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Za-z]:[/\\]/.test(path);
}
