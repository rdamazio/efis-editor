import { ChecklistFile } from '../../../gen/ts/checklist';
import { TextFormatOptions } from './text-format-options';
import { TextReader } from './text-reader';
import { TextWriter } from './text-writer';

export const GRT_FORMAT_OPTIONS: TextFormatOptions = {
  fileExtensions: ['.txt'],
  indentWidth: 2,

  checklistPrefix: 'LIST',
  itemPrefix: 'ITEM',

  groupNameSeparator: ': ',
  skipFirstGroup: true,
  expectationSeparator: ' - ',
  notePrefix: 'NOTE: ',
  titlePrefixSuffix: '** ',
  warningPrefix: 'WARNING: ',
  cautionPrefix: 'CAUTION: ',
  commentPrefix: '#',

  outputMetadata: true,
};

export class GrtFormat {
  public static async toProto(file: File): Promise<ChecklistFile> {
    return new TextReader(file, GRT_FORMAT_OPTIONS).read();
  }

  public static fromProto(file: ChecklistFile): File {
    const blob = new TextWriter(GRT_FORMAT_OPTIONS).write(file);
    return new File([blob], 'checklist.txt');
  }
}
