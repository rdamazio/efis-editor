import { jsPDF, jsPDFOptions, TextOptionsLight } from 'jspdf';
import autoTable, { CellDef, CellHookData, FontStyle, MarginPadding, RowInput, UserOptions } from 'jspdf-autotable';
import 'svg2pdf.js';
import {
  Checklist,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import { FormatError } from './error';

type OrientationType = jsPDFOptions['orientation'];
type FormatType = jsPDFOptions['format'];
type BaselineType = TextOptionsLight['baseline'];
type AutoTabledPDF = jsPDF & { lastAutoTable: { finalY: number } };
interface CellPaddingInputStructured {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface PdfWriterOptions {
  orientation?: OrientationType;

  // Must be a valid page size string, or 'custom'.
  pageSize?: string;
  // Custom page sizes are specified in inches.
  customPageWidth?: number;
  customPageHeight?: number;

  // Units for the 4 margin values below. Defaults to 'percent'.
  marginUnits?: 'percent' | 'in' | 'mm';
  marginLeft?: number;
  marginRight?: number;
  marginBottom?: number;
  marginTop?: number;

  // Whether group titles should be centered on the area *below* the margin.
  // This makes sense when the margin will be used for spiral binding or similar.
  marginOffsetsGroupTitle?: boolean;

  outputCoverPage?: boolean;
  outputGroupCoverPages?: boolean;
  outputPageNumbers?: boolean;
}

export const DEFAULT_OPTIONS: PdfWriterOptions = {
  orientation: 'portrait',
  pageSize: 'letter',
  customPageWidth: 8.5,
  customPageHeight: 11,
  marginUnits: 'percent',
  marginLeft: 7,
  marginRight: 7,
  marginBottom: 7,
  marginTop: 7,
  marginOffsetsGroupTitle: false,
  outputCoverPage: true,
  outputGroupCoverPages: false,
  outputPageNumbers: true,
};

interface IconToDraw {
  name: string;
  page: number;
  x: number;
  y: number;
}

export class PdfWriter {
  private static readonly DEBUG_LAYOUT = false;
  private static readonly INCHES_TO_EM = 6;
  private static readonly MM_TO_EM = this.INCHES_TO_EM * 25.4;
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

  private static readonly ICON_SIZE = 1.5;
  private static readonly ICON_MARGIN = 0.3;
  private static readonly ICON_TOTAL_SIZE = this.ICON_SIZE + this.ICON_MARGIN;
  private static readonly WARNING_ICON = 'assets/warning-icon.svg';
  private static readonly CAUTION_ICON = 'assets/caution-icon.svg';
  private static readonly ALL_ICONS = [this.WARNING_ICON, this.CAUTION_ICON];

  private static readonly WARNING_PREFIX = 'WARNING: ';
  private static readonly CAUTION_PREFIX = 'CAUTION: ';
  private static readonly NOTE_PREFIX = 'NOTE: ';
  private static readonly PREFIX_CELL_WIDTH = 5.6 + this.ICON_TOTAL_SIZE;

  private static readonly SPACER_CELL: CellDef = {
    content: '. '.repeat(100),
    styles: { overflow: 'hidden', halign: 'center' },
  };

  private _doc?: AutoTabledPDF;
  private _pageWidth = 0;
  private _pageHeight = 0;
  private _lineHeightFactor = 0;
  private _scaleFactor = 0;
  private _tableMargin: MarginPadding = { left: 0, right: 0, top: 0, bottom: 0 };
  private _footNoteY = 0;
  private _defaultPadding = 0;
  private _defaultCellPadding?: CellPaddingInputStructured;

  // Persistent cache so icons are only fetched once.
  private static readonly ICON_CACHE = new Map<string, Element>();
  // Per-instance promise of icons being fetched.
  private readonly _allIcons: Promise<Map<string, Element>>;
  private readonly _icons: IconToDraw[] = [];

  private _currentY = 0;
  private readonly _darkBackgroundPages: number[] = [];

  constructor(private readonly _options: PdfWriterOptions = DEFAULT_OPTIONS) {
    this._allIcons = this._fetchIcons();
  }

  public async write(file: ChecklistFile): Promise<Blob> {
    const doc = new jsPDF(this._pdfOptions());
    this._doc = doc as AutoTabledPDF;

    // Letter gives 51x66, A4 gives 49.6077x70.1575
    this._pageHeight = this._doc.internal.pageSize.getHeight();
    this._pageWidth = this._doc.internal.pageSize.getWidth();
    this._lineHeightFactor = this._doc.getLineHeightFactor();
    this._scaleFactor = this._doc.internal.scaleFactor;
    this._defaultPadding = 5 / this._scaleFactor;
    this._tableMargin = this._tableMarginFromOptions();

    this._footNoteY = this._pageHeight - this._tableMargin.bottom / 2;

    console.debug(
      `PDF: page w=${this._pageWidth}, h=${this._pageHeight}, sf=${this._scaleFactor}, margin=${JSON.stringify(this._tableMargin)}, footnote=${this._footNoteY}, pad=${this._defaultPadding}`,
    );
    this._defaultCellPadding = {
      left: this._defaultPadding,
      top: this._defaultPadding,
      bottom: this._defaultPadding,
      right: this._defaultPadding,
    };

    this._doc.addFont('assets/Roboto-Regular.ttf', PdfWriter.DEFAULT_FONT_NAME, PdfWriter.NORMAL_FONT_STYLE);
    this._doc.addFont('assets/Roboto-Bold.ttf', PdfWriter.DEFAULT_FONT_NAME, PdfWriter.BOLD_FONT_STYLE);
    this._doc.setFont(PdfWriter.DEFAULT_FONT_NAME, PdfWriter.BOLD_FONT_STYLE);

    if (file.metadata && this._options.outputCoverPage) {
      this._addCover(file.metadata);
    }
    this._addGroups(file.groups);

    if (this._options.outputPageNumbers) {
      this._addPageFooters();
    }

    await this._addIcons();

    return this._doc.output('blob');
  }

  private _pdfOptions(): jsPDFOptions {
    let format: FormatType;
    let orientation: OrientationType;
    if (this._options.pageSize === 'custom') {
      const width = this._options.customPageWidth;
      const height = this._options.customPageHeight;
      if (!width || !height) {
        throw new FormatError(`Invalid custom page size specified: ${width} x ${height}`);
      }

      // Custom page size was specified in inches, convert to em.
      format = [width * PdfWriter.INCHES_TO_EM, height * PdfWriter.INCHES_TO_EM];
      orientation = height > width ? 'portrait' : 'landscape';
      console.debug(`Custom page size: [${format}], ${orientation}`);
    } else {
      format = this._options.pageSize;
      orientation = this._options.orientation;
    }

    return {
      format: format,
      orientation: orientation,
      unit: 'em',
      putOnlyUsedFonts: true,
    };
  }

  private _tableMarginFromOptions(): MarginPadding {
    const left = this._options.marginLeft ?? 0;
    const right = this._options.marginRight ?? 0;
    const top = this._options.marginTop ?? 0;
    const bottom = this._options.marginBottom ?? 0;

    switch (this._options.marginUnits ?? 'percent') {
      case 'percent':
        return {
          left: (this._pageWidth * left) / 100,
          right: (this._pageWidth * right) / 100,
          top: (this._pageWidth * top) / 100,
          bottom: (this._pageWidth * bottom) / 100,
        };
      case 'in':
        return {
          left: PdfWriter.INCHES_TO_EM * left,
          right: PdfWriter.INCHES_TO_EM * right,
          top: PdfWriter.INCHES_TO_EM * top,
          bottom: PdfWriter.INCHES_TO_EM * bottom,
        };
      case 'mm':
        return {
          left: PdfWriter.MM_TO_EM * left,
          right: PdfWriter.MM_TO_EM * right,
          top: PdfWriter.MM_TO_EM * top,
          bottom: PdfWriter.MM_TO_EM * bottom,
        };
    }
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

    this._setCurrentY(this._footNoteY);
    this._addCenteredText(
      'Generated by https://github.com/rdamazio/efis-editor/',
      PdfWriter.FOOTNOTE_HEIGHT,
      PdfWriter.FOOTNOTE_FONT_SIZE,
    );
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

  private _addGroupTitle(group: ChecklistGroup, height: number): { usedDarkBackground: boolean } {
    if (!this._doc) return { usedDarkBackground: false };

    console.debug(`PDF: Group ${group.title}`);

    this._doc.saveGraphicsState();
    let darkBackground = true;
    let rectColor = 'blue';
    let textColor = 'white';
    if (group.category === ChecklistGroup_Category.abnormal) {
      rectColor = 'orange';
      textColor = 'black';
      darkBackground = false;
    } else if (group.category === ChecklistGroup_Category.emergency) {
      rectColor = 'red';
    }
    this._doc.setFillColor(rectColor);
    this._doc.setTextColor(textColor);
    this._doc.rect(0, 0, this._pageWidth, height, PdfWriter.RECT_FILL_STYLE);

    // ---------------------------
    // Margin                    | marginOffset  \
    // | _ textTopY              \               |
    // Title                     | usableHeight  | height
    // | ‾ textBaseY             /               /
    // ---------
    const marginOffset = this._options.marginOffsetsGroupTitle ? this._tableMargin.top : 0;
    const usableHeight = height - marginOffset;
    const usableCenterY = marginOffset + usableHeight / 2;
    console.debug(`PDF: Title height=${height}; usable=${usableHeight}; usableCenter=${usableCenterY}`);
    this._setCurrentY(usableCenterY);
    this._addCenteredText(
      group.title,
      usableCenterY,
      PdfWriter.GROUP_TITLE_FONT_SIZE,
      PdfWriter.BOLD_FONT_STYLE,
      'middle',
    );

    this._doc.restoreGraphicsState();
    return { usedDarkBackground: darkBackground };
  }

  private _addGroup(group: ChecklistGroup) {
    if (!this._doc) return;

    let titleOffset = 0;
    if (this._options.outputGroupCoverPages) {
      const { usedDarkBackground } = this._addGroupTitle(group, this._pageHeight);
      if (usedDarkBackground) {
        this._darkBackgroundPages.push(this._doc.getCurrentPageInfo().pageNumber);
      }
      this._newPage();
    } else {
      titleOffset = PdfWriter.GROUP_TITLE_HEIGHT * 2;
      if (this._options.marginOffsetsGroupTitle) {
        titleOffset += this._tableMargin.top;
      }
      this._addGroupTitle(group, titleOffset - 1);
    }

    let first = true;
    for (const checklist of group.checklists) {
      console.debug(`PDF: Checklist ${checklist.title}`);

      // Calculate where to start the next table.
      let startY = this._tableMargin.top;
      if (first) {
        startY = titleOffset || this._tableMargin.top;
        first = false;
      } else {
        const lastY = this._doc.lastAutoTable.finalY;
        if (lastY > this._pageHeight / 2) {
          // More than half the page is already used, start on the next page.
          this._newPage();
        } else {
          startY = lastY + 2;
        }
      }

      const firstPageNumber = this._doc.getCurrentPageInfo().pageNumber;
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
        styles: PdfWriter.DEBUG_LAYOUT // eslint-disable-line @typescript-eslint/no-unnecessary-condition
          ? { lineWidth: 0.1 }
          : undefined,
        bodyStyles: { fontSize: PdfWriter.CONTENT_FONT_SIZE, valign: 'top' },
        didDrawCell: (data: CellHookData) => {
          this._drawPrefixedCell(data, firstPageNumber);
        },
      });
    }
  }

  private _checklistTableBody(checklist: Checklist): RowInput[] {
    return checklist.items.map((item: ChecklistItem) => this._itemToCells(item));
  }

  private _itemToCells(item: ChecklistItem): CellDef[] {
    if (!this._doc) return [];

    const cells: CellDef[] = [];
    const prompt: CellDef = { content: item.prompt, styles: { halign: 'left', minCellWidth: 10 } };

    // We should be able to have the prefix in its own cell and have non-prefixed rows use a colSpan=2 for the prompt,
    // but unfortunately a bug in jspdf-autotable prevents that:
    // https://github.com/simonbengtsson/jsPDF-AutoTable/issues/686
    let prefix: string | undefined;
    switch (item.type) {
      case ChecklistItem_Type.ITEM_TITLE:
        prompt.styles!.fontStyle = PdfWriter.BOLD_FONT_STYLE;
        break;
      case ChecklistItem_Type.ITEM_SPACE:
        prompt.styles!.fillColor = 255;
        prompt.styles!.minCellHeight = this._doc.getLineHeight() / this._scaleFactor;
        break;
      case ChecklistItem_Type.ITEM_WARNING:
        prefix = PdfWriter.WARNING_PREFIX;
        break;
      case ChecklistItem_Type.ITEM_CAUTION:
        prefix = PdfWriter.CAUTION_PREFIX;
        break;
      case ChecklistItem_Type.ITEM_NOTE:
        prefix = PdfWriter.NOTE_PREFIX;
        break;
      default:
        // Keep the defaults.
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
      const expectation: CellDef = { content: item.expectation, styles: { halign: 'left' } };
      cells.push(prompt, PdfWriter.SPACER_CELL, expectation);
    } else {
      prompt.colSpan = 3;
      if (prefix) {
        // Must precalculate height to make sure text can be re-wrapped during didDrawCell.
        // Also, to avoid weird mismatches between the pre-calculated wrapping and the actual one,
        // use the pre-calculated one as the actual contents.
        const prefixed = this._calculatePrefixedCell(item.prompt, item.indent);
        prompt.content = prefix + prefixed.lines.join('\n');
        prompt.styles!.minCellHeight = prefixed.height;
      }
      cells.push(prompt);
    }

    console.debug('PDF:', cells);

    return cells;
  }

  private _drawPrefixedCell(data: CellHookData, firstPageNumber: number) {
    if (data.section !== 'body') return;
    if (data.column.index !== 0) return;

    // Determine item type by the textual prefix.
    // Caveat: If we had a plaintext field where the text starts with these prefixes,
    // we'd also format that - that's probably OK.
    const firstLine = data.cell.text[0];
    if (!firstLine) return;

    let icon: string | undefined;
    let prefix: string | undefined;
    let prefixFontStyle: FontStyle = PdfWriter.NORMAL_FONT_STYLE;
    let prefixColor = 'black';
    if (firstLine.startsWith(PdfWriter.WARNING_PREFIX)) {
      icon = PdfWriter.WARNING_ICON;
      prefix = PdfWriter.WARNING_PREFIX;
      prefixFontStyle = PdfWriter.BOLD_FONT_STYLE;
      prefixColor = 'orange';
    } else if (firstLine.startsWith(PdfWriter.CAUTION_PREFIX)) {
      icon = PdfWriter.CAUTION_ICON;
      prefix = PdfWriter.CAUTION_PREFIX;
      prefixFontStyle = PdfWriter.BOLD_FONT_STYLE;
      prefixColor = 'red';
    } else if (firstLine.startsWith(PdfWriter.NOTE_PREFIX)) {
      prefix = PdfWriter.NOTE_PREFIX;
    }
    if (!prefix) {
      // Non-prefixed cell.
      return;
    }

    data.cell.text[0] = firstLine.slice(prefix.length);
    const contents = data.cell.text.join(' ');

    let leftPadding = data.cell.padding('left');
    let tableWidth = data.cell.width;
    const margin = { ...this._tableMargin };

    if (data.cell.styles.halign === 'center') {
      // We'll center the entire table instead of the content cell.
      data.cell.styles.halign = 'left';
      leftPadding = 0;
      const textWidth = this._textWidth(data.cell.text);
      tableWidth = PdfWriter.PREFIX_CELL_WIDTH + textWidth + 2 * this._defaultPadding;
      const outerTableWidth = this._pageWidth - this._tableMargin.left - this._tableMargin.right;
      const innerMargins = (outerTableWidth - tableWidth) / 2;
      margin.left += innerMargins;
      margin.right += innerMargins;

      console.debug(`PDF: Centered: textW=${textWidth}, tableWidth=${tableWidth}, text="${contents}"`);
    }

    // Draw a nested table for the prefixed item.
    // This draws over the existing cell but does not replace it.
    const options: UserOptions = {
      body: [
        [
          {
            // Use a separate cell for indentation with varying padding
            // so we can use a fixed-width left-aligned prefix cell below.
            content: '',
            styles: { cellWidth: leftPadding, cellPadding: 0 },
          },
          {
            content: prefix.trim(),
            styles: {
              cellWidth: PdfWriter.PREFIX_CELL_WIDTH,
              cellPadding: { ...this._defaultCellPadding, left: PdfWriter.ICON_TOTAL_SIZE },
              halign: 'right',
              fontStyle: prefixFontStyle,
              textColor: prefixColor,
            },
          },
          { content: contents.trim(), styles: { cellPadding: this._defaultCellPadding } },
        ],
      ],
      startY: data.cell.y,
      alternateRowStyles: undefined,
      margin: margin,
      theme: 'plain',
      styles: {
        ...data.cell.styles,
        // Using the right fill color apparently depends on this being set.
        lineWidth: PdfWriter.DEBUG_LAYOUT ? 0.1 : 0, // eslint-disable-line @typescript-eslint/no-unnecessary-condition
        minCellWidth: undefined,
        halign: 'left',
      },
      tableWidth: tableWidth,
    };
    console.debug('PDF: Drawing prefixed cell: ', options);
    autoTable(this._doc, options);

    if (icon) {
      // Icon drawing is asynchronous, and we're in a synchronous autotable callback, so just collect what needs to be
      // drawn, for now.
      this._icons.push({
        name: icon,
        page: firstPageNumber + data.pageNumber - 1,
        // Position to the left of the text.
        x: margin.left + leftPadding,
        // Position at the top of the cell.
        y: data.cell.y + PdfWriter.ICON_MARGIN / 2,
      });
    }

    data.cell.text = [];
  }

  private async _addIcons() {
    if (!this._doc) return;

    console.debug('PDF: Icons=', this._icons);
    const allIcons = await this._allIcons;
    for (const icon of this._icons) {
      const iconEl = allIcons.get(icon.name);
      if (!iconEl) continue;

      this._doc.setPage(icon.page);

      // jsPDF's addSvgAsImage is broken (wrong signature, rasterizes the SVG, etc.), so we use svg2pdf instead.
      // svg2pdf relies on jspdf's state machine, so we have to await for each one instead of
      // letting them work in parallel.
      // eslint-disable-next-line no-await-in-loop
      await this._doc.svg(iconEl, { x: icon.x, y: icon.y, width: PdfWriter.ICON_SIZE, height: PdfWriter.ICON_SIZE });
    }
  }

  private async _fetchIcons(): Promise<Map<string, Element>> {
    const cache = PdfWriter.ICON_CACHE;

    const parser = new DOMParser();
    const allFetches: Promise<[string, Element]>[] = [];
    for (const icon of PdfWriter.ALL_ICONS) {
      if (cache.has(icon)) continue;

      allFetches.push(
        fetch(icon)
          .then(async (resp: Response) => {
            if (!resp.ok) {
              throw new Error(`Failed to fetch icon '${icon}'`);
            }
            return resp.text();
          })
          .then((iconData: string) => {
            console.debug(`PDF: Fetched icon '${icon}', size ${iconData.length}`);
            const iconElement = parser.parseFromString(iconData, 'image/svg+xml').firstElementChild;
            if (!iconElement) {
              throw new Error(`Failed to parse icon '${icon}'`);
            }
            return [icon, iconElement];
          }),
      );
    }

    return Promise.allSettled(allFetches).then((fetches) => {
      for (const result of fetches) {
        if (result.status !== 'fulfilled') {
          console.warn('PDF: ', result.reason);
          continue;
        }

        const [icon, iconEl] = result.value;
        cache.set(icon, iconEl);
      }

      return cache;
    });
  }

  private _indentPadding(indent: number) {
    return indent + this._defaultPadding;
  }

  private _calculatePrefixedCell(text: string, indent: number): { lines: string[]; height: number } {
    if (!this._doc) throw new FormatError('No document created');

    const maxContentWidth = this._calculatePrefixedContentWidth(indent);

    // splitTextToSize needs the correct font setting for calculation.
    // We could pass it through its options param, but options.font would have to come from jspdf's getFont anyway.
    this._doc.setFontSize(PdfWriter.CONTENT_FONT_SIZE);
    this._doc.setFont(PdfWriter.DEFAULT_FONT_NAME, PdfWriter.NORMAL_FONT_STYLE);

    // Actually calculate the text wrapping so we know how many lines the cell will take.
    const splitText = this._doc.splitTextToSize(text, maxContentWidth) as string[];
    const numLines = splitText.length;

    const lineHeight = this._doc.getLineHeight() / this._scaleFactor;
    const textHeight = numLines * lineHeight;
    const cellHeight = textHeight + 2 * this._defaultPadding;

    console.debug(`PDF: Text "${text}": numLines=${numLines}; cellHeight=${cellHeight}; maxWidth=${maxContentWidth}`);

    return { lines: splitText, height: cellHeight };
  }

  private _calculatePrefixedContentWidth(indent: number): number {
    const indentWidth = this._indentPadding(indent);
    // autotable adds +1 to the allowed wrapping width to account for rounding:
    // https://github.com/simonbengtsson/jsPDF-AutoTable/blob/cd107726591d01a315d158bb827191928e1964b5/src/widthCalculator.ts#L302
    const roundWidth = 1.0 / this._scaleFactor;

    console.debug(
      `PDF: Prefixed width: page=${this._pageWidth}; indent=${indentWidth}; prefix=${PdfWriter.PREFIX_CELL_WIDTH}; padding=${this._defaultPadding}`,
    );

    // Calculate the cell width that's available for the text contents
    return (
      // The whole page:
      this._pageWidth -
      // The whole table:
      this._tableMargin.left -
      this._tableMargin.right -
      // The prefix + content (with padding):
      indentWidth -
      // The content (with padding):
      PdfWriter.PREFIX_CELL_WIDTH -
      // The content (no padding):
      2 * this._defaultPadding +
      // The content (with rounding):
      roundWidth
    );
  }

  private _textWidth(lines: string[], fontSize?: number): number {
    // Calculate total width as the width of the longest line.
    const unitWidth = lines.reduce((max: number, line: string) => {
      const width = this._doc!.getStringUnitWidth(line);
      console.debug(`PDF: Width=${width} for line "${line}"`);
      return Math.max(max, width);
    }, 0);
    return (unitWidth * (fontSize ?? PdfWriter.CONTENT_FONT_SIZE)) / this._scaleFactor;
  }

  private _addPageFooters() {
    if (!this._doc) return;

    const pageCount = this._doc.internal.pages.length - 1;

    const firstNumberedPage = this._options.outputCoverPage ? 2 : 1;
    for (let i = firstNumberedPage; i <= pageCount; i++) {
      this._doc.setPage(i);
      this._setCurrentY(this._footNoteY);
      this._doc.saveGraphicsState();
      if (this._darkBackgroundPages.includes(i)) {
        this._doc.setTextColor('white');
      }
      this._addCenteredText(`Page ${i} of ${pageCount}`, PdfWriter.FOOTNOTE_HEIGHT, PdfWriter.FOOTNOTE_FONT_SIZE);
      this._doc.restoreGraphicsState();
    }
  }

  private _setCurrentY(y: number) {
    this._currentY = y;
  }

  private _newPage() {
    this._doc?.addPage();
    this._setCurrentY(0);
  }

  private _addCenteredText(
    txt: string,
    advanceY: number,
    fontSize?: number,
    fontStyle?: string,
    baseline?: BaselineType,
  ) {
    if (!this._doc) return;

    this._doc.saveGraphicsState();
    if (fontSize !== undefined) {
      this._doc.setFontSize(fontSize);
    }
    this._doc.setFont(PdfWriter.DEFAULT_FONT_NAME, fontStyle);
    const tableWidth = this._pageWidth - this._tableMargin.left - this._tableMargin.right;
    const center = this._tableMargin.left + tableWidth / 2;
    this._doc.text(txt, center, this._currentY, { align: 'center', baseline: baseline ?? 'alphabetic' });
    this._doc.restoreGraphicsState();

    this._currentY += advanceY;
  }
}
