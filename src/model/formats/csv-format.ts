import { ChecklistFile } from '../../../gen/ts/checklist';
import { AbstractChecklistFormat } from './abstract-format';
import { CsvReader } from './csv-reader';
import { CsvWriter } from './csv-writer';

export class CsvFormat extends AbstractChecklistFormat {
  public async toProto(file: File): Promise<ChecklistFile> {
    return CsvReader.read(file);
  }

  public async fromProto(file: ChecklistFile): Promise<File> {
    return Promise.resolve(new File([CsvWriter.write(file)], `${file.metadata!.name}${this.extension}`));
  }
}
