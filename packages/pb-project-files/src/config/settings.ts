import * as vscode from "vscode";

export const SETTINGS_SECTION = "purebasicProjectEditor";

export interface ProjectEditorSettings {
  inactiveTabForeground: string;
  xmlTagColor: string;
  xmlAttributeColor: string;
  xmlValueColor: string;
  xmlBracketColor: string;
  xmlCommentColor: string;
  xmlProcInstColor: string;
  /** Absolute path to a .pbp file used as template when creating new projects. */
  newProjectTemplateFile: string;
}

const SETTING_KEYS = {
  inactiveTabForeground:  'inactiveTabForeground',
  xmlTagColor:            'xmlTagColor',
  xmlAttributeColor:      'xmlAttributeColor',
  xmlValueColor:          'xmlValueColor',
  xmlBracketColor:        'xmlBracketColor',
  xmlCommentColor:        'xmlCommentColor',
  xmlProcInstColor:       'xmlProcInstColor',
  newProjectTemplateFile: 'newProject.templateFile',
} as const;

export function readProjectEditorSettings(): ProjectEditorSettings {
  const cfg = vscode.workspace.getConfiguration(SETTINGS_SECTION);
  return {
    inactiveTabForeground:  cfg.get<string>(SETTING_KEYS.inactiveTabForeground,  ''),
    xmlTagColor:            cfg.get<string>(SETTING_KEYS.xmlTagColor,            ''),
    xmlAttributeColor:      cfg.get<string>(SETTING_KEYS.xmlAttributeColor,      ''),
    xmlValueColor:          cfg.get<string>(SETTING_KEYS.xmlValueColor,          ''),
    xmlBracketColor:        cfg.get<string>(SETTING_KEYS.xmlBracketColor,        ''),
    xmlCommentColor:        cfg.get<string>(SETTING_KEYS.xmlCommentColor,        ''),
    xmlProcInstColor:       cfg.get<string>(SETTING_KEYS.xmlProcInstColor,       ''),
    newProjectTemplateFile: cfg.get<string>(SETTING_KEYS.newProjectTemplateFile, ''),
  };
}