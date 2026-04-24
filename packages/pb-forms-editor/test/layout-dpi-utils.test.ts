import test from "node:test";
import assert from "node:assert/strict";

import { parseDesignerLayoutRaw, parseUnscaledLayoutRaw } from "../src/core/parser/layout-raw";
import {
  commitDisplayedLayoutPoint,
  commitDisplayedLayoutRect,
  commitDisplayedLayoutValue,
  formatDisplayedLayoutUnscaledValue,
  getDisplayedLayoutValue,
  getLayoutDpiScale,
  getStableDisplayedLayoutValue,
  isLayoutDpiScalingActive,
  unscaleDisplayedLayoutValue,
} from "../src/core/utils/layout-dpi";

test("normalizes the active layout DPI scale from the device pixel ratio", () => {
  assert.equal(getLayoutDpiScale(undefined), 1);
  assert.equal(getLayoutDpiScale(1), 1);
  assert.equal(getLayoutDpiScale(1.3333333333), 1.33);
});

test("detects whether layout DPI scaling is active", () => {
  assert.equal(isLayoutDpiScalingActive(1), false);
  assert.equal(isLayoutDpiScalingActive(1.25), true);
});

test("parses numeric unscaled layout literals and ignores expressions", () => {
  assert.equal(parseUnscaledLayoutRaw("10"), 10);
  assert.equal(parseUnscaledLayoutRaw("  -5  "), -5);
  assert.equal(parseUnscaledLayoutRaw("#PB_Ignore"), undefined);
  assert.equal(parseUnscaledLayoutRaw("WindowWidth(#FrmMain) - 10"), undefined);
});


test("parses original top-level toolbar and statusbar Y expressions into unscaled offsets", () => {
  assert.equal(parseDesignerLayoutRaw("ToolBarHeight(0) + 10", "y"), 10);
  assert.equal(parseDesignerLayoutRaw("ToolBarHeight(#TbMain) + 10", "y"), 10);
  assert.equal(parseDesignerLayoutRaw("StatusBarHeight(0) + 10", "y"), 10);
  assert.equal(parseDesignerLayoutRaw("StatusBarHeight(#SbMain) + 10", "y"), 10);
  assert.equal(parseDesignerLayoutRaw("MenuHeight()+10+20", "y"), 30);
  assert.equal(parseDesignerLayoutRaw("MenuHeight() + 10 + 20", "y"), 30);
  assert.equal(parseDesignerLayoutRaw("FormWindowTop + 5 + 7", "y"), 12);
  assert.equal(parseDesignerLayoutRaw("ToolBarHeight(#TbMain) + 10 + 20", "y"), 30);
  assert.equal(parseDesignerLayoutRaw("StatusBarHeight(#SbMain) + 8 + 4", "y"), 12);
  assert.equal(parseDesignerLayoutRaw("MenuHeight()+10-20", "y"), -10);
  assert.equal(parseDesignerLayoutRaw("MenuHeight()+Foo+20", "y"), undefined);
});

test("parses original top-level width and height reference expressions into their stored base offsets", () => {
  assert.equal(parseDesignerLayoutRaw("WindowWidth(#FrmMain) - 40", "w"), 40);
  assert.equal(parseDesignerLayoutRaw("WindowWidth(#FrmMain) - 310", "x"), 310);
  assert.equal(parseDesignerLayoutRaw("WindowHeight(#FrmMain) - StatusBarHeight(0) - 120", "h"), 120);
  assert.equal(parseDesignerLayoutRaw("ToolBarHeight(0) + WindowHeight(#FrmMain) - 210", "y"), 210);
});



test("parses original parent-relative width and height reference expressions into their stored base offsets", () => {
  assert.equal(parseDesignerLayoutRaw("GadgetWidth(#Container_0) - 30", "x"), 30);
  assert.equal(parseDesignerLayoutRaw("WindowWidth(#WINDOW_Main) - 44", "w"), 44);
  assert.equal(parseDesignerLayoutRaw("GetGadgetAttribute(#Panel_0,#PB_Panel_ItemWidth) - 52", "w"), 52);
  assert.equal(parseDesignerLayoutRaw("GadgetHeight(#Container_0) - 18", "y"), 18);
  assert.equal(parseDesignerLayoutRaw("WindowHeight(#WINDOW_Main) - 90", "h"), 90);
  assert.equal(parseDesignerLayoutRaw("ToolBarHeight(0) + GetGadgetAttribute(#Panel_0,#PB_Panel_ItemHeight) - 118", "y"), 118);
  assert.equal(parseDesignerLayoutRaw("WindowHeight(#FrmMain) - MenuHeight() - ToolBarHeight(0) - StatusBarHeight(0) - 127", "h"), 127);
});

test("maps displayed layout values back to unscaled code values", () => {
  assert.equal(unscaleDisplayedLayoutValue(10, 1.33), 8);
  assert.equal(unscaleDisplayedLayoutValue(11, 1.33), 8);
  assert.equal(unscaleDisplayedLayoutValue(15, 1.33), 11);
});

test("uses a stable lower-bound representative when rebuilding displayed layout values from code", () => {
  assert.equal(getStableDisplayedLayoutValue(8, 1.33), 10);
  assert.equal(getStableDisplayedLayoutValue(11, 1.33), 14);
  assert.equal(getDisplayedLayoutValue("8", 0, 1.33), 10);
});

test("formats readonly unscaled inspector values from the current displayed layout value", () => {
  assert.equal(formatDisplayedLayoutUnscaledValue("8", 10, 1.33), "8");
  assert.equal(formatDisplayedLayoutUnscaledValue("", 10, 1.33), "8");
  assert.equal(formatDisplayedLayoutUnscaledValue("#PB_Ignore", 0, 1.33), "#PB_Ignore");
});


test("commits a displayed layout value into a stable unscaled code literal", () => {
  assert.deepEqual(commitDisplayedLayoutValue(10, 1.33), {
    displayValue: 10,
    unscaledValue: 8,
    raw: "8",
  });
});

test("commits displayed insert points with matching raw code coordinates", () => {
  assert.deepEqual(commitDisplayedLayoutPoint(10, 15, 1.33), {
    x: 10,
    y: 15,
    xUnscaled: 8,
    yUnscaled: 11,
    xRaw: "8",
    yRaw: "11",
  });
});

test("commits displayed drag or resize rectangles with matching raw code coordinates", () => {
  assert.deepEqual(commitDisplayedLayoutRect(10, 15, 100, 40, 1.33), {
    x: 10,
    y: 15,
    w: 100,
    h: 40,
    xUnscaled: 8,
    yUnscaled: 11,
    wUnscaled: 75,
    hUnscaled: 30,
    xRaw: "8",
    yRaw: "11",
    wRaw: "75",
    hRaw: "30",
  });
});
