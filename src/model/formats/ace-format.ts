import { Checklist, ChecklistFile, ChecklistGroup, ChecklistItem, ChecklistItem_Type } from "../../../gen/ts/checklist";
import equal from "fast-deep-equal";
import crc32 from "buffer-crc32";
import { AceReader } from "./ace-reader";

export class AceFormat {
    public static async toProto(file: File): Promise<ChecklistFile> {
        return new AceReader(file).read();
    }
/*
    public static fromProto(file: ChecklistFile): File {
        let mainContents = new Blob([]);
        let fileStructure : BlobPart[] =
            [
                AceFormat.HEADER,
                // Checklist name
                Buffer.from(file.name, AceFormat.ENCODING), AceFormat.CRLF,
                // TODO: Fill these out with real data.
                'Aircraft make and model', AceFormat.CRLF,
                'Aircraft info', AceFormat.CRLF,
                'Manufacturer info', AceFormat.CRLF,
                'Copyright info', AceFormat.CRLF,
                mainContents,
            ];
        // fileStructure.push(this.crcForContents(fileStructure)); 
        
        return new File(fileStructure, file.name + '.ace');
    }
    */
}
