import { ChecklistFile, ChecklistGroup, ChecklistGroup_Category } from '../../../gen/ts/checklist';

export class JsonFormat {
  public static async toProto(file: File): Promise<ChecklistFile> {
    const contents = await file.text();
    const checklist = ChecklistFile.fromJsonString(contents);
    checklist.groups.forEach((group: ChecklistGroup) => {
      if (group.category === ChecklistGroup_Category.unknown) {
        group.category = ChecklistGroup_Category.normal;
      }
    });
    return checklist;
  }

  public static fromProto(file: ChecklistFile): File {
    const contents = ChecklistFile.toJsonString(file, { prettySpaces: 2 });
    return new File([contents], file.metadata!.name + '.json');
  }
}
