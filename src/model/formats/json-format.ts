import { ChecklistFile, ChecklistGroup, ChecklistGroup_Category } from '../../../gen/ts/checklist';
import { AbstractChecklistFormat } from './abstract-format';

export class JsonFormat extends AbstractChecklistFormat {
  public async toProto(file: File): Promise<ChecklistFile> {
    const contents = await file.text();
    const checklist = ChecklistFile.fromJsonString(contents);
    checklist.groups.forEach((group: ChecklistGroup) => {
      if (group.category === ChecklistGroup_Category.unknown) {
        group.category = ChecklistGroup_Category.normal;
      }
    });
    return checklist;
  }

  public async fromProto(file: ChecklistFile): Promise<File> {
    const contents = ChecklistFile.toJsonString(file, { prettySpaces: 2 });
    return Promise.resolve(new File([contents], `${file.metadata!.name}.${this.extension}`));
  }
}
