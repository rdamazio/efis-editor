import { ChecklistFile } from '../../../gen/ts/checklist';
import { PdfWriter, PdfWriterOptions } from './pdf-writer';

export class PdfFormat {
  public static fromProto(file: ChecklistFile, options: PdfWriterOptions): Promise<File> {
    const blob = new PdfWriter(options).write(file);
    return Promise.resolve(new File([blob], file.metadata!.name + '.pdf'));
  }
}
