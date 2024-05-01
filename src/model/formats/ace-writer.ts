import crc32 from "buffer-crc32";
import { ChecklistFile, ChecklistFileMetadata, ChecklistItem_Type } from "../../../gen/ts/checklist";
import { AceConstants } from "./ace-constants";

export class AceWriter {
    private _parts: BlobPart[] = [];

    public async write(file: ChecklistFile): Promise<Blob> {

        this.addPart(AceConstants.HEADER);

        let metadata = file.metadata || <ChecklistFileMetadata>{};
        this.addBytes(metadata.defaultGroupIndex, metadata.defaultChecklistIndex);
        this.addLine();

        this.addLine(file.name);
        this.addLine(metadata.makeAndModel);
        this.addLine(metadata.aircraftInfo);
        this.addLine(metadata.manufacturerInfo);
        this.addLine(metadata.copyrightInfo);

        for (let group of file.groups) {
            this.addPart(AceConstants.GROUP_HEADER);
            this.addLine(group.title);
            for (let checklist of group.checklists) {
                this.addPart(AceConstants.CHECKLIST_HEADER);
                this.addLine(checklist.title);
                for (let item of checklist.items) {
                    if (item.type === ChecklistItem_Type.ITEM_SPACE) {
                        this.addLine();
                        continue;
                    }

                    let typeCode = AceConstants.codeForItemType(item.type);
                    let indentCode = item.indent + 0x30;
                    if (item.centered) {
                        indentCode = 0x63;  // 'c'
                    }
                    this.addBytes(typeCode, indentCode);
                    let text = item.prompt;
                    if (item.type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE) {
                        text += '~';
                        text += item.expectation;
                    }
                    this.addLine(text);
                }
                this.addLine(AceConstants.CHECKLIST_END_HEADER);
            }
            this.addLine(AceConstants.GROUP_END_HEADER);
        }
        this.addLine(AceConstants.FILE_END);

        // Add CRC for the existing parts.
        let crc = crc32.signed(Buffer.from(await new Blob(this._parts).arrayBuffer()));
        let crcBytes = new Uint8Array(4);
        new DataView(crcBytes.buffer).setUint32(0, ~crc, true);
        this.addPart(crcBytes);

        return new Blob(this._parts, { type: 'application/octet-stream' });
    }

    private addLine(line?: string | BlobPart) {
        if (line) {
            this.addPart(line);
        }
        this.addPart(AceConstants.CRLF);
    }

    private addBytes(...bytes: number[]) {
        this.addPart(Uint8Array.from(bytes));
    }

    private addPart(part: BlobPart) {
        this._parts.push(part);
    }
}
