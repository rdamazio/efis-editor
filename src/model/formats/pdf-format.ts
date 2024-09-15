import { ChecklistFile } from '../../../gen/ts/checklist';
import { PdfWriter, PdfWriterOptions } from './pdf-writer';

export class PdfFormat {
  // TODO: Add more PDF format options (popup dialog?)
  private static PDF_OPTIONS: PdfWriterOptions = {
    outputCoverPage: true,
    outputCoverPageFooter: true,
  };

  public static async fromProto(file: ChecklistFile): Promise<File> {
    const blob = new PdfWriter(this.PDF_OPTIONS).write(file);
    return new File([blob], file.metadata!.name + '.pdf');
  }
}
