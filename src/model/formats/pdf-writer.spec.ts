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
    const pdf = await writeAndParsePdf({ outputPageNumbers: true });
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

  it('generates no page numbers if not requested', async () => {
    const pdf = await writeAndParsePdf({ outputPageNumbers: false });
    expect(pdf.numPages).toBeGreaterThan(1);
    const allText = await pdfToText(pdf);

    // Page numbers should NOT be present.
    for (let i = 1; i <= pdf.numPages; i++) {
      expect(allText).not.toContain(`Page ${i} of ${pdf.numPages}`);
    }
  });

  it('generates a valid cover page and page numbers', async () => {
    const pdf = await writeAndParsePdf({ outputCoverPage: true, outputPageNumbers: true });
    expect(pdf.numPages).toBeGreaterThan(2);

    // Check that all the metadata is present this time.
    const metadata = EXPECTED_CONTENTS.metadata!;
    const coverText = await pageToText(pdf, 1);
    expect(coverText).toContain(metadata.aircraftInfo);
    expect(coverText).toContain(metadata.makeAndModel);
    expect(coverText).toContain(metadata.manufacturerInfo);
    expect(coverText).toContain(metadata.copyrightInfo);

    // Page numbers should be present, except on the cover page.
    const allText = await pdfToText(pdf);
    expect(allText).not.toContain(`Page 1 of ${pdf.numPages}`);
    for (let i = 2; i <= pdf.numPages; i++) {
      expect(allText).toContain(`Page ${i} of ${pdf.numPages}`);
    }
  });

  it('generates group cover pages', async () => {
    const pdf = await writeAndParsePdf({ outputCoverPage: true, outputGroupCoverPages: true });
    expect(pdf.numPages).toBeGreaterThan(3);

    const coverText = await pageToText(pdf, 1);
    expect(coverText).toContain(EXPECTED_CONTENTS.metadata!.aircraftInfo);

    const groupCoverText = await pageToText(pdf, 2);
    expect(groupCoverText).toContain(EXPECTED_CONTENTS.groups[0].title);

    const groupContentsText = await pageToText(pdf, 3);
    expect(groupContentsText).toContain(EXPECTED_CONTENTS.groups[0].checklists[0].items[0].prompt);
  });

  it('generates a PDF with a custom page size', async () => {
    const pdf = await writeAndParsePdf({ pageSize: 'custom', customPageHeight: 9.2, customPageWidth: 4.3 });
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1 / 72 });
      expect(viewport.height).toEqual(9.2);
      expect(viewport.width).toEqual(4.3);
    }
  });

  async function writeAndParsePdf(options: PdfWriterOptions): Promise<pdfjs.PDFDocumentProxy> {
    const writer = new PdfWriter(options);
    const writtenFile = await writer.write(EXPECTED_CONTENTS);
    const writtenData = await writtenFile.arrayBuffer();
    expect(writtenData.byteLength).toBeGreaterThan(1000);
    return parsePdf(writtenData);
  }

  async function parsePdf(data: ArrayBuffer): Promise<pdfjs.PDFDocumentProxy> {
    pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.js';

    return pdfjs.getDocument({ data: data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true })
      .promise;
  }

  async function pdfToText(pdf: pdfjs.PDFDocumentProxy): Promise<string> {
    // Concatenate all the text from the PDF.
    let allText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      allText += await pageToText(pdf, pageNum);
    }
    return allText;
  }

  async function pageToText(pdf: pdfjs.PDFDocumentProxy, pageNum: number): Promise<string> {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    let pageText = '';
    for (const item of content.items) {
      pageText += (item as TextItem).str;
      pageText += ' ';
    }
    return pageText;
  }
});
