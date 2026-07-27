import { ChecklistFile } from '../../../gen/ts/checklist';
import { AbstractChecklistFormat } from './abstract-format';
import { CsvReader } from './csv-reader';
import { CsvWriter } from './csv-writer';
import { FormatError } from './error';

export class CsvFormatError extends FormatError {
  constructor(message: string, cause?: Error) {
    super(`CSV: ${message}`);
    this.cause = cause;
    this.name = 'CsvFormatError';
  }
}

export class CsvFormat extends AbstractChecklistFormat {
  public async toProto(file: File): Promise<ChecklistFile> {
    return CsvReader.read(file);
  }

  public async fromProto(file: ChecklistFile): Promise<File> {
    const blob = CsvWriter.write(file);
    return await Promise.resolve(new File([blob], `${file.metadata!.name}${this.extension}`));
  }
}
