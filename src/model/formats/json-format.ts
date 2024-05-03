import { ChecklistFile } from "../../../gen/ts/checklist";

export class JsonFormat {

    public static async toProto(file: File): Promise<ChecklistFile> {
        let contents = await file.text()
        return ChecklistFile.fromJsonString(contents);
    }

    public static async fromProto(file: ChecklistFile): Promise<File> {
        let contents = ChecklistFile.toJsonString(file, { prettySpaces: 2 });
        return new File([contents], file.metadata!.name + '.json');
    }
}