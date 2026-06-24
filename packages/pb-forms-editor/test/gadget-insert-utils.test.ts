import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGadgetDrawInsertRect, insertedGadgetHasAmbiguousEmptyTextDefault, shouldInsertGadgetAsPbAny } from '../src/core/gadget/insert';

test('shouldInsertGadgetAsPbAny honours the configured default when provided', () => {
  const mixedIds = [
    { id: '#Button_0', pbAny: false, firstParam: '#Button_0' },
    { id: 'Button_1', pbAny: true, variable: 'Button_1', firstParam: '#PB_Any' }
  ];

  assert.equal(shouldInsertGadgetAsPbAny(mixedIds, true), true);
  assert.equal(shouldInsertGadgetAsPbAny(mixedIds, false), false);
});

test('shouldInsertGadgetAsPbAny keeps the legacy heuristic without an explicit setting', () => {
  assert.equal(
    shouldInsertGadgetAsPbAny([
      { id: 'Button_0', pbAny: true, variable: 'Button_0', firstParam: '#PB_Any' }
    ]),
    true
  );

  assert.equal(
    shouldInsertGadgetAsPbAny([
      { id: '#Button_0', pbAny: false, firstParam: '#Button_0' },
      { id: 'Button_1', pbAny: true, variable: 'Button_1', firstParam: '#PB_Any' }
    ]),
    false
  );
});


test('insertedGadgetHasAmbiguousEmptyTextDefault matches the constructor kinds that start with an empty caption literal', () => {
  assert.equal(insertedGadgetHasAmbiguousEmptyTextDefault('ButtonGadget'), true);
  assert.equal(insertedGadgetHasAmbiguousEmptyTextDefault('DateGadget'), true);
  assert.equal(insertedGadgetHasAmbiguousEmptyTextDefault('WebGadget'), true);
  assert.equal(insertedGadgetHasAmbiguousEmptyTextDefault('ListViewGadget'), false);
  assert.equal(insertedGadgetHasAmbiguousEmptyTextDefault('PanelGadget'), false);
  assert.equal(insertedGadgetHasAmbiguousEmptyTextDefault(undefined), false);
});


test('buildGadgetDrawInsertRect normalizes the original draw-insert coordinates', () => {
  assert.deepEqual(
    buildGadgetDrawInsertRect({ x: 90, y: 55 }, { x: 20, y: 10 }),
    { x: 20, y: 10, w: 70, h: 45 }
  );

  assert.deepEqual(
    buildGadgetDrawInsertRect({ x: 8, y: 12, parentId: '#Container_0', parentItem: 2 }, { x: 58, y: 32, parentId: '#Container_0', parentItem: 2 }),
    { x: 8, y: 12, w: 50, h: 20, parentId: '#Container_0', parentItem: 2 }
  );
});

test('buildGadgetDrawInsertRect rejects clicks and parent-changing drags', () => {
  assert.equal(buildGadgetDrawInsertRect({ x: 10, y: 10 }, { x: 10, y: 25 }), undefined);
  assert.equal(buildGadgetDrawInsertRect({ x: 10, y: 10 }, { x: 25, y: 10 }), undefined);
  assert.equal(
    buildGadgetDrawInsertRect({ x: 10, y: 10, parentId: '#Container_0' }, { x: 30, y: 30, parentId: '#Container_1' }),
    undefined
  );
});
