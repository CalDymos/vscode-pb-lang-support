import test from "node:test";
import assert from "node:assert/strict";

import { parseFormDocument } from "../src/core/parser/form-parser";

const LEGACY_EVENT_FILE_TEXT = `; Form Designer for PureBasic - 6.30
XIncludeFile "events/form-events.pbi"

Procedure OpenFrmEventsParent(x = 0, y = 0, width = 280, height = 170)
  OpenWindow(#FrmEventsParent, x, y, width, height, "Events Parent")
EndProcedure
`;

test("parses legacy XIncludeFile event-file directives only in isolated parser input", () => {
  const doc = parseFormDocument(LEGACY_EVENT_FILE_TEXT);
  assert.equal(doc.window?.eventFile, "events/form-events.pbi");
});
