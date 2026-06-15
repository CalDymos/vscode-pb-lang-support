import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cssHexToPbRgbRaw,
  getWindowColorInspectorDisplay,
  normalizeCssHexColor,
  parseWindowColorInspectorInput,
  pbColorNumberToCssHex,
  WINDOW_COLOR_LITERAL_ERROR_MESSAGE
} from '../src/core/window/color-inspector';
import { parsePbColorLiteral } from '../src/core/parser/pb-color';

test('pbColorNumberToCssHex converts PB color integers to css hex', () => {
  assert.equal(pbColorNumberToCssHex(0x332211), '#112233');
  assert.equal(pbColorNumberToCssHex(0x000000), '#000000');
  assert.equal(pbColorNumberToCssHex(undefined), undefined);
});

test('cssHexToPbRgbRaw converts css hex to PB RGB literal', () => {
  assert.equal(cssHexToPbRgbRaw('#112233'), 'RGB(17,34,51)');
  assert.equal(cssHexToPbRgbRaw('#abcdef'), 'RGB(171,205,239)');
  assert.equal(cssHexToPbRgbRaw('bad'), undefined);
});

test('normalizeCssHexColor accepts only full css hex colors', () => {
  assert.equal(normalizeCssHexColor('#A1B2C3'), '#a1b2c3');
  assert.equal(normalizeCssHexColor('#123'), undefined);
  assert.equal(normalizeCssHexColor(''), undefined);
});

test('parseWindowColorInspectorInput accepts empty, $hex and RGB literals', () => {
  assert.deepEqual(parseWindowColorInspectorInput(''), { ok: true, raw: undefined, previewColor: undefined });
  assert.deepEqual(parseWindowColorInspectorInput(' $112233 '), { ok: true, raw: '$112233', previewColor: 0x112233 });
  assert.deepEqual(parseWindowColorInspectorInput('rgb(17, 34, 51)'), { ok: true, raw: 'RGB(17,34,51)', previewColor: 0x332211 });
});

test('parseWindowColorInspectorInput rejects unsupported raw expressions', () => {
  assert.deepEqual(parseWindowColorInspectorInput('ColorExpr'), { ok: false });
  assert.deepEqual(parseWindowColorInspectorInput('RGB(17,34)'), { ok: false });
  assert.deepEqual(parseWindowColorInspectorInput('RGB(17,34,999)'), { ok: false });
  assert.equal(WINDOW_COLOR_LITERAL_ERROR_MESSAGE, 'Window Color accepts only RGB(r,g,b) or a $hex literal.');
});

test("getWindowColorInspectorDisplay keeps the saved raw value without enabling edits", () => {
  assert.equal(getWindowColorInspectorDisplay(" RGB(1,2,3) "), "RGB(1,2,3)");
  assert.equal(getWindowColorInspectorDisplay(undefined), "");
});


test('parsePbColorLiteral parses $hex and RGB literals via the shared parser path', () => {
  assert.deepEqual(parsePbColorLiteral(' $112233 '), { format: 'hex', raw: '$112233', previewColor: 0x112233 });
  assert.deepEqual(parsePbColorLiteral('RGB(17, 34, 51)'), { format: 'rgb', raw: 'RGB(17, 34, 51)', previewColor: 0x332211, red: 17, green: 34, blue: 51 });
  assert.equal(parsePbColorLiteral('RGB(17,34,999)'), undefined);
});
