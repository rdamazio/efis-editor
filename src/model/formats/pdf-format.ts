import { ChecklistFile } from '../../../gen/ts/checklist';
import { AbstractChecklistFormat } from './abstract-format';
import { PdfWriter, PdfWriterOptions } from './pdf-writer';

export class PdfFormat extends AbstractChecklistFormat {
  public async fromProto(file: ChecklistFile, options: PdfWriterOptions): Promise<File> {
    const blob = await new PdfWriter(options).write(file);
    return new File([blob], `${file.metadata!.name}${this.extension}`);
  }

  public async toProto(file: File): Promise<ChecklistFile> {
    return Promise.reject(new Error(`Parsing of ${file.name} not implemented!`));
  }
}
