import { ChecklistFile } from '../../../gen/ts/checklist';
import { AbstractChecklistFormat } from './abstract-format';
import { PlaintextReader } from './plaintext-reader';

export class TxtFormat extends AbstractChecklistFormat {
  public async toProto(file: File): Promise<ChecklistFile> {
    return new PlaintextReader(file).read();
  }

  public async fromProto(file: ChecklistFile): Promise<File> {
    return Promise.reject(new Error(`Exporting to ${this.name} not implemented!`));
  }
}