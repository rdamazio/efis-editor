import { ChecklistFile } from '../../../gen/ts/checklist';
import { AbstractChecklistFormat } from './abstract-format';
import { FormatId } from './format-id';
import { TXT_EXTENSION, TextFormatOptions } from './text-format-options';
import { TextReader } from './text-reader';
import { TextWriter } from './text-writer';

export const IFLY_EFB_FORMAT_OPTIONS: TextFormatOptions = {
  fileExtensions: [TXT_EXTENSION],
  indentWidth: 2,

  groupPrefix: '> ',
  readGroupPrefix: '> ',
  readChecklistPrefix: '>> ',

  groupTitleInOwnLine: true,
  expectationSeparator: ': ',
  notePrefix: 'NOTE: ',
  titlePrefixSuffix: '** ',
  warningPrefix: 'WARNING: ',
  cautionPrefix: 'CAUTION: ',

  outputMetadata: true,
  outputHeaderComment: false,

  checklistPrefix: '>>',
  itemPrefix: '',
};

export class IflyEfbFormat extends AbstractChecklistFormat {
  constructor(formatId: FormatId, name: string) {
    super(formatId, name, { extension: TXT_EXTENSION });
  }

  public async toProto(file: File): Promise<ChecklistFile> {
    return new TextReader(file, IFLY_EFB_FORMAT_OPTIONS).read();
  }

  public async fromProto(file: ChecklistFile): Promise<File> {
    const blob = new TextWriter(IFLY_EFB_FORMAT_OPTIONS).write(file);
    return Promise.resolve(new File([blob], `checklist${TXT_EXTENSION}`));
  }
}