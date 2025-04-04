import { ChecklistFile } from '../../../gen/ts/checklist';
import { AbstractChecklistFormat } from './abstract-format';
import { TXT_EXTENSION, TextFormatOptions } from './text-format-options';
import { TextReader } from './text-reader';
import { TextWriter } from './text-writer';

export const GRT_FORMAT_OPTIONS: TextFormatOptions = {
  fileExtensions: [TXT_EXTENSION],
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

export class GrtFormat extends AbstractChecklistFormat {
  public async toProto(file: File): Promise<ChecklistFile> {
    return new TextReader(file, GRT_FORMAT_OPTIONS).read();
  }

  public async fromProto(file: ChecklistFile): Promise<File> {
    const blob = new TextWriter(GRT_FORMAT_OPTIONS).write(file);
    return Promise.resolve(new File([blob], `checklist${TXT_EXTENSION}`));
  }
}
