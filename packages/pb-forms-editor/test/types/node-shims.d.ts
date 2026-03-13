declare module "node:test" {
  const test: any;
  export = test;
}

declare module "node:assert/strict" {
  const assert: any;
  export = assert;
}

declare module "node:fs" {
  const fs: any;
  export = fs;
}

declare module "node:path" {
  const path: any;
  export = path;
}

declare const process: {
  cwd(): string;
};
