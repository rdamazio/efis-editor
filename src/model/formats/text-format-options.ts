export const WRAP_PREFIX = '| ';
export const METADATA_CHECKLIST_TITLE = 'Checklist Info';
export const METADATA_FILE_TITLE = 'Checklist file:';
export const METADATA_MAKE_MODEL_TITLE = 'Make and model:';
export const METADATA_AIRCRAFT_TITLE = 'Aircraft:';
export const METADATA_MANUFACTURER_TITLE = 'Manufacturer:';
export const METADATA_COPYRIGHT_TITLE = 'Copyright:';
export const DEFAULT_FIRST_GROUP = 'Main group';
export const HEADER_COMMENT = '# CHECKLIST EXPORTED FROM https://github.com/rdamazio/efis-editor/';
export const LAST_UPDATED_FOOTER = 'Last updated ';

export interface TextFormatOptions {
  // Extensions that this format can parse.
  fileExtensions: string[];
  // If a line would be wider than this, it will be wrapped.
  maxLineLength?: number;

  indentWidth: number;

  // Whether it's idiomatic to make all content uppercase.
  allUppercase?: boolean;

  // If unset, group names will not be output.
  groupNameSeparator?: string;
  // If true, the first group name will not be output.
  skipFirstGroup?: boolean;

  checklistTopBlankLine?: boolean;

  // Whether to output a fake checklist with checklist metadata.
  outputMetadata?: boolean;

  // For these, {{checklistNum}} and {{itemNum}} will be replaced by sequential counters.
  checklistPrefix: string;
  itemPrefix: string;
  // Extracted groups "checklistNum" and "itemNum" will be used as sequential counters.
  // These default to an exact match of the string version above.
  checklistPrefixMatcher?: RegExp;
  itemPrefixMatcher?: RegExp;

  // Whether checklistNum and/or itemNum start being counted at 0 (vs 1 if false).
  checklistZeroIndexed?: boolean;
  checklistItemZeroIndexed?: boolean;

  expectationSeparator: string;
  notePrefix: string;
  titlePrefixSuffix: string;
  warningPrefix: string;
  cautionPrefix: string;
  commentPrefix?: string;
}
