import { jsPDF, jsPDFOptions, TextOptionsLight } from 'jspdf';
import autoTable, {
  CellDef,
  CellHookData,
  FontStyle,
  HookData,
  MarginPadding,
  RowInput,
  UserOptions,
} from 'jspdf-autotable';
import 'svg2pdf.js';
import {
  Checklist,
  Checklist_CompletionAction,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import { ExportOptions } from './abstract-format';
import { FormatError } from './error';

type OrientationType = jsPDFOptions['orientation'];
type FormatType = jsPDFOptions['format'];
type BaselineType = TextOptionsLight['baseline'];
type AutoTabledPDF = jsPDF & { lastAutoTable: { finalY: number } };

interface CenteredTextOptions {
  advanceY: number;
  fontSize?: number;
  fontStyle?: string;
  baseline?: BaselineType;
  useColumnWidth?: boolean;
}

export interface PdfWriterOptions extends ExportOptions {
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
  outputCompletionActions?: boolean;

  // Where each checklist should start.
  checklistStart?: 'page' | 'column' | 'below';

  // Number of columns to lay out consecutive checklists internally on the page.
  columns?: number;

  // Percentage multiplier for checklist content and group headers font sizes.
  // E.g., 100 is normal size, 150 is 50% larger.
  fontSizePercent?: number;
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
  outputCompletionActions: true,
  checklistStart: 'below',
  columns: 1,
  fontSizePercent: 100,
};

// Precalculated, option-dependent dimensions used for drawing the PDF.
interface DrawingDimensions {
  // Overall page parameters.
  pageWidth: number;
  pageHeight: number;
  innerPageHeight: number;
  scaleFactor: number;
  columns: number;
  columnWidth: number;
  availableColumnWidth: number;
  gutterWidth: number;
  footNoteY: number;

  // Table layout parameters.
  defaultPadding: number;
  tableMargin: MarginPadding;
  defaultCellPadding: MarginPadding;

  // Group title parameters.
  groupBackgroundWidth: number;
  groupTitleWidth: number;

  // Font parameters.
  fontSizeScale: number;
  groupTitleFontSize: number;
  headerFontSize: number;
  contentFontSize: number;

  // Prefix cell parameters.
  iconSize: number;
  iconTotalSize: number;
  prefixCellWidth: number;
}

interface IconToDraw {
  name: string;
  page: number;
  x: number;
  y: number;
}

export class PdfWriter {
  private static readonly DEBUG_LAYOUT = false;
  private static readonly INCHES_TO_EM = 6;
  private static readonly MM_TO_EM = this.INCHES_TO_EM / 25.4;
  private static readonly GROUP_TITLE_HEIGHT = 3;
  private static readonly GROUP_TITLE_BASE_FONT_SIZE = 20;
  private static readonly MAIN_TITLE_FONT_SIZE = 30;
  private static readonly METADATA_HEADER_FONT_SIZE = 12;
  private static readonly METADATA_HEADER_HEIGHT = 2;
  private static readonly METADATA_VALUE_FONT_SIZE = 20;
  private static readonly METADATA_VALUE_HEIGHT = 3;
  private static readonly HEADER_BASE_FONT_SIZE = 16;
  private static readonly CONTENT_BASE_FONT_SIZE = 12;
  private static readonly FOOTNOTE_HEIGHT = 1;
  private static readonly FOOTNOTE_FONT_SIZE = 8;
  private static readonly DEFAULT_FONT_NAME = 'Roboto-Regular';
  private static readonly NORMAL_FONT_STYLE = 'normal';
  private static readonly BOLD_FONT_STYLE = 'bold';
  private static readonly RECT_FILL_STYLE = 'F';

  private static readonly ICON_BASE_SIZE = 1.5;
  private static readonly ICON_BASE_MARGIN = 0.3;
  private static readonly ICON_BASE_TOTAL_SIZE = PdfWriter.ICON_BASE_SIZE + PdfWriter.ICON_BASE_MARGIN;
  private static readonly WARNING_ICON = 'warning-icon.svg';
  private static readonly CAUTION_ICON = 'caution-icon.svg';
  private static readonly ALL_ICONS = [this.WARNING_ICON, this.CAUTION_ICON];

  private static readonly WARNING_PREFIX = 'WARNING: ';
  private static readonly CAUTION_PREFIX = 'CAUTION: ';
  private static readonly NOTE_PREFIX = 'NOTE: ';

  private static readonly SPACER_CELL: CellDef = {
    content: '. '.repeat(100),
    styles: { overflow: 'hidden', halign: 'center' },
  };

  // Persistent cache so icons are only fetched once.
  private static readonly ICON_CACHE = new Map<string, Element>();

  // Per-instance promise of icons being fetched.
  private readonly _allIcons: Promise<Map<string, Element>>;

  private readonly _init: Promise<void>;
  private readonly _doc: AutoTabledPDF;
  private readonly _addPhysicalPage?: typeof jsPDF.prototype.addPage;

  private readonly _dims: DrawingDimensions;

  // Drawing state
  private _currentColumn = 0;
  private _currentY = 0;
  private readonly _icons: IconToDraw[] = [];
  // List of page numbers that have dark backgrounds (to use a light font color).
  private readonly _darkBackgroundPages: number[] = [];

  constructor(private readonly _options: PdfWriterOptions = DEFAULT_OPTIONS) {
    this._allIcons = this._fetchIcons();

    const doc = new jsPDF(this._pdfOptions());
    this._doc = doc as AutoTabledPDF;

    // Because autotable directly calls addPage, we need to wrap it to
    // support multiple columns.
    this._addPhysicalPage = this._doc.addPage.bind(this._doc);
    this._doc.addPage = () => {
      this._newPage();
      return this._doc;
    };

    this._dims = this._initStaticDimensions();

    // We have to fetch the font files ourselves to support offline mode, else jspdf will use its own
    // service worker and skip our cache.
    this._init = Promise.all([
      this._registerFont('Roboto-Regular.ttf', PdfWriter.DEFAULT_FONT_NAME, PdfWriter.NORMAL_FONT_STYLE),
      this._registerFont('Roboto-Bold.ttf', PdfWriter.DEFAULT_FONT_NAME, PdfWriter.BOLD_FONT_STYLE),
    ]).then(() => {
      this._initFontDimensions();
    });
  }

  public async write(file: ChecklistFile): Promise<Blob> {
    await this._init;

    console.debug(`PDF: dimensions=${JSON.stringify(this._dims)}`);

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

  private async _registerFont(fileName: string, fontName: string, fontStyle: string) {
    const contents = await fetch(fileName).then(async (resp: Response) => {
      if (!resp.ok) {
        throw new Error(`Failed to fetch font'${fileName}'`);
      }
      return resp.bytes();
    });

    const contentsBase64 = Buffer.from(contents).toString('base64');
    this._doc.addFileToVFS(fileName, contentsBase64);
    this._doc.addFont(fileName, fontName, fontStyle);
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

  private _initStaticDimensions(): DrawingDimensions {
    const dimensions: Partial<DrawingDimensions> = {};

    // Letter gives 51x66, A4 gives 49.6077x70.1575
    dimensions.pageHeight = this._doc.internal.pageSize.getHeight();
    dimensions.pageWidth = this._doc.internal.pageSize.getWidth();
    dimensions.scaleFactor = this._doc.internal.scaleFactor;
    dimensions.defaultPadding = 5 / dimensions.scaleFactor;
    dimensions.tableMargin = this._tableMarginFromOptions(dimensions.pageWidth);
    dimensions.columns = this._options.columns ?? 1;

    dimensions.defaultCellPadding = {
      left: dimensions.defaultPadding,
      top: dimensions.defaultPadding,
      bottom: dimensions.defaultPadding,
      right: dimensions.defaultPadding,
    };

    dimensions.gutterWidth = dimensions.pageWidth * 0.02; // 2% gutter
    const totalGutterWidth = dimensions.gutterWidth * (dimensions.columns - 1);
    const availableWidth =
      dimensions.pageWidth - dimensions.tableMargin.left - dimensions.tableMargin.right - totalGutterWidth;
    dimensions.availableColumnWidth = availableWidth / dimensions.columns;
    dimensions.columnWidth = dimensions.availableColumnWidth + dimensions.gutterWidth;

    dimensions.innerPageHeight = dimensions.pageHeight - dimensions.tableMargin.top - dimensions.tableMargin.bottom;
    dimensions.footNoteY = dimensions.pageHeight - dimensions.tableMargin.bottom / 2;

    // We want to draw the background rectable over the whole column, even the margin and gutter.
    dimensions.groupBackgroundWidth = this._options.outputGroupCoverPages
      ? dimensions.pageWidth
      : dimensions.tableMargin.left + dimensions.columnWidth - dimensions.gutterWidth / 2;
    dimensions.groupTitleWidth =
      dimensions.groupBackgroundWidth - dimensions.defaultCellPadding.left - dimensions.defaultCellPadding.right;

    dimensions.fontSizeScale = (this._options.fontSizePercent ?? 100) / 100;
    dimensions.groupTitleFontSize = PdfWriter.GROUP_TITLE_BASE_FONT_SIZE * dimensions.fontSizeScale;
    dimensions.headerFontSize = PdfWriter.HEADER_BASE_FONT_SIZE * dimensions.fontSizeScale;
    dimensions.contentFontSize = PdfWriter.CONTENT_BASE_FONT_SIZE * dimensions.fontSizeScale;

    dimensions.iconSize = PdfWriter.ICON_BASE_SIZE * dimensions.fontSizeScale;
    dimensions.iconTotalSize = PdfWriter.ICON_BASE_TOTAL_SIZE * dimensions.fontSizeScale;

    // This is technically missing fields set in initFontDimensions, but _init guarantees
    // they'll be set before they're used.
    return dimensions as DrawingDimensions;
  }

  private _initFontDimensions() {
    this._doc.setFontSize(this._dims.contentFontSize);
    this._doc.setFont(PdfWriter.DEFAULT_FONT_NAME, PdfWriter.BOLD_FONT_STYLE);

    // We know that "WARNING:" will be the widest prefix.
    const warningWidth = this._textWidth(
      [PdfWriter.WARNING_PREFIX],
      this._dims.contentFontSize,
      this._dims.scaleFactor,
    );
    this._dims.prefixCellWidth =
      warningWidth +
      this._dims.iconTotalSize +
      this._dims.defaultCellPadding.left +
      this._dims.defaultCellPadding.right;
  }

  private _tableMarginFromOptions(pageWidth: number): MarginPadding {
    const left = this._options.marginLeft ?? 0;
    const right = this._options.marginRight ?? 0;
    const top = this._options.marginTop ?? 0;
    const bottom = this._options.marginBottom ?? 0;

    switch (this._options.marginUnits ?? 'percent') {
      case 'percent':
        return {
          left: (pageWidth * left) / 100,
          right: (pageWidth * right) / 100,
          top: (pageWidth * top) / 100,
          bottom: (pageWidth * bottom) / 100,
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

  private _getColumnMarginLeft(): number {
    return (
      this._dims.tableMargin.left + this._currentColumn * (this._dims.availableColumnWidth + this._dims.gutterWidth)
    );
  }

  private _getColumnMarginRight(): number {
    return (
      this._dims.tableMargin.right +
      (this._dims.columns - 1 - this._currentColumn) * (this._dims.availableColumnWidth + this._dims.gutterWidth)
    );
  }

  private _addCover(metadata: ChecklistFileMetadata) {
    // Center the title at the top half.
    this._setCurrentY(this._dims.tableMargin.top + this._dims.innerPageHeight / 4);
    this._addCenteredText('Checklists', {
      advanceY: 0,
      fontSize: PdfWriter.MAIN_TITLE_FONT_SIZE,
      fontStyle: PdfWriter.BOLD_FONT_STYLE,
    });

    // Center the metadata at the bottom half.
    let metadataHeight = 0;
    if (metadata.aircraftInfo) metadataHeight += PdfWriter.METADATA_HEADER_HEIGHT + PdfWriter.METADATA_VALUE_HEIGHT;
    if (metadata.makeAndModel) metadataHeight += PdfWriter.METADATA_HEADER_HEIGHT + PdfWriter.METADATA_VALUE_HEIGHT;
    if (metadata.manufacturerInfo) metadataHeight += PdfWriter.METADATA_HEADER_HEIGHT + PdfWriter.METADATA_VALUE_HEIGHT;
    if (metadata.copyrightInfo) metadataHeight += PdfWriter.METADATA_HEADER_HEIGHT + PdfWriter.METADATA_VALUE_HEIGHT;
    const metadataStartY = this._dims.tableMargin.top + (this._dims.innerPageHeight * 3) / 4 - metadataHeight / 2;
    this._setCurrentY(metadataStartY);

    if (metadata.aircraftInfo) {
      this._addCenteredText('Aircraft:', {
        advanceY: PdfWriter.METADATA_HEADER_HEIGHT,
        fontSize: PdfWriter.METADATA_HEADER_FONT_SIZE,
      });
      this._addCenteredText(metadata.aircraftInfo, {
        advanceY: PdfWriter.METADATA_VALUE_HEIGHT,
        fontSize: PdfWriter.METADATA_VALUE_FONT_SIZE,
        fontStyle: PdfWriter.BOLD_FONT_STYLE,
      });
    }
    if (metadata.makeAndModel) {
      this._addCenteredText('Aircraft make/model:', {
        advanceY: PdfWriter.METADATA_HEADER_HEIGHT,
        fontSize: PdfWriter.METADATA_HEADER_FONT_SIZE,
      });
      this._addCenteredText(metadata.makeAndModel, {
        advanceY: PdfWriter.METADATA_VALUE_HEIGHT,
        fontSize: PdfWriter.METADATA_VALUE_FONT_SIZE,
        fontStyle: PdfWriter.BOLD_FONT_STYLE,
      });
    }
    if (metadata.manufacturerInfo) {
      this._addCenteredText('Manufacturer:', {
        advanceY: PdfWriter.METADATA_HEADER_HEIGHT,
        fontSize: PdfWriter.METADATA_HEADER_FONT_SIZE,
      });
      this._addCenteredText(metadata.manufacturerInfo, {
        advanceY: PdfWriter.METADATA_VALUE_HEIGHT,
        fontSize: PdfWriter.METADATA_VALUE_FONT_SIZE,
        fontStyle: PdfWriter.BOLD_FONT_STYLE,
      });
    }
    if (metadata.copyrightInfo) {
      this._addCenteredText('Copyright:', {
        advanceY: PdfWriter.METADATA_HEADER_HEIGHT,
        fontSize: PdfWriter.METADATA_HEADER_FONT_SIZE,
      });
      this._addCenteredText(metadata.copyrightInfo, {
        advanceY: PdfWriter.METADATA_VALUE_HEIGHT,
        fontSize: PdfWriter.METADATA_VALUE_FONT_SIZE,
        fontStyle: PdfWriter.BOLD_FONT_STYLE,
      });
    }

    this._setCurrentY(this._dims.footNoteY);
    this._addCenteredText('Generated by https://github.com/rdamazio/efis-editor/', {
      advanceY: PdfWriter.FOOTNOTE_HEIGHT,
      fontSize: PdfWriter.FOOTNOTE_FONT_SIZE,
    });
    this._newPage(true);
  }

  private _addGroups(groups: ChecklistGroup[]) {
    for (const group of groups) {
      this._addGroup(group);

      // Force starting a new page for each group.
      this._newPage(true);
    }

    this._doc.deletePage(this._doc.internal.pages.length - 1);
  }

  private _addGroupTitle(group: ChecklistGroup, height: number): { usedDarkBackground: boolean } {
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
    this._doc.rect(0, 0, this._dims.groupBackgroundWidth, height, PdfWriter.RECT_FILL_STYLE);

    // ---------------------------
    // Margin                    | marginOffset  \
    // | _ textTopY              \               |
    // Title                     | usableHeight  | height
    // | ‾ textBaseY             /               /
    // ---------
    const marginOffset = this._options.marginOffsetsGroupTitle ? this._dims.tableMargin.top : 0;
    const usableHeight = height - marginOffset;
    const usableCenterY = marginOffset + usableHeight / 2;
    console.debug(`PDF: Title height=${height}; usable=${usableHeight}; usableCenter=${usableCenterY}`);

    this._doc.setFontSize(this._dims.groupTitleFontSize);
    const lines = this._doc.splitTextToSize(group.title, this._dims.groupTitleWidth) as string[];

    this._setCurrentY(usableCenterY);
    this._addCenteredText(lines, {
      advanceY: usableCenterY,
      fontSize: this._dims.groupTitleFontSize,
      fontStyle: PdfWriter.BOLD_FONT_STYLE,
      baseline: 'middle',
      useColumnWidth: !this._options.outputGroupCoverPages,
    });

    this._doc.restoreGraphicsState();
    return { usedDarkBackground: darkBackground };
  }

  private _addGroup(group: ChecklistGroup) {
    let titleOffset = 0;
    if (this._options.outputGroupCoverPages) {
      const { usedDarkBackground } = this._addGroupTitle(group, this._dims.pageHeight);
      if (usedDarkBackground) {
        this._darkBackgroundPages.push(this._doc.getCurrentPageInfo().pageNumber);
      }
      this._newPage(true);
    } else {
      this._doc.setFontSize(this._dims.groupTitleFontSize);
      const maxWidth = this._dims.availableColumnWidth - this._dims.defaultPadding * 4;
      const lines = this._doc.splitTextToSize(group.title, maxWidth) as string[];
      const addedHeight = ((lines.length - 1) * (this._dims.groupTitleFontSize * 1.5)) / this._dims.scaleFactor;

      titleOffset = PdfWriter.GROUP_TITLE_HEIGHT * 2 + addedHeight;
      if (this._options.marginOffsetsGroupTitle) {
        titleOffset += this._dims.tableMargin.top;
      } else if (titleOffset < this._dims.tableMargin.top) {
        // Ensure that the margin is respected for the table, even if they
        // want the group title to go there.
        titleOffset = this._dims.tableMargin.top;
      }
      this._addGroupTitle(group, titleOffset - 1);
    }

    let first = true;
    for (const checklist of group.checklists) {
      console.debug(`PDF: Checklist ${checklist.title}`);

      // Calculate where to start the next table.
      let startY = this._dims.tableMargin.top;
      if (first) {
        // First checklist in the group - offset by the group title height if needed.
        startY = titleOffset || this._dims.tableMargin.top;
        first = false;
      } else if (this._options.checklistStart === 'page') {
        // User requested a new physical page for each checklist.
        this._newPage(true);
      } else if (this._options.checklistStart === 'column') {
        // User requested a new column for each checklist.
        this._newPage(false);
      } else if (this._doc.lastAutoTable.finalY - this._dims.tableMargin.top > this._dims.innerPageHeight / 2) {
        // More than half the page is already used, start on the next column.
        this._newPage(false);
      } else {
        // Start on the same column, after the previous checklist.
        startY = this._doc.lastAutoTable.finalY + 2;
      }

      autoTable(this._doc, {
        // Actual columns are: prompt, spacer, expectation
        head: [
          [
            {
              content: checklist.title,
              colSpan: 3,
              styles: { halign: 'center', fontSize: this._dims.headerFontSize },
            },
          ],
        ],
        body: this._checklistTableBody(checklist),
        showHead: 'firstPage',
        margin: {
          left: this._getColumnMarginLeft(),
          right: this._getColumnMarginRight(),
          top: this._dims.tableMargin.top,
          bottom: this._dims.tableMargin.bottom,
        },
        startY: startY,
        rowPageBreak: 'avoid',
        styles: PdfWriter.DEBUG_LAYOUT // eslint-disable-line @typescript-eslint/no-unnecessary-condition
          ? { lineWidth: 0.1 }
          : undefined,
        bodyStyles: { fontSize: this._dims.contentFontSize, valign: 'top' },
        didDrawPage: (data: HookData) => {
          const nextColumn = (this._currentColumn + 1) % this._dims.columns;
          data.settings.margin.left =
            this._dims.tableMargin.left + nextColumn * (this._dims.availableColumnWidth + this._dims.gutterWidth);
          data.settings.margin.right =
            this._dims.tableMargin.right +
            (this._dims.columns - 1 - nextColumn) * (this._dims.availableColumnWidth + this._dims.gutterWidth);
        },
        didDrawCell: (data: CellHookData) => {
          this._drawPrefixedCell(data);
        },
      });
    }
  }

  private _checklistTableBody(checklist: Checklist): RowInput[] {
    const rows = checklist.items.map((item: ChecklistItem) => this._itemToCells(item));

    if (this._options.outputCompletionActions) {
      // Output completion actions as a regular item.
      const completionItem = this._completionActionItem(checklist.completionAction);
      if (completionItem) {
        rows.push(this._itemToCells(completionItem));
      }
    }

    return rows;
  }

  private _itemToCells(item: ChecklistItem): CellDef[] {
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
        prompt.styles!.minCellHeight = this._doc.getLineHeight() / this._dims.scaleFactor;
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
        ...this._dims.defaultCellPadding,
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

  private _completionActionItem(action: Checklist_CompletionAction): ChecklistItem | undefined {
    let screenName: string;
    let screenAction = 'OPEN';
    switch (action) {
      case Checklist_CompletionAction.ACTION_DO_NOTHING:
        return undefined;

      case Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST:
        return ChecklistItem.create({
          type: ChecklistItem_Type.ITEM_PLAINTEXT,
          prompt: '(Continue to the next checklist)',
          centered: true,
        });

      case Checklist_CompletionAction.ACTION_OPEN_FLIGHT_PLAN:
        screenName = 'Flight plan';
        break;

      case Checklist_CompletionAction.ACTION_CLOSE_FLIGHT_PLAN:
        screenName = 'Flight plan';
        screenAction = 'CLOSE';
        break;

      case Checklist_CompletionAction.ACTION_OPEN_TAXI_CHART:
        screenName = 'Taxi chart';
        break;

      case Checklist_CompletionAction.ACTION_OPEN_MAP:
        screenName = 'Map';
        break;
    }

    return ChecklistItem.create({
      type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
      prompt: screenName + ' screen',
      expectation: screenAction,
    });
  }

  private _drawPrefixedCell(data: CellHookData) {
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
    const margin = {
      ...this._dims.tableMargin,
      left: this._getColumnMarginLeft(),
      right: this._getColumnMarginRight(),
    };

    if (data.cell.styles.halign === 'center') {
      // We'll center the entire table instead of the content cell.
      data.cell.styles.halign = 'left';
      leftPadding = 0;
      const textWidth = this._textWidth(data.cell.text);
      tableWidth = this._dims.prefixCellWidth + textWidth + 2 * this._dims.defaultPadding;
      const innerTableWidth = this._dims.availableColumnWidth;
      const innerMargins = (innerTableWidth - tableWidth) / 2;
      margin.left += innerMargins;

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
              cellWidth: this._dims.prefixCellWidth,
              cellPadding: { ...this._dims.defaultCellPadding, left: this._dims.iconTotalSize },
              halign: 'right',
              fontStyle: prefixFontStyle,
              textColor: prefixColor,
            },
          },
          { content: contents.trim(), styles: { cellPadding: this._dims.defaultCellPadding } },
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

      const lineHeight = this._doc.getLineHeight() / this._dims.scaleFactor;
      this._icons.push({
        name: icon,
        page: this._doc.getCurrentPageInfo().pageNumber,
        // Position to the left of the text.
        x: margin.left + leftPadding,
        // Position centered with the first line of text.
        y: data.cell.y + this._dims.defaultCellPadding.top + (lineHeight - this._dims.iconSize) / 2,
      });
    }

    data.cell.text = [];
  }

  private async _addIcons() {
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
      await this._doc.svg(iconEl, { x: icon.x, y: icon.y, width: this._dims.iconSize, height: this._dims.iconSize });
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
    return indent + this._dims.defaultPadding;
  }

  private _calculatePrefixedCell(text: string, indent: number): { lines: string[]; height: number } {
    const maxContentWidth = this._calculatePrefixedContentWidth(indent);

    // splitTextToSize needs the correct font setting for calculation.
    // We could pass it through its options param, but options.font would have to come from jspdf's getFont anyway.
    this._doc.setFontSize(this._dims.contentFontSize);
    this._doc.setFont(PdfWriter.DEFAULT_FONT_NAME, PdfWriter.NORMAL_FONT_STYLE);

    // Actually calculate the text wrapping so we know how many lines the cell will take.
    const splitText = this._doc.splitTextToSize(text, maxContentWidth) as string[];
    const numLines = splitText.length;

    const lineHeight = this._doc.getLineHeight() / this._dims.scaleFactor;
    const textHeight = numLines * lineHeight;
    const cellHeight = textHeight + 2 * this._dims.defaultPadding;

    console.debug(`PDF: Text "${text}": numLines=${numLines}; cellHeight=${cellHeight}; maxWidth=${maxContentWidth}`);

    return { lines: splitText, height: cellHeight };
  }

  private _calculatePrefixedContentWidth(indent: number): number {
    const indentWidth = this._indentPadding(indent);
    // autotable adds +1 to the allowed wrapping width to account for rounding:
    // https://github.com/simonbengtsson/jsPDF-AutoTable/blob/cd107726591d01a315d158bb827191928e1964b5/src/widthCalculator.ts#L302
    const roundWidth = 1.0 / this._dims.scaleFactor;

    console.debug(`PDF: Prefixed width: indent=${indentWidth}`);

    // Calculate the cell width that's available for the text contents
    return (
      // The available column width (accounting for margins and gutters):
      this._dims.availableColumnWidth -
      // The prefix + content (with padding):
      indentWidth -
      // The content (with padding):
      this._dims.prefixCellWidth -
      // The content (no padding):
      2 * this._dims.defaultPadding +
      // The content (with rounding):
      roundWidth
    );
  }

  private _textWidth(lines: string[], fontSize?: number, scaleFactor?: number): number {
    // Calculate total width as the width of the longest line.
    const unitWidth = lines.reduce((max: number, line: string) => {
      const width = this._doc.getStringUnitWidth(line);
      console.debug(`PDF: Width=${width} for line "${line}"`);
      return Math.max(max, width);
    }, 0);
    return (unitWidth * (fontSize ?? this._dims.contentFontSize)) / (scaleFactor ?? this._dims.scaleFactor);
  }

  private _addPageFooters() {
    const pageCount = this._doc.internal.pages.length - 1;

    const firstNumberedPage = this._options.outputCoverPage ? 2 : 1;
    for (let i = firstNumberedPage; i <= pageCount; i++) {
      this._doc.setPage(i);
      this._setCurrentY(this._dims.footNoteY);
      this._doc.saveGraphicsState();
      if (this._darkBackgroundPages.includes(i)) {
        this._doc.setTextColor('white');
      }
      this._addCenteredText(`Page ${i} of ${pageCount}`, {
        advanceY: PdfWriter.FOOTNOTE_HEIGHT,
        fontSize: PdfWriter.FOOTNOTE_FONT_SIZE,
      });
      this._doc.restoreGraphicsState();
    }
  }

  private _setCurrentY(y: number) {
    this._currentY = y;
  }

  private _newPage(forceNewPhysicalPage = false) {
    this._currentColumn++;
    if (!forceNewPhysicalPage && this._currentColumn < this._dims.columns) {
      console.debug(`PDF: New column ${this._currentColumn}`);
      this._setCurrentY(0);
      return;
    }

    // Draw the layout debugging *after* the other contents so it's not obscured.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (PdfWriter.DEBUG_LAYOUT) {
      this._doc.setLineWidth(0.01);
      for (
        let x = this._dims.tableMargin.left - this._dims.gutterWidth / 2;
        x < this._dims.pageWidth - this._dims.tableMargin.right;
        x += this._dims.columnWidth
      ) {
        this._doc.rect(x, 0, this._dims.columnWidth, this._dims.pageHeight, 'S');
      }
    }

    console.debug(`PDF: New page`);
    this._addPhysicalPage!();
    this._setCurrentY(0);
    this._currentColumn = 0;
  }

  private _addCenteredText(txt: string | string[], options: CenteredTextOptions) {
    const { advanceY, fontSize, fontStyle, baseline, useColumnWidth } = options;

    this._doc.saveGraphicsState();
    if (fontSize !== undefined) {
      this._doc.setFontSize(fontSize);
    }
    this._doc.setFont(PdfWriter.DEFAULT_FONT_NAME, fontStyle);

    let center: number;
    if (useColumnWidth) {
      center = this._getColumnMarginLeft() + this._dims.availableColumnWidth / 2;
    } else {
      const tableWidth = this._dims.pageWidth - this._dims.tableMargin.left - this._dims.tableMargin.right;
      center = this._dims.tableMargin.left + tableWidth / 2;
    }

    this._doc.text(txt, center, this._currentY, { align: 'center', baseline: baseline ?? 'alphabetic' });
    this._doc.restoreGraphicsState();

    this._currentY += advanceY;
  }
}
