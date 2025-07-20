import { ChecklistFile, ChecklistFileMetadata, ChecklistItem, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { FormatError } from './error';
import {
  HEADER_COMMENT,
  LAST_UPDATED_FOOTER,
  METADATA_AIRCRAFT_TITLE,
  METADATA_CHECKLIST_TITLE,
  METADATA_COPYRIGHT_TITLE,
  METADATA_FILE_TITLE,
  METADATA_MAKE_MODEL_TITLE,
  METADATA_MANUFACTURER_TITLE,
  TextFormatOptions,
  WRAP_PREFIX,
} from './text-format-options';

export class TextWriter {
  private static readonly CRLF = '\r\n';
  private readonly _titleSuffix: string;
  private readonly _parts: string[] = [];
  // Let tests override our date.
  public static testingTime: Date | undefined;

  constructor(private readonly _options: TextFormatOptions) {
    this._titleSuffix = this._options.titlePrefixSuffix.split('').reverse().join('');
  }

  public write(file: ChecklistFile): Blob {
    this._addLine(HEADER_COMMENT);

    let firstGroup = true;
    let checklistIdx = 0;
    for (const group of file.groups) {
      for (const checklist of group.checklists) {
        this._addLine();
        this._addPart(this._replaceNumbers(this._options.checklistPrefix, checklistIdx, 0));
        this._addPart(' ');
        if (!firstGroup || !this._options.skipFirstGroup) {
          this._addPart(group.title);
          this._addPart(': ');
        }
        this._addLine(checklist.title);

        this._addItems(checklist.items, checklistIdx);

        checklistIdx++;
      }
      firstGroup = false;
    }

    if (this._options.outputMetadata && file.metadata) {
      this._addMetadata(file.metadata, checklistIdx);
    }

    return new Blob(this._parts);
  }

  private _addMetadata(metadata: ChecklistFileMetadata, checklistIdx: number) {
    this._addLine();
    this._addPart(this._replaceNumbers(this._options.checklistPrefix, checklistIdx, 0));
    this._addPart(' ');
    this._addLine(METADATA_CHECKLIST_TITLE);

    let itemIdx = 0;
    if (this._options.checklistTopBlankLine) {
      this._addLine(this._replaceNumbers(this._options.itemPrefix, checklistIdx, itemIdx++));
    }

    itemIdx = this._addMetadataItem(METADATA_FILE_TITLE, metadata.name, checklistIdx, itemIdx);
    if (metadata.makeAndModel) {
      itemIdx = this._addMetadataItem(METADATA_MAKE_MODEL_TITLE, metadata.makeAndModel, checklistIdx, itemIdx);
    }
    if (metadata.aircraftInfo) {
      itemIdx = this._addMetadataItem(METADATA_AIRCRAFT_TITLE, metadata.aircraftInfo, checklistIdx, itemIdx);
    }
    if (metadata.manufacturerInfo) {
      itemIdx = this._addMetadataItem(METADATA_MANUFACTURER_TITLE, metadata.manufacturerInfo, checklistIdx, itemIdx);
    }
    if (metadata.copyrightInfo) {
      itemIdx = this._addMetadataItem(METADATA_COPYRIGHT_TITLE, metadata.copyrightInfo, checklistIdx, itemIdx);
    }
    this._addLine(this._replaceNumbers(this._options.itemPrefix, checklistIdx, itemIdx++));

    const now = TextWriter.testingTime ?? new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    this._addPart(this._replaceNumbers(this._options.itemPrefix, checklistIdx, itemIdx));
    this._addPart(' ');
    this._addPart(LAST_UPDATED_FOOTER);
    this._addPart(year.toString());
    this._addPart('-');
    if (month < 10) this._addPart('0');
    this._addPart(month.toString());
    this._addPart('-');
    if (day < 10) this._addPart('0');
    this._addLine(day.toString());
  }

  private _addMetadataItem(title: string, contents: string, checklistIdx: number, metadataIdx: number) {
    this._addPart(this._replaceNumbers(this._options.itemPrefix, checklistIdx, metadataIdx++));
    this._addPart(' ');
    this._addLine(title);
    this._addPart(this._replaceNumbers(this._options.itemPrefix, checklistIdx, metadataIdx++));
    this._addPart('   ');
    this._addLine(contents);
    return metadataIdx;
  }

  private _addItems(items: ChecklistItem[], checklistIdx: number) {
    let itemIdx = 0;

    if (this._options.checklistTopBlankLine) {
      this._addLine(this._replaceNumbers(this._options.itemPrefix, checklistIdx, itemIdx++));
    }

    for (const item of items) {
      let prefix = '';
      let suffix = '';
      switch (item.type) {
        case ChecklistItem_Type.ITEM_TITLE:
          prefix = this._options.titlePrefixSuffix;
          suffix = this._titleSuffix;
          break;
        case ChecklistItem_Type.ITEM_WARNING:
          prefix = this._options.warningPrefix;
          break;
        case ChecklistItem_Type.ITEM_CAUTION:
          prefix = this._options.cautionPrefix;
          break;
        case ChecklistItem_Type.ITEM_NOTE:
          prefix = this._options.notePrefix;
          break;
        case ChecklistItem_Type.ITEM_CHALLENGE:
        case ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE:
        case ChecklistItem_Type.ITEM_PLAINTEXT:
        case ChecklistItem_Type.ITEM_SPACE:
          break;
        default:
          throw new FormatError(`Unexpected item type: ${item.type.valueOf()}`);
      }

      let fullLine = prefix + item.prompt;
      if (item.expectation) {
        fullLine += this._options.expectationSeparator;
        fullLine += item.expectation;
      }
      fullLine += suffix;

      let indentWidth;
      if (item.type === ChecklistItem_Type.ITEM_SPACE) {
        indentWidth = 0;
      } else if (item.centered) {
        if (this._options.maxLineLength && fullLine.length < this._options.maxLineLength) {
          // See how much room is left and indent by half of that
          indentWidth = Math.floor((this._options.maxLineLength - fullLine.length) / 2);
        } else {
          // Either we don't have a length to center within, or the line already
          // exceeds that length and will need to be wrapped - in either case,
          // fall back to arbitrarily using 7 spaces.
          // TODO: There's probably a better solution here.
          indentWidth = 7;
        }
      } else {
        indentWidth = item.indent * this._options.indentWidth;
      }
      const indentStr = ' '.repeat(indentWidth);

      let wrapped = false;
      while (true) {
        this._addPart(this._replaceNumbers(this._options.itemPrefix, checklistIdx, itemIdx++));
        if (item.type !== ChecklistItem_Type.ITEM_SPACE) this._addPart(' ');

        this._addPart(indentStr);

        let wrapWidth = 0;
        if (wrapped) {
          wrapWidth = WRAP_PREFIX.length;
          this._addPart(WRAP_PREFIX);
        }

        if (this._options.maxLineLength) {
          const maxContentLength = this._options.maxLineLength - indentWidth - wrapWidth;
          if (fullLine.length > maxContentLength) {
            let wrapIdx = fullLine.slice(0, maxContentLength).lastIndexOf(' ');
            if (wrapIdx === -1) {
              // Oh well, no spaces - gotta break a word arbitrarily.
              wrapIdx = this._options.maxLineLength;
            }
            this._addLine(fullLine.slice(0, wrapIdx));
            fullLine = fullLine.slice(wrapIdx + 1);
            wrapped = true;
            continue;
          }
        }
        this._addPart(fullLine);
        if (item.centered) {
          this._addPart(indentStr);
        }
        this._addLine();
        break;
      }
    }
  }

  private _addPart(contents: string) {
    this._parts.push(this._properCase(contents));
  }

  private _addLine(contents?: string) {
    if (contents) {
      this._addPart(contents);
    }
    this._parts.push(TextWriter.CRLF);
  }

  private _properCase(str: string) {
    if (this._options.allUppercase) {
      return str.toUpperCase();
    } else {
      return str;
    }
  }

  private _replaceNumbers(template: string, checklistNumber: number, itemNumber: number) {
    if (!this._options.checklistZeroIndexed) checklistNumber++;
    if (!this._options.checklistItemZeroIndexed) itemNumber++;
    return template
      .replace('{{checklistNum}}', checklistNumber.toString())
      .replace('{{itemNum}}', itemNumber.toString());
  }
}
