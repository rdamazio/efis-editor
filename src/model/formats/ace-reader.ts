import crc32 from 'buffer-crc32';
import equal from 'fast-deep-equal';
import {
  Checklist,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import * as AceConstants from './ace-constants';
import { FormatError } from './error';

export class AceReader {
  private static readonly ENCODING = 'latin1'; // equivalent to ISO-8859-1
  private static readonly DECODER = new TextDecoder(this.ENCODING);

  private _buf: ArrayBuffer | undefined;
  private _arr: Uint8Array | undefined;
  private _offset = 0;

  constructor(private readonly _file: File) {}

  public async read(): Promise<ChecklistFile> {
    // Format parsing largely inspired by http://github.com/MaggieLeber/checklist
    this._buf = await this._file.arrayBuffer();
    this._arr = new Uint8Array(this._buf);

    const expectedCrc = crc32.signed(Buffer.from(this._buf, 0, this._buf.byteLength - 4));

    const header = this._readBytes(AceConstants.HEADER.byteLength);
    if (!equal(header, AceConstants.HEADER)) {
      throw new FormatError(`Unexpected file header in ${this._file.name}: ${String(header)}`);
    }
    const defaultGroup = this._readBytes(1)[0];
    const defaultChecklist = this._readBytes(1)[0];
    if (!this._consumeLine('')) {
      throw new FormatError(`Unexpected header ending in ${this._file.name}`);
    }

    let name = this._readLine();
    if (!name) {
      name = this._file.name;
      if (name.toLowerCase().endsWith('.ace') && name.length > 4) {
        name = name.slice(0, -4);
      }
    }
    if (!name) {
      // Oh well, we tried.
      throw new FormatError("No file name in file's metadata or uploaded file");
    }
    const makeAndModel = this._readLine();
    const aircraftInfo = this._readLine();
    const manufacturerInfo = this._readLine();
    const copyrightInfo = this._readLine();

    const outFile: ChecklistFile = {
      groups: [],
      metadata: ChecklistFileMetadata.create({
        name: name,
        defaultGroupIndex: defaultGroup,
        defaultChecklistIndex: defaultChecklist,
        makeAndModel: makeAndModel,
        aircraftInfo: aircraftInfo,
        manufacturerInfo: manufacturerInfo,
        copyrightInfo: copyrightInfo,
      }),
    };

    while (!this._consumeLine(AceConstants.FILE_END)) {
      outFile.groups.push(this._readGroup());
    }

    const fileCrc = ~new DataView(this._buf, this._offset, 4).getUint32(0, true);
    if (fileCrc !== expectedCrc) {
      throw new FormatError(
        'File failed checksum! Expected ' + expectedCrc.toString(16) + ', file has ' + fileCrc.toString(16),
      );
    }
    return outFile;
  }

  private _readGroup(): ChecklistGroup {
    if (!this._consumeBytes(AceConstants.GROUP_HEADER)) {
      throw new FormatError('Bad checklist group header: ' + this._peekLine());
    }

    const group: ChecklistGroup = { title: this._readLine(), checklists: [], category: ChecklistGroup_Category.normal };

    while (!this._consumeLine(AceConstants.GROUP_END_HEADER)) {
      group.checklists.push(this._readChecklist());
    }
    return group;
  }

  private _readChecklist(): Checklist {
    if (!this._consumeBytes(AceConstants.CHECKLIST_HEADER)) {
      throw new FormatError('Bad checklist header: ' + this._peekLine());
    }

    const checklist: Checklist = { title: this._readLine(), items: [] };

    while (!this._consumeLine(AceConstants.CHECKLIST_END_HEADER)) {
      checklist.items.push(this._readItem());
    }
    return checklist;
  }

  private _readItem(): ChecklistItem {
    if (this._consumeLine('')) {
      return ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE });
    }

    const typeCode = this._readBytes(1)[0];
    const type = AceConstants.itemTypeForCode(typeCode);
    const indentCode = this._readBytes(1)[0];
    let indent = 0;
    let centered = false;
    if (indentCode === 0x63) {
      // 'c'
      centered = true;
    } else {
      indent = indentCode - 0x30;
    }
    let prompt = this._readLine();
    let expectation = '';
    if (type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE) {
      const splits = prompt.split('~');
      prompt = splits[0];
      if (splits.length === 2) {
        expectation = splits[1];
      } else if (splits.length > 2) {
        expectation = splits.slice(1).join('~');
      }
    }

    return { type: type, prompt: prompt, expectation: expectation, indent: indent, centered: centered };
  }

  private _consumeBytes(expected: Uint8Array): boolean {
    const bytes = this._peekBytes(expected.byteLength);
    if (equal(bytes, expected)) {
      this._offset += expected.byteLength;
      return true;
    }
    return false;
  }
  private _readBytes(len: number): Uint8Array {
    const ret = this._peekBytes(len);
    this._offset += len;
    return ret;
  }
  private _peekBytes(len: number): Uint8Array {
    const slice = this._arr!.slice(this._offset, this._offset + len);
    if (slice.byteLength !== len) {
      throw new FormatError(`Truncated file: expected to read ${len} bytes, only got ${slice.byteLength}`);
    }
    return slice;
  }

  private _readLine(): string {
    const line = this._peekLine();
    this._offset += line.length + 2;
    return line;
  }

  private _consumeLine(expected: string): boolean {
    const line = this._peekLine();
    if (line === expected) {
      this._offset += line.length + 2;
      return true;
    }
    return false;
  }

  private _peekLine(): string {
    // Find the CRLF
    let idx: number;
    for (idx = this._offset; idx < this._arr!.byteLength - 1; idx++) {
      if (this._arr![idx] === 0xd && this._arr![idx + 1] === 0xa) {
        break;
      }
    }
    const line = AceReader.DECODER.decode(this._arr!.slice(this._offset, idx));
    if (idx === this._arr!.byteLength) {
      throw new FormatError(`Truncated file: reached EOF reading line: ${line}`);
    }
    return line;
  }
}
