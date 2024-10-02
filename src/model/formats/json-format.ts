import { ChecklistFile, ChecklistGroup_Category } from '../../../gen/ts/checklist';

export class JsonFormat {
  public static async toProto(file: File): Promise<ChecklistFile> {
    const contents = await file.text();
    const checklist = ChecklistFile.fromJsonString(contents);
    checklist.groups.forEach((group) => {
      if (group.category === ChecklistGroup_Category.unknown) {
        group.category = ChecklistGroup_Category.normal;
      }
    });
    return checklist;
  }

  public static fromProto(file: ChecklistFile): Promise<File> {
    const contents = ChecklistFile.toJsonString(file, { prettySpaces: 2 });
    return Promise.resolve(new File([contents], file.metadata!.name + '.json'));
  }
}
