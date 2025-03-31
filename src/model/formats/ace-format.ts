import { ChecklistFile } from '../../../gen/ts/checklist';
import { AceReader } from './ace-reader';
import { AceWriter } from './ace-writer';
import { AbstractChecklistFormat } from './abstract-format';

export class AceFormat extends AbstractChecklistFormat {
  public async toProto(file: File): Promise<ChecklistFile> {
    return new AceReader(file).read();
  }

  public async fromProto(file: ChecklistFile): Promise<File> {
    const blob = await new AceWriter().write(file);
    return new File([blob], `${file.metadata!.name}.${this.extension}`);
  }
}
