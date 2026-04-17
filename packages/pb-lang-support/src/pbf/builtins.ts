export interface PbfBuiltin {
  label: string;
  snippet: string;
  signature: string;
  description: string;
  parameters: string[];
}

export const PBF_BUILTINS: PbfBuiltin[] = [

  // ── Window ──────────────────────────────────────────────────────────────
  {
    label: 'OpenWindow',
    snippet: 'OpenWindow(',
    signature: 'OpenWindow(#Window, x, y, InnerWidth, InnerHeight, Title$ [, Flags [, ParentID]])',
    description: 'Opens a new window according to the specified parameters.',
    parameters: ['#Window', 'x', 'y', 'InnerWidth', 'InnerHeight', 'Title$', 'Flags', 'ParentID'],
  },
  {
    label: 'AddWindowTimer',
    snippet: 'AddWindowTimer(',
    signature: 'AddWindowTimer(#Window, Timer, Timeout)',
    description: 'Adds a new timer to the specified window. Generates #PB_Event_Timer events periodically.',
    parameters: ['#Window', 'Timer', 'Timeout'],
  },
  {
    label: 'AddKeyboardShortcut',
    snippet: 'AddKeyboardShortcut(',
    signature: 'AddKeyboardShortcut(#Window, KeyCode, #Shortcut)',
    description: 'Adds a keyboard shortcut to the specified window.',
    parameters: ['#Window', 'KeyCode', '#Shortcut'],
  },

  // ── Menu ────────────────────────────────────────────────────────────────
  {
    label: 'CreateMenu',
    snippet: 'CreateMenu(',
    signature: 'CreateMenu(#Menu, WindowID)',
    description: 'Creates a new empty menu on the given window.',
    parameters: ['#Menu', 'WindowID'],
  },
  {
    label: 'MenuTitle',
    snippet: 'MenuTitle(',
    signature: 'MenuTitle(Title$)',
    description: 'Creates a new title item on the menu.',
    parameters: ['Title$'],
  },
  {
    label: 'MenuItem',
    snippet: 'MenuItem(',
    signature: 'MenuItem(#MenuItem, Text$ [, ImageID])',
    description: 'Creates a new item in the current menu.',
    parameters: ['#MenuItem', 'Text$', 'ImageID'],
  },
  {
    label: 'MenuBar',
    snippet: 'MenuBar()',
    signature: 'MenuBar()',
    description: 'Creates a separator bar in the current menu.',
    parameters: [],
  },

  // ── Toolbar ─────────────────────────────────────────────────────────────
  {
    label: 'CreateToolBar',
    snippet: 'CreateToolBar(',
    signature: 'CreateToolBar(#ToolBar, WindowID [, Flags])',
    description: 'Creates a new empty toolbar on the given window.',
    parameters: ['#ToolBar', 'WindowID', 'Flags'],
  },
  {
    label: 'ToolBarImageButton',
    snippet: 'ToolBarImageButton(',
    signature: 'ToolBarImageButton(#Button, ImageID [, Mode [, Text$]])',
    description: 'Adds an image button to the toolbar being constructed.',
    parameters: ['#Button', 'ImageID', 'Mode', 'Text$'],
  },
  {
    label: 'ToolBarSeparator',
    snippet: 'ToolBarSeparator()',
    signature: 'ToolBarSeparator()',
    description: 'Adds a separator to the toolbar being constructed.',
    parameters: [],
  },

  // ── StatusBar ───────────────────────────────────────────────────────────
  {
    label: 'CreateStatusBar',
    snippet: 'CreateStatusBar(',
    signature: 'CreateStatusBar(#StatusBar, WindowID)',
    description: 'Creates and adds an empty status bar to the specified window.',
    parameters: ['#StatusBar', 'WindowID'],
  },
  {
    label: 'AddStatusBarField',
    snippet: 'AddStatusBarField(',
    signature: 'AddStatusBarField(Width)',
    description: 'Adds a new field to the status bar currently being constructed.',
    parameters: ['Width'],
  },

  // ── Gadgets ─────────────────────────────────────────────────────────────
  {
    label: 'ButtonGadget',
    snippet: 'ButtonGadget(',
    signature: 'ButtonGadget(#Gadget, x, y, Width, Height, Text$ [, Flags])',
    description: 'Creates a button gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Text$', 'Flags'],
  },
  {
    label: 'ButtonImageGadget',
    snippet: 'ButtonImageGadget(',
    signature: 'ButtonImageGadget(#Gadget, x, y, Width, Height, ImageID [, Flags])',
    description: 'Creates an image button gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'ImageID', 'Flags'],
  },
  {
    label: 'CalendarGadget',
    snippet: 'CalendarGadget(',
    signature: 'CalendarGadget(#Gadget, x, y, Width, Height [, Flags])',
    description: 'Creates a calendar gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Flags'],
  },
  {
    label: 'CanvasGadget',
    snippet: 'CanvasGadget(',
    signature: 'CanvasGadget(#Gadget, x, y, Width, Height [, Flags])',
    description: 'Creates a canvas gadget for custom 2D drawing in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Flags'],
  },
  {
    label: 'CheckBoxGadget',
    snippet: 'CheckBoxGadget(',
    signature: 'CheckBoxGadget(#Gadget, x, y, Width, Height, Text$ [, Flags])',
    description: 'Creates a checkbox gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Text$', 'Flags'],
  },
  {
    label: 'ComboBoxGadget',
    snippet: 'ComboBoxGadget(',
    signature: 'ComboBoxGadget(#Gadget, x, y, Width, Height [, Flags])',
    description: 'Creates a combo box gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Flags'],
  },
  {
    label: 'ContainerGadget',
    snippet: 'ContainerGadget(',
    signature: 'ContainerGadget(#Gadget, x, y, Width, Height [, Flags])',
    description: 'Creates a container gadget to group other gadgets.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Flags'],
  },
  {
    label: 'DateGadget',
    snippet: 'DateGadget(',
    signature: 'DateGadget(#Gadget, x, y, Width, Height [, Mask$ [, Flags]])',
    description: 'Creates a date/time picker gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Mask$', 'Flags'],
  },
  {
    label: 'EditorGadget',
    snippet: 'EditorGadget(',
    signature: 'EditorGadget(#Gadget, x, y, Width, Height [, Flags])',
    description: 'Creates a multi-line text editor gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Flags'],
  },
  {
    label: 'ExplorerComboGadget',
    snippet: 'ExplorerComboGadget(',
    signature: 'ExplorerComboGadget(#Gadget, x, y, Width, Height, Directory$ [, Flags])',
    description: 'Creates an explorer combo gadget for directory browsing.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Directory$', 'Flags'],
  },
  {
    label: 'ExplorerListGadget',
    snippet: 'ExplorerListGadget(',
    signature: 'ExplorerListGadget(#Gadget, x, y, Width, Height, Directory$ [, Flags])',
    description: 'Creates an explorer list gadget showing directory contents.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Directory$', 'Flags'],
  },
  {
    label: 'ExplorerTreeGadget',
    snippet: 'ExplorerTreeGadget(',
    signature: 'ExplorerTreeGadget(#Gadget, x, y, Width, Height, Directory$ [, Flags])',
    description: 'Creates an explorer tree gadget for directory navigation.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Directory$', 'Flags'],
  },
  {
    label: 'FrameGadget',
    snippet: 'FrameGadget(',
    signature: 'FrameGadget(#Gadget, x, y, Width, Height, Text$ [, Flags])',
    description: 'Creates a frame/groupbox gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Text$', 'Flags'],
  },
  {
    label: 'HyperLinkGadget',
    snippet: 'HyperLinkGadget(',
    signature: 'HyperLinkGadget(#Gadget, x, y, Width, Height, Text$, Color [, Flags])',
    description: 'Creates a hyperlink gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Text$', 'Color', 'Flags'],
  },
  {
    label: 'IPAddressGadget',
    snippet: 'IPAddressGadget(',
    signature: 'IPAddressGadget(#Gadget, x, y, Width, Height)',
    description: 'Creates an IP address input gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height'],
  },
  {
    label: 'ImageGadget',
    snippet: 'ImageGadget(',
    signature: 'ImageGadget(#Gadget, x, y, Width, Height, ImageID [, Flags])',
    description: 'Creates an image display gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'ImageID', 'Flags'],
  },
  {
    label: 'ListIconGadget',
    snippet: 'ListIconGadget(',
    signature: 'ListIconGadget(#Gadget, x, y, Width, Height, FirstColumnTitle$, FirstColumnWidth [, Flags])',
    description: 'Creates a multi-column list gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'FirstColumnTitle$', 'FirstColumnWidth', 'Flags'],
  },
  {
    label: 'ListViewGadget',
    snippet: 'ListViewGadget(',
    signature: 'ListViewGadget(#Gadget, x, y, Width, Height [, Flags])',
    description: 'Creates a single-column list gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Flags'],
  },
  {
    label: 'OpenGLGadget',
    snippet: 'OpenGLGadget(',
    signature: 'OpenGLGadget(#Gadget, x, y, Width, Height [, Flags])',
    description: 'Creates an OpenGL rendering gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Flags'],
  },
  {
    label: 'OptionGadget',
    snippet: 'OptionGadget(',
    signature: 'OptionGadget(#Gadget, x, y, Width, Height, Text$)',
    description: 'Creates a radio button gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Text$'],
  },
  {
    label: 'PanelGadget',
    snippet: 'PanelGadget(',
    signature: 'PanelGadget(#Gadget, x, y, Width, Height)',
    description: 'Creates a tab panel gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height'],
  },
  {
    label: 'ProgressBarGadget',
    snippet: 'ProgressBarGadget(',
    signature: 'ProgressBarGadget(#Gadget, x, y, Width, Height, Minimum, Maximum [, Flags])',
    description: 'Creates a progress bar gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Minimum', 'Maximum', 'Flags'],
  },
  {
    label: 'ScintillaGadget',
    snippet: 'ScintillaGadget(',
    signature: 'ScintillaGadget(#Gadget, x, y, Width, Height, Callback)',
    description: 'Creates a Scintilla editor gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Callback'],
  },
  {
    label: 'ScrollAreaGadget',
    snippet: 'ScrollAreaGadget(',
    signature: 'ScrollAreaGadget(#Gadget, x, y, Width, Height, ScrollAreaWidth, ScrollAreaHeight [, Step [, Flags]])',
    description: 'Creates a scrollable area gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'ScrollAreaWidth', 'ScrollAreaHeight', 'Step', 'Flags'],
  },
  {
    label: 'ScrollBarGadget',
    snippet: 'ScrollBarGadget(',
    signature: 'ScrollBarGadget(#Gadget, x, y, Width, Height, Minimum, Maximum, PageLength [, Flags])',
    description: 'Creates a scrollbar gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Minimum', 'Maximum', 'PageLength', 'Flags'],
  },
  {
    label: 'SpinGadget',
    snippet: 'SpinGadget(',
    signature: 'SpinGadget(#Gadget, x, y, Width, Height, Minimum, Maximum [, Flags])',
    description: 'Creates a spin (numeric up/down) gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Minimum', 'Maximum', 'Flags'],
  },
  {
    label: 'SplitterGadget',
    snippet: 'SplitterGadget(',
    signature: 'SplitterGadget(#Gadget, x, y, Width, Height, #Gadget1, #Gadget2 [, Flags])',
    description: 'Creates a splitter gadget allowing two child gadgets to be resized by the user.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', '#Gadget1', '#Gadget2', 'Flags'],
  },
  {
    label: 'StringGadget',
    snippet: 'StringGadget(',
    signature: 'StringGadget(#Gadget, x, y, Width, Height, Text$ [, Flags])',
    description: 'Creates a single-line text input gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Text$', 'Flags'],
  },
  {
    label: 'TextGadget',
    snippet: 'TextGadget(',
    signature: 'TextGadget(#Gadget, x, y, Width, Height, Text$ [, Flags])',
    description: 'Creates a static text display gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Text$', 'Flags'],
  },
  {
    label: 'TrackBarGadget',
    snippet: 'TrackBarGadget(',
    signature: 'TrackBarGadget(#Gadget, x, y, Width, Height, Minimum, Maximum [, Flags])',
    description: 'Creates a trackbar (slider) gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Minimum', 'Maximum', 'Flags'],
  },
  {
    label: 'TreeGadget',
    snippet: 'TreeGadget(',
    signature: 'TreeGadget(#Gadget, x, y, Width, Height [, Flags])',
    description: 'Creates a tree view gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'Flags'],
  },
  {
    label: 'WebGadget',
    snippet: 'WebGadget(',
    signature: 'WebGadget(#Gadget, x, y, Width, Height, URL$)',
    description: 'Creates a web browser gadget in the current GadgetList.',
    parameters: ['#Gadget', 'x', 'y', 'Width', 'Height', 'URL$'],
  },
];

// Lookup-Map for O(1)-access in Hover- and other providers
export const PBF_BUILTINS_MAP = new Map<string, PbfBuiltin>(
  PBF_BUILTINS.map(b => [b.label, b])
);