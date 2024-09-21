import { jsPDF, jsPDFOptions } from 'jspdf';
import autoTable, { CellDef, CellHookData, FontStyle, RowInput } from 'jspdf-autotable';
import {
  Checklist,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';

type OrientationType = jsPDFOptions['orientation'];
type FormatType = jsPDFOptions['format'];
type AutoTabledPDF = jsPDF & { lastAutoTable: { finalY: number } };
interface CellPaddingInputStructured {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface PdfWriterOptions {
  orientation?: OrientationType;
  format?: FormatType;
  outputCoverPage?: boolean;
  outputCoverPageFooter?: boolean;
}

export class PdfWriter {
  private static readonly DEBUG_LAYOUT = false;
  private static readonly TABLE_MARGIN_FRACTION = 0.07;
  private static readonly GROUP_TITLE_HEIGHT = 3;
  private static readonly GROUP_TITLE_FONT_SIZE = 20;
  private static readonly MAIN_TITLE_FONT_SIZE = 30;
  private static readonly METADATA_HEADER_FONT_SIZE = 12;
  private static readonly METADATA_HEADER_HEIGHT = 2;
  private static readonly METADATA_VALUE_FONT_SIZE = 20;
  private static readonly METADATA_VALUE_HEIGHT = 3;
  private static readonly HEADER_FONT_SIZE = 16;
  private static readonly CONTENT_FONT_SIZE = 12;
  private static readonly FOOTNOTE_HEIGHT = 1;
  private static readonly FOOTNOTE_FONT_SIZE = 8;
  private static readonly DEFAULT_FONT_NAME = 'Roboto-Regular';
  private static readonly NORMAL_FONT_STYLE = 'normal';
  private static readonly BOLD_FONT_STYLE = 'bold';
  private static readonly RECT_FILL_STYLE = 'F';

  private static readonly WARNING_PREFIX = 'WARNING: ';
  private static readonly CAUTION_PREFIX = 'CAUTION: ';
  private static readonly NOTE_PREFIX = 'NOTE: ';
  private static readonly PREFIX_CELL_WIDTH = 5.6;

  private static readonly SPACER_CELL: CellDef = {
    content: '. '.repeat(100),
    styles: {
      overflow: 'hidden',
      halign: 'center',
    },
  };

  private _doc?: AutoTabledPDF;
  private _pageWidth = 0;
  private _pageHeight = 0;
  private _scaleFactor = 0;
  private _tableMargin = 0;
  private _footNoteY = 0;
  private _defaultPadding = 0;
  private _defaultCellPadding?: CellPaddingInputStructured;

  private _currentY = 0;

  constructor(private _options?: PdfWriterOptions) {}

  public write(file: ChecklistFile): Blob {
    const doc = new jsPDF({
      format: this._options?.format || 'letter',
      orientation: this._options?.orientation || 'portrait',
      unit: 'em',
      putOnlyUsedFonts: true,
    });
    this._doc = doc as AutoTabledPDF;

    // Letter gives 51x66, A4 gives 49.6077x70.1575
    this._pageHeight = this._doc.internal.pageSize.getHeight();
    this._pageWidth = this._doc.internal.pageSize.getWidth();
    this._scaleFactor = this._doc.internal.scaleFactor;
    this._defaultPadding = 5 / this._scaleFactor;
    this._tableMargin = this._pageWidth * PdfWriter.TABLE_MARGIN_FRACTION;
    this._footNoteY = this._pageHeight - this._tableMargin / 2;

    if (PdfWriter.DEBUG_LAYOUT) {
      console.log(
        `PDF page: w=${this._pageWidth}, h=${this._pageHeight}, sf=${this._scaleFactor}, margin=${this._tableMargin}, footnote=${this._footNoteY}, pad=${this._defaultPadding}`,
      );
    }
    this._defaultCellPadding = {
      left: this._defaultPadding,
      top: this._defaultPadding,
      bottom: this._defaultPadding,
      right: this._defaultPadding,
    };

    this._doc.addFont('assets/Roboto-Regular.ttf', PdfWriter.DEFAULT_FONT_NAME, PdfWriter.NORMAL_FONT_STYLE);
    this._doc.addFont('assets/Roboto-Bold.ttf', PdfWriter.DEFAULT_FONT_NAME, PdfWriter.BOLD_FONT_STYLE);
    this._doc.setFont(PdfWriter.DEFAULT_FONT_NAME, PdfWriter.BOLD_FONT_STYLE);

    if (file.metadata && this._options?.outputCoverPage) {
      this._addCover(file.metadata);
    }
    this._addGroups(file.groups);

    this._addPageFooters();

    return this._doc.output('blob');
  }

  private _addCover(metadata: ChecklistFileMetadata) {
    if (!this._doc) return;

    // Center the title at the top half.
    this._setCurrentY(this._pageHeight / 4);
    this._addCenteredText('Checklists', 0, PdfWriter.MAIN_TITLE_FONT_SIZE, PdfWriter.BOLD_FONT_STYLE);

    // Center the metadata at the bottom half.
    let metadataHeight = 0;
    if (metadata.aircraftInfo) metadataHeight += PdfWriter.METADATA_HEADER_HEIGHT + PdfWriter.METADATA_VALUE_HEIGHT;
    if (metadata.makeAndModel) metadataHeight += PdfWriter.METADATA_HEADER_HEIGHT + PdfWriter.METADATA_VALUE_HEIGHT;
    if (metadata.manufacturerInfo) metadataHeight += PdfWriter.METADATA_HEADER_HEIGHT + PdfWriter.METADATA_VALUE_HEIGHT;
    if (metadata.copyrightInfo) metadataHeight += PdfWriter.METADATA_HEADER_HEIGHT + PdfWriter.METADATA_VALUE_HEIGHT;
    const metadataStartY = (this._pageHeight * 3) / 4 - metadataHeight / 2;
    this._setCurrentY(metadataStartY);

    if (metadata.aircraftInfo) {
      this._addCenteredText('Aircraft:', PdfWriter.METADATA_HEADER_HEIGHT, PdfWriter.METADATA_HEADER_FONT_SIZE);
      this._addCenteredText(
        metadata.aircraftInfo,
        PdfWriter.METADATA_VALUE_HEIGHT,
        PdfWriter.METADATA_VALUE_FONT_SIZE,
        PdfWriter.BOLD_FONT_STYLE,
      );
    }
    if (metadata.makeAndModel) {
      this._addCenteredText(
        'Aircraft make/model:',
        PdfWriter.METADATA_HEADER_HEIGHT,
        PdfWriter.METADATA_HEADER_FONT_SIZE,
      );
      this._addCenteredText(
        metadata.makeAndModel,
        PdfWriter.METADATA_VALUE_HEIGHT,
        PdfWriter.METADATA_VALUE_FONT_SIZE,
        PdfWriter.BOLD_FONT_STYLE,
      );
    }
    if (metadata.manufacturerInfo) {
      this._addCenteredText('Manufacturer:', PdfWriter.METADATA_HEADER_HEIGHT, PdfWriter.METADATA_HEADER_FONT_SIZE);
      this._addCenteredText(
        metadata.manufacturerInfo,
        PdfWriter.METADATA_VALUE_HEIGHT,
        PdfWriter.METADATA_VALUE_FONT_SIZE,
        PdfWriter.BOLD_FONT_STYLE,
      );
    }
    if (metadata.copyrightInfo) {
      this._addCenteredText('Copyright:', PdfWriter.METADATA_HEADER_HEIGHT, PdfWriter.METADATA_HEADER_FONT_SIZE);
      this._addCenteredText(
        metadata.copyrightInfo,
        PdfWriter.METADATA_VALUE_HEIGHT,
        PdfWriter.METADATA_VALUE_FONT_SIZE,
        PdfWriter.BOLD_FONT_STYLE,
      );
    }

    if (this._options?.outputCoverPageFooter) {
      this._setCurrentY(this._footNoteY);
      this._addCenteredText(
        'Generated by http://github.com/rdamazio/efis-editor/',
        PdfWriter.FOOTNOTE_HEIGHT,
        PdfWriter.FOOTNOTE_FONT_SIZE,
      );
    }
    this._newPage();
  }

  private _addGroups(groups: ChecklistGroup[]) {
    if (!this._doc) return;

    for (const group of groups) {
      this._addGroup(group);

      // Force starting a new page for each group.
      this._newPage();
    }

    this._doc.deletePage(this._doc.internal.pages.length - 1);
  }

  private _addGroupTitle(group: ChecklistGroup) {
    if (!this._doc) return;
    if (PdfWriter.DEBUG_LAYOUT) {
      console.log(`Group ${group.title}`);
    }

    this._doc.saveGraphicsState();
    let rectColor = 'blue';
    let textColor = 'white';
    if (group.category === ChecklistGroup_Category.abnormal) {
      rectColor = 'orange';
      textColor = 'black';
    } else if (group.category === ChecklistGroup_Category.emergency) {
      rectColor = 'red';
    }
    this._doc.setFillColor(rectColor);
    this._doc.setTextColor(textColor);
    this._doc.rect(0, 0, this._pageWidth, PdfWriter.GROUP_TITLE_HEIGHT + 2, PdfWriter.RECT_FILL_STYLE);

    this._setCurrentY(PdfWriter.GROUP_TITLE_HEIGHT);
    this._addCenteredText(
      group.title,
      PdfWriter.GROUP_TITLE_HEIGHT,
      PdfWriter.GROUP_TITLE_FONT_SIZE,
      PdfWriter.BOLD_FONT_STYLE,
    );

    this._doc.restoreGraphicsState();
  }

  private _addGroup(group: ChecklistGroup) {
    if (!this._doc) return;

    this._addGroupTitle(group);

    let first = true;
    for (const checklist of group.checklists) {
      if (PdfWriter.DEBUG_LAYOUT) {
        console.log(`Checklist ${checklist.title}`);
      }

      // Calculate where to start the next table.
      let startY = PdfWriter.GROUP_TITLE_HEIGHT * 2;
      if (!first) {
        const lastY = this._doc.lastAutoTable.finalY;
        if (lastY > this._pageHeight / 2) {
          // More than half the page is already used, start on the next page.
          this._newPage();
        } else {
          startY = lastY + 2;
        }
      }
      first = false;

      autoTable(this._doc, {
        // Actual columns are: prompt, spacer, expectation
        head: [
          [
            {
              content: checklist.title,
              colSpan: 3,
              styles: { halign: 'center', fontSize: PdfWriter.HEADER_FONT_SIZE },
            },
          ],
        ],
        body: this._checklistTableBody(checklist),
        showHead: 'firstPage',
        margin: this._tableMargin,
        startY: startY,
        rowPageBreak: 'avoid',
        styles: PdfWriter.DEBUG_LAYOUT
          ? {
              lineWidth: 0.1,
            }
          : undefined,
        bodyStyles: {
          fontSize: PdfWriter.CONTENT_FONT_SIZE,
          valign: 'top',
        },
        didDrawCell: (data: CellHookData) => {
          this._drawPrefixedCell(data);
        },
      });
    }
  }

  private _checklistTableBody(checklist: Checklist): RowInput[] {
    return checklist.items.map((item: ChecklistItem) => {
      return this._itemToCells(item);
    });
  }

  private _itemToCells(item: ChecklistItem): CellDef[] {
    if (!this._doc) return [];

    const cells: CellDef[] = [];
    const prompt: CellDef = {
      content: item.prompt,
      styles: {
        halign: 'left',
        minCellWidth: 10,
      },
    };

    // We should be able to have the prefix in its own cell and have non-prefixed rows use a colSpan=2 for the prompt,
    // but unfortunately a bug in jspdf-autotable prevents that:
    // https://github.com/simonbengtsson/jsPDF-AutoTable/issues/686
    let prefix: string | undefined;
    switch (item.type) {
      case ChecklistItem_Type.ITEM_TITLE:
        prompt.styles!.fontStyle = PdfWriter.BOLD_FONT_STYLE;
        break;
      case ChecklistItem_Type.ITEM_SPACE:
        // TODO: Skip alternating styles for blanks?
        prompt.styles!.minCellHeight = this._doc.getLineHeight() / this._scaleFactor;
        break;
      case ChecklistItem_Type.ITEM_WARNING:
        // TODO: Icon
        prefix = PdfWriter.WARNING_PREFIX;
        break;
      case ChecklistItem_Type.ITEM_CAUTION:
        // TODO: Icon
        prefix = PdfWriter.CAUTION_PREFIX;
        break;
      case ChecklistItem_Type.ITEM_NOTE:
        prefix = PdfWriter.NOTE_PREFIX;
        break;
    }

    if (item.centered) {
      prompt.styles!.halign = 'center';
    } else if (item.indent) {
      prompt.styles!.cellPadding = {
        // Specifying any cellPadding removes the other default paddings, so must specify all of them.
        ...this._defaultCellPadding,
        left: this._indentPadding(item.indent),
      };
    }

    if (item.type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE) {
      const expectation: CellDef = {
        content: item.expectation,
        styles: {
          halign: 'left',
        },
      };
      cells.push(prompt, PdfWriter.SPACER_CELL, expectation);
    } else {
      prompt.colSpan = 3;
      if (prefix) {
        // Must precalculate height to make sure text can be re-wrapped during didDrawCell.
        // Also, to avoid weird mismatches between the pre-calculated wrapping and the actual one,
        // use the pre-calculated one as the actual contents.
        const [contentLines, cellHeight] = this._calculatePrefixedCell(item.prompt, item.indent);
        prompt.content = prefix + contentLines.join('\n');
        prompt.styles!.minCellHeight = cellHeight;
      }
      cells.push(prompt);
    }

    if (PdfWriter.DEBUG_LAYOUT) {
      console.log(cells);
    }

    return cells;
  }

  private _drawPrefixedCell(data: CellHookData) {
    if (data.section !== 'body') return;
    if (data.column.index !== 0) return;

    // Caveat: If we had a plaintext field where the text starts with these prefixes,
    // we'd also format that - that's probably OK.
    let contents = data.cell.text.join('\n');

    let prefix: string | undefined;
    let prefixFontStyle: FontStyle = PdfWriter.NORMAL_FONT_STYLE;
    let prefixColor = 'black';
    if (contents.startsWith(PdfWriter.WARNING_PREFIX)) {
      prefix = PdfWriter.WARNING_PREFIX;
      prefixFontStyle = PdfWriter.BOLD_FONT_STYLE;
      prefixColor = 'red';
    } else if (contents.startsWith(PdfWriter.CAUTION_PREFIX)) {
      prefix = PdfWriter.CAUTION_PREFIX;
      prefixFontStyle = PdfWriter.BOLD_FONT_STYLE;
      prefixColor = 'orange';
    } else if (contents.startsWith(PdfWriter.NOTE_PREFIX)) {
      prefix = PdfWriter.NOTE_PREFIX;
    }
    if (!prefix) {
      // Non-prefixed cell.
      return;
    }
    contents = contents.slice(prefix.length);

    // Draw a nested table for the prefixed item.
    // This draws over the existing cell but does not replace it.
    // TODO: There's a small chance that once the contents are wrapped in the nested table, they'll become taller than
    // the original cell - need to precalculate the height when creating the original cell.
    // TODO: Support centering this whole table instead of just the content cell
    const leftPadding = data.cell.padding('left');
    autoTable(this._doc, {
      body: [
        [
          {
            // Use a separate cell for indentation with varying padding
            // so we can use a fixed-width left-aligned prefix cell below.
            content: '',
            styles: {
              cellWidth: leftPadding,
              cellPadding: 0,
            },
          },
          {
            content: prefix.trim(),
            styles: {
              cellWidth: PdfWriter.PREFIX_CELL_WIDTH,
              cellPadding: {
                ...this._defaultCellPadding,
                // Already accounted for in the indentation cell.
                left: 0,
              },
              fontStyle: prefixFontStyle,
              textColor: prefixColor,
            },
          },
          {
            content: contents.trim(),
            styles: {
              cellPadding: this._defaultCellPadding,
            },
          },
        ],
      ],
      startY: data.cell.y,
      alternateRowStyles: undefined,
      margin: this._tableMargin,
      theme: 'plain',
      styles: {
        ...data.cell.styles,
        // Using the right fill color apparently depends on this being set.
        lineWidth: PdfWriter.DEBUG_LAYOUT ? 0.1 : 0,
      },
      tableWidth: data.cell.width,
    });

    data.cell.text = [];
  }

  private _indentPadding(indent: number) {
    return indent + this._defaultPadding;
  }

  private _calculatePrefixedCell(text: string, indent: number): [string[], number] {
    if (!this._doc) return [['NODOC'], 1];

    const indentWidth = this._indentPadding(indent);
    const roundWidth = 1.0 / this._scaleFactor;

    // Calculate the cell width that's available for the text contents
    const contentWidth =
      // The whole page:
      this._pageWidth -
      // The whole table:
      2 * this._tableMargin -
      // The prefix + content (with padding):
      indentWidth -
      // The content (with padding):
      PdfWriter.PREFIX_CELL_WIDTH -
      // The content (no padding):
      2 * this._defaultPadding +
      // autotable adds +1 to the allowed wrapping width to account for rounding.
      roundWidth;

    // splitTextToSize needs the correct font setting for calculation.
    // We could pass it through its options param, but options.font would have to come from jspdf's getFont anyway.
    this._doc.setFontSize(PdfWriter.CONTENT_FONT_SIZE);
    this._doc.setFont(PdfWriter.DEFAULT_FONT_NAME, PdfWriter.NORMAL_FONT_STYLE);

    // Actually calculate the text wrapping so we know how many lines the cell will take.
    const splitText = this._doc.splitTextToSize(text, contentWidth);
    const numLines = splitText.length;

    const lineHeight = this._doc.getLineHeight() / this._scaleFactor;
    const textHeight = numLines * lineHeight;
    const cellHeight = textHeight + 2 * this._defaultPadding;

    if (PdfWriter.DEBUG_LAYOUT) {
      console.log(`Text "${text}": numLines=${numLines}; cellHeight=${cellHeight}`);
    }

    return [splitText, cellHeight];
  }

  private _addPageFooters() {
    if (!this._doc) return;

    const pageCount = this._doc.internal.pages.length - 1;

    const firstNumberedPage = this._options?.outputCoverPage ? 2 : 1;
    for (let i = firstNumberedPage; i <= pageCount; i++) {
      this._doc.setPage(i);
      this._setCurrentY(this._footNoteY);
      this._addCenteredText(`Page ${i} of ${pageCount}`, PdfWriter.FOOTNOTE_HEIGHT, PdfWriter.FOOTNOTE_FONT_SIZE);
    }
  }

  private _setCurrentY(y: number) {
    this._currentY = y;
  }

  private _newPage() {
    this._doc?.addPage();
    this._setCurrentY(0);
  }

  private _addCenteredText(txt: string, advanceY: number, fontSize?: number, fontStyle?: string) {
    if (!this._doc) return;

    this._doc.saveGraphicsState();
    if (fontSize) {
      this._doc.setFontSize(fontSize);
    }
    this._doc.setFont(PdfWriter.DEFAULT_FONT_NAME, fontStyle);
    this._doc.text(txt, this._pageWidth / 2, this._currentY, { align: 'center' });
    this._doc.restoreGraphicsState();

    this._currentY += advanceY;
  }
}
