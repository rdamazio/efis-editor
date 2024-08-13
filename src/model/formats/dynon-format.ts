import { ChecklistFile } from '../../../gen/ts/checklist';
import { TextFormatOptions } from './text-format-options';
import { TextReader } from './text-reader';
import { TextWriter } from './text-writer';

export const DYNON_FORMAT_OPTIONS: TextFormatOptions = {
  fileExtensions: ['.txt', '.afd'],
  indentWidth: 2,
  allUppercase: true,
  checklistTopBlankLine: true,
  outputMetadata: true,

  checklistPrefix: 'CHKLST{{checklistNum}}.TITLE,',
  checklistPrefixMatcher: /^CHKLST(?<checklistNum>\d+)\.TITLE/,
  itemPrefix: 'CHKLST{{checklistNum}}.LINE{{itemNum}},',
  itemPrefixMatcher: /^CHKLST(?<checklistNum>\d+)\.LINE(?<itemNum>\d+)/,
  checklistZeroIndexed: true,
  checklistItemZeroIndexed: false,

  groupNameSeparator: ': ',
  skipFirstGroup: true,
  expectationSeparator: ' - ',
  notePrefix: 'NOTE: ',
  titlePrefixSuffix: '** ',
  warningPrefix: 'WARNING: ',
  cautionPrefix: 'CAUTION: ',
  commentPrefix: '#',
};

export class DynonFormat {
  public static async toProto(file: File): Promise<ChecklistFile> {
    return new TextReader(file, DYNON_FORMAT_OPTIONS).read();
  }

  public static async fromProto(file: ChecklistFile, fileName: string, maxLineLength?: number): Promise<File> {
    const options = Object.assign({}, DYNON_FORMAT_OPTIONS);
    options.maxLineLength = maxLineLength;
    const blob = await new TextWriter(options).write(file);
    return new File([blob], fileName);
  }
}
