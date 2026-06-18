// The Texture base class is imported from a picogl internal module so that
// PicoTexture can extend it and reach its (protected) internals. The deep
// import path has no published types, so it is intentionally declared `any`
// (matching the previous `require()` behaviour).
declare module "picogl/build/module/texture.js";
