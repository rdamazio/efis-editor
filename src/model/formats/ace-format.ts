import { Checklist, ChecklistFile, ChecklistGroup, ChecklistItem, ChecklistItem_Type } from "../../../gen/ts/checklist";
import equal from "fast-deep-equal";
import crc32 from "buffer-crc32";
import { AceReader } from "./ace-reader";
import { AceWriter } from "./ace-writer";

export class AceFormat {
    public static async toProto(file: File): Promise<ChecklistFile> {
        return new AceReader(file).read();
    }

    public static async fromProto(file: ChecklistFile): Promise<File> {
        let blob = await new AceWriter().write(file);
        return new File([blob], file.name + '.ace');
    }
}
