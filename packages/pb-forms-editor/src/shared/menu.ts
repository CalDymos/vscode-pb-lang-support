/** Placement of a moved menu entry relative to its target line. */
export const MenuEntryMovePlacement = {
  Before: "before",
  After: "after",
  AppendChild: "appendChild",
} as const;
export type MenuEntryMovePlacement =
  typeof MenuEntryMovePlacement[keyof typeof MenuEntryMovePlacement];

/** Placement of moved top-level toolbar/statusbar entries. */
export type LinearTopLevelEntryMovePlacement = Extract<
  MenuEntryMovePlacement,
  typeof MenuEntryMovePlacement.Before | typeof MenuEntryMovePlacement.After
>;
