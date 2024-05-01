import { ChecklistFile } from "../../../gen/ts/checklist";
import { AceReader } from "./ace-reader";
import { AceWriter } from "./ace-writer";

export class AceFormat {
    public static async toProto(file: File): Promise<ChecklistFile> {
        return new AceReader(file).read();
    }

    public static async fromProto(file: ChecklistFile): Promise<File> {
        const blob = await new AceWriter().write(file);
        return new File([blob], file.name + '.ace');
    }
}
