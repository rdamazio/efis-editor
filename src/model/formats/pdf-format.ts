import { ChecklistFile } from '../../../gen/ts/checklist';
import { PdfWriter, PdfWriterOptions } from './pdf-writer';

export class PdfFormat {
  public static fromProto(file: ChecklistFile, options: PdfWriterOptions): File {
    const blob = new PdfWriter(options).write(file);
    return new File([blob], file.metadata!.name + '.pdf');
  }
}
