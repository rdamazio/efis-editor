import { ChecklistFile } from '../../../gen/ts/checklist';
import { PdfWriter, PdfWriterOptions } from './pdf-writer';

export class PdfFormat {
  public static async fromProto(file: ChecklistFile, options?: PdfWriterOptions): Promise<File> {
    const blob = await new PdfWriter(options).write(file);
    return new File([blob], file.metadata!.name + '.pdf');
  }
}
