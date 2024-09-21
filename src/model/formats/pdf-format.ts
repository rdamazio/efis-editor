import { ChecklistFile } from '../../../gen/ts/checklist';
import { PdfWriter, PdfWriterOptions } from './pdf-writer';

export class PdfFormat {
  // TODO: Add more PDF format options (popup dialog?)
  private static DEFAULT_PDF_OPTIONS: PdfWriterOptions = {
    outputCoverPage: true,
    outputCoverPageFooter: true,
    outputPageNumbers: true,
  };

  public static async fromProto(file: ChecklistFile, options?: PdfWriterOptions): Promise<File> {
    const blob = new PdfWriter(options || this.DEFAULT_PDF_OPTIONS).write(file);
    return new File([blob], file.metadata!.name + '.pdf');
  }
}
