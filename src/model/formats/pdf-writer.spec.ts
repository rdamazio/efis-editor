import * as pdfjs from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import { PdfWriter, PdfWriterOptions } from './pdf-writer';
import { EXPECTED_CONTENTS } from './test-data';

describe('PdfWriter', () => {
  it('should create an instance', () => {
    expect(new PdfWriter()).toBeTruthy();
  });

  it('generates a valid PDF', async () => {
    const pdf = await writeAndParsePdf({});
    expect(pdf.numPages).toBeGreaterThan(1);
    const allText = await pdfToText(pdf);

    // Check that the contents of all the groups and items are present.
    // This won't verify that it's laid out properly, but at least verifies that
    // the content was actually output to the PDF.
    for (const group of EXPECTED_CONTENTS.groups) {
      expect(allText).toContain(group.title);
      for (const checklist of group.checklists) {
        expect(allText).toContain(checklist.title);
        for (const item of checklist.items) {
          if (item.prompt) {
            expect(allText).toContain(item.prompt);
          }
          if (item.expectation) {
            expect(allText).toContain(item.expectation);
          }
        }
      }
    }

    // Cover page was NOT requested - it shouldn't be present.
    const metadata = EXPECTED_CONTENTS.metadata!;
    expect(allText).not.toContain(metadata.aircraftInfo);
    expect(allText).not.toContain(metadata.makeAndModel);
    expect(allText).not.toContain(metadata.manufacturerInfo);
    expect(allText).not.toContain(metadata.copyrightInfo);

    // Page numbers should be present.
    for (let i = 1; i <= pdf.numPages; i++) {
      expect(allText).toContain(`Page ${i} of ${pdf.numPages}`);
    }
  });

  it('generates a valid cover page and page numbers', async () => {
    const pdf = await writeAndParsePdf({ outputCoverPage: true });
    expect(pdf.numPages).toBeGreaterThan(2);
    const allText = await pdfToText(pdf);

    // Check that all the metadata is present this time.
    const metadata = EXPECTED_CONTENTS.metadata!;
    expect(allText).toContain(metadata.aircraftInfo);
    expect(allText).toContain(metadata.makeAndModel);
    expect(allText).toContain(metadata.manufacturerInfo);
    expect(allText).toContain(metadata.copyrightInfo);

    // Page numbers should be present, except on the cover page.
    expect(allText).not.toContain(`Page 1 of ${pdf.numPages}`);
    for (let i = 2; i <= pdf.numPages; i++) {
      expect(allText).toContain(`Page ${i} of ${pdf.numPages}`);
    }
  });

  async function writeAndParsePdf(options: PdfWriterOptions): Promise<pdfjs.PDFDocumentProxy> {
    const writer = new PdfWriter(options);
    const writtenFile = writer.write(EXPECTED_CONTENTS);
    const writtenData = await writtenFile.arrayBuffer();
    expect(writtenData.byteLength).toBeGreaterThan(1000);
    return parsePdf(writtenData);
  }

  async function parsePdf(data: ArrayBuffer): Promise<pdfjs.PDFDocumentProxy> {
    pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.js';

    return pdfjs.getDocument({
      data: data,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
  }

  async function pdfToText(pdf: pdfjs.PDFDocumentProxy): Promise<string> {
    // Concatenate all the text from the PDF.
    let allText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      for (const item of content.items) {
        allText += (item as TextItem).str;
        allText += ' ';
      }
    }
    return allText;
  }
});
