import crc32 from 'buffer-crc32';
import { ChecklistFile, ChecklistItem_Type } from '../../../gen/ts/checklist';
import * as AceConstants from './ace-constants';
import { FormatError } from './error';

export class AceWriter {
  private readonly _parts: BlobPart[] = [];

  public async write(file: ChecklistFile): Promise<Blob> {
    if (!file.metadata?.name) {
      throw new FormatError('File name must be specified in metadata');
    }

    this._addPart(AceConstants.HEADER);

    const metadata = file.metadata;
    this._addBytes(metadata.defaultGroupIndex, metadata.defaultChecklistIndex);
    this._addLine();

    this._addLine(file.metadata.name);
    this._addLine(metadata.makeAndModel);
    this._addLine(metadata.aircraftInfo);
    this._addLine(metadata.manufacturerInfo);
    this._addLine(metadata.copyrightInfo);

    for (const group of file.groups) {
      this._addPart(AceConstants.GROUP_HEADER);
      this._addLine(group.title);
      for (const checklist of group.checklists) {
        this._addPart(AceConstants.CHECKLIST_HEADER);
        this._addLine(checklist.title);
        for (const item of checklist.items) {
          if (item.type === ChecklistItem_Type.ITEM_SPACE) {
            this._addLine();
            continue;
          }

          const typeCode = AceConstants.codeForItemType(item.type);
          let indentCode = item.indent + 0x30;
          if (item.centered) {
            indentCode = 0x63; // 'c'
          }
          this._addBytes(typeCode, indentCode);
          let text = item.prompt;
          if (item.type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE) {
            text += '~';
            text += item.expectation;
          }
          this._addLine(text);
        }
        this._addLine(AceConstants.CHECKLIST_END_HEADER);
      }
      this._addLine(AceConstants.GROUP_END_HEADER);
    }
    this._addLine(AceConstants.FILE_END);

    // _add CRC for the existing parts.
    const crc = crc32.signed(Buffer.from(await new Blob(this._parts).arrayBuffer()));
    const crcBytes = new Uint8Array(4);
    new DataView(crcBytes.buffer).setUint32(0, ~crc, true);
    this._addPart(crcBytes);

    return new Blob(this._parts, { type: 'application/octet-stream' });
  }

  private _addLine(line?: string | BlobPart) {
    if (line) {
      this._addPart(line);
    }
    this._addPart(AceConstants.CRLF);
  }

  private _addBytes(...bytes: number[]) {
    this._addPart(Uint8Array.from(bytes));
  }

  private _addPart(part: BlobPart) {
    this._parts.push(part);
  }
}
