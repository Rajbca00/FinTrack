// Inlined equivalent of the `express-async-errors` package (same technique,
// same ~40 lines) rather than depending on it as a separate npm package.
// That package went missing from the Vercel serverless bundle in production
// ("Cannot find module 'express-async-errors'") even though it installed
// fine locally and in CI - requiring Express's own internal submodules here
// instead carries no such risk, since express itself is already resolving
// correctly (this app has always depended on it).
//
// Patches Layer.prototype.handle so any route/middleware handler that
// returns a rejected Promise gets its error forwarded to next(err) instead
// of becoming an unhandled rejection - which, in a traditional Node process,
// crashes the whole server (this is what taking down the local dev server
// during CSV-import testing, and prompted this fix in the first place).
// Must be imported before any router defines async handlers.
// require() rather than import - these are untyped internal submodules of
// express (not part of its public d.ts), so `any` here is intentional.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Layer = require("express/lib/router/layer");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Router = require("express/lib/router");

const last = (arr: unknown[] = []) => arr[arr.length - 1];
const noop = () => {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function copyFnProps(oldFn: any, newFn: any) {
  Object.keys(oldFn).forEach((key) => {
    newFn[key] = oldFn[key];
  });
  return newFn;
}

function wrap(fn: (...args: unknown[]) => unknown) {
  const newFn = function (this: unknown, ...args: unknown[]) {
    const ret = fn.apply(this, args);
    const next = (args.length === 5 ? args[2] : last(args)) ?? noop;
    if (ret && typeof (ret as Promise<unknown>).catch === "function") {
      (ret as Promise<unknown>).catch((err) => (next as (err: unknown) => void)(err));
    }
    return ret;
  };
  Object.defineProperty(newFn, "length", { value: fn.length, writable: false });
  return copyFnProps(fn, newFn);
}

Object.defineProperty(Layer.prototype, "handle", {
  enumerable: true,
  get(this: { __handle: (...args: unknown[]) => unknown }) {
    return this.__handle;
  },
  set(this: { __handle: (...args: unknown[]) => unknown }, fn: (...args: unknown[]) => unknown) {
    this.__handle = wrap(fn);
  },
});

const originalParam = (Router.prototype.constructor as { param: (name: string, fn: (...args: unknown[]) => unknown) => unknown }).param;
(Router.prototype.constructor as { param: (name: string, fn: (...args: unknown[]) => unknown) => unknown }).param = function (
  this: unknown,
  name: string,
  fn: (...args: unknown[]) => unknown
) {
  return originalParam.call(this, name, wrap(fn));
};
