import { ChecklistFile } from '../../../gen/ts/checklist';
import { AbstractChecklistFormat, FileExtension, FormatOptions } from './abstract-format';
import { FormatId } from './format-id';
import { TextFormatOptions, TXT_EXTENSION } from './text-format-options';
import { TextReader } from './text-reader';
import { TextWriter } from './text-writer';

export const DYNON_FORMAT_OPTIONS: TextFormatOptions = {
  fileExtensions: [],
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

export interface DynonFormatOptions extends FormatOptions {
  fileName?: string;
  maxLineLength?: number;
}

export class DynonFormat extends AbstractChecklistFormat<DynonFormatOptions> {
  private readonly _textFormatOptions: TextFormatOptions;
  private readonly _fileName: string;

  constructor(formatId: FormatId, name: string, args?: DynonFormatOptions) {
    super(formatId, name, args);
    this._textFormatOptions = Object.assign({}, DYNON_FORMAT_OPTIONS);
    this._textFormatOptions.maxLineLength = args?.maxLineLength;
    this._textFormatOptions.fileExtensions = [this.extension];
    this._fileName = args?.fileName ?? `checklist${this.extension}`;
  }

  public override get extension(): FileExtension {
    return this._extension ?? TXT_EXTENSION;
  }

  public async toProto(file: File): Promise<ChecklistFile> {
    return new TextReader(file, this._textFormatOptions).read();
  }

  public async fromProto(file: ChecklistFile): Promise<File> {
    const blob = new TextWriter(this._textFormatOptions).write(file);
    return new Promise((resolve) => {
      resolve(new File([blob], this._fileName));
    });
  }
}
