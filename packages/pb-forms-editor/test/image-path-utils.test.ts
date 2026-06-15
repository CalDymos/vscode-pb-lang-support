import test from "node:test";
import assert from "node:assert/strict";
import { relativizeImagePath, toPbFilePathLiteral } from "../src/core/image/path";
import { isPbStringLiteral, parsePbStringLiteral, toPbStringLiteral } from "../src/core/parser/pb-string";

test("parsePbStringLiteral supports doubled quotes", () => {
  assert.equal(parsePbStringLiteral('"icons/""open"".png"'), 'icons/"open".png');
});

test("parsePbStringLiteral rejects concatenations that only start and end with quotes", () => {
  assert.equal(parsePbStringLiteral('"Open" + suffix$ + "X"'), undefined);
});

test("isPbStringLiteral rejects non-string expressions", () => {
  assert.equal(isPbStringLiteral('ImageID(#ImgOpen)'), false);
  assert.equal(isPbStringLiteral('?ImgData'), false);
});

test("relativizeImagePath converts absolute POSIX paths to normalized relative paths", () => {
  const raw = toPbStringLiteral('/workspace/project/assets/icons/open.png');
  const relativeRaw = relativizeImagePath('/workspace/project/forms/main.pbf', raw);
  assert.equal(relativeRaw, '"../assets/icons/open.png"');
});

test("relativizeImagePath converts absolute Windows paths to normalized relative paths", () => {
  const raw = toPbStringLiteral('C:\\workspace\\project\\assets\\icons\\open.png');
  const relativeRaw = relativizeImagePath('C:\\workspace\\project\\forms\\main.pbf', raw);
  assert.equal(relativeRaw, '"../assets/icons/open.png"');
});

test("relativizeImagePath normalizes existing relative paths against the form file", () => {
  const relativeRaw = relativizeImagePath('/workspace/project/forms/main.pbf', '"./icons/open.png"');
  assert.equal(relativeRaw, '"icons/open.png"');
});

test("relativizeImagePath returns undefined for non-string image expressions", () => {
  assert.equal(relativizeImagePath('/workspace/project/forms/main.pbf', '?ImgData'), undefined);
  assert.equal(relativizeImagePath('/workspace/project/forms/main.pbf', 'ImageID(#ImgOpen)'), undefined);
});


test("toPbFilePathLiteral normalizes backslashes for file dialog paths", () => {
  assert.equal(toPbFilePathLiteral(String.raw`C:\workspace\project\images\logo.png`), '"C:/workspace/project/images/logo.png"');
});

test("toPbFilePathLiteral escapes embedded quotes", () => {
  assert.equal(toPbFilePathLiteral('/workspace/project/images/quote"logo.png'), '"/workspace/project/images/quote""logo.png"');
});
