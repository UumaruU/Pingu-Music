declare module "node:test" {
  type TestFunction = (name: string, fn: () => void | Promise<void>) => void;
  const test: TestFunction;
  export default test;
}

declare module "node:assert/strict" {
  interface AssertModule {
    ok(value: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    match(value: string, regexp: RegExp, message?: string): void;
  }

  const assert: AssertModule;
  export default assert;
}
