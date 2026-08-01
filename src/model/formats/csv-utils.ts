import { ChecklistFileMetadata, ChecklistItem, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { FormatError } from './error';

export class CsvFormatError extends FormatError {
  constructor(message: string, cause?: Error) {
    super(`CSV: ${message}`);
    this.cause = cause;
    this.name = 'CsvFormatError';
  }
}

export interface CsvItemRow {
  readonly group: string;
  readonly checklist: string;
  readonly item: ChecklistItem;
}

export type MetadataTextField = {
  [K in keyof ChecklistFileMetadata]: ChecklistFileMetadata[K] extends string ? K : never;
}[keyof ChecklistFileMetadata];

export type CsvColumn = 'Group' | 'Checklist' | 'Type' | 'Text' | 'Response' | 'Indent' | 'Center';
export type CsvColumnIndexes = ReadonlyMap<CsvColumn, number>;

export type CsvColumnCell = readonly [column: CsvColumn, serializer: (row: CsvItemRow) => string];
export type CsvLabels<T> = readonly [value: T, canonicalLabel: string, ...alternativeLabels: string[]];

export class CsvUtils {
  public static readonly BOM = '\ufeff';

  public static readonly COLUMNS: readonly CsvColumnCell[] = [
    // In output order
    ['Group', (row) => row.group],
    ['Checklist', (row) => row.checklist],
    ['Type', (row) => CsvUtils.itemTypeLabel(row.item.type)],
    ['Text', (row) => row.item.prompt],
    ['Response', (row) => (row.item.type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE ? row.item.expectation : '')],
    ['Indent', (row) => (row.item.indent ? String(row.item.indent) : '')],
    ['Center', (row) => (row.item.centered ? CsvUtils.CENTERED_VALUE : '')],
  ];

  public static readonly REQUIRED_COLUMNS: readonly CsvColumn[] = ['Group', 'Checklist', 'Type', 'Text'];

  private static readonly ITEM_TYPE_LABELS: readonly CsvLabels<ChecklistItem_Type>[] = [
    [ChecklistItem_Type.ITEM_TITLE, 'Title Bar', 'Title'],
    [ChecklistItem_Type.ITEM_CHALLENGE, 'Challenge'],
    [ChecklistItem_Type.ITEM_PLAINTEXT, 'Information', 'Plain Text', 'Text'],
    [ChecklistItem_Type.ITEM_WARNING, 'Warning'],
    [ChecklistItem_Type.ITEM_CAUTION, 'Caution'],
    [ChecklistItem_Type.ITEM_NOTE, 'Note'],
    [ChecklistItem_Type.ITEM_SPACE, 'Space', 'Blank'],
  ];

  public static readonly METADATA_FIELDS: readonly CsvLabels<MetadataTextField>[] = [
    ['name', 'Name'],
    ['makeAndModel', 'Make & Model', 'Make and Model'],
    ['aircraftInfo', 'Aircraft', 'Aircraft Info'],
    ['manufacturerInfo', 'Manufacturer Info', 'Manufacturer'],
    ['copyrightInfo', 'Copyright Info', 'Copyright'],
  ];

  // Kept apart from METADATA_FIELDS, as these are stored as indexes rather than titles
  public static readonly DEFAULT_GROUP_LABEL = 'Default Group';
  public static readonly DEFAULT_CHECKLIST_LABEL = 'Default Checklist';

  public static readonly CENTERED_VALUE = 'true';
  public static readonly CENTERED_VALUES: ReadonlySet<string> = new Set([CsvUtils.CENTERED_VALUE, '1', 'yes']);

  // Fields containing quotes, commas or line breaks have to be quoted (RFC 4180)
  private static readonly QUOTABLE = /["\r\n,]/;

  private static readonly COLUMN_BY_LABEL = new Map<string, CsvColumn>(
    CsvUtils.COLUMNS.map(([column]): [string, CsvColumn] => [CsvUtils.normalizeLabel(column), column]),
  );

  private static readonly ITEM_TYPE_TO_LABEL = new Map<ChecklistItem_Type, string>(
    CsvUtils.ITEM_TYPE_LABELS.map(([type, label]): [ChecklistItem_Type, string] => [type, label]),
  );

  private static readonly LABEL_TO_ITEM_TYPE = new Map<string, ChecklistItem_Type>(
    CsvUtils.ITEM_TYPE_LABELS.flatMap(([type, ...labels]) =>
      labels.map((label): [string, ChecklistItem_Type] => [CsvUtils.normalizeLabel(label), type]),
    ),
  );

  public static readonly METADATA_FIELD_BY_LABEL = new Map<string, MetadataTextField>(
    CsvUtils.METADATA_FIELDS.flatMap(([field, ...labels]) =>
      labels.map((label): [string, MetadataTextField] => [CsvUtils.normalizeLabel(label), field]),
    ),
  );

  public static normalizeLabel(label: string): string {
    return label.trim().toLowerCase().replace(/:$/, '');
  }

  public static columnIndexes(cells: string[]): CsvColumnIndexes {
    const columns = new Map<CsvColumn, number>();
    for (const [index, cell] of cells.entries()) {
      const column = CsvUtils.COLUMN_BY_LABEL.get(CsvUtils.normalizeLabel(cell));
      if (column) {
        columns.set(column, index);
      }
    }
    return columns;
  }

  public static cell(cells: string[], columns: CsvColumnIndexes, column: CsvColumn): string {
    const index = columns.get(column);
    return index === undefined ? '' : (cells.at(index) ?? '');
  }

  public static itemTypeLabel(type: ChecklistItem_Type): string {
    const label = CsvUtils.ITEM_TYPE_TO_LABEL.get(
      type === ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE ? ChecklistItem_Type.ITEM_CHALLENGE : type,
    );
    if (label === undefined) {
      throw new CsvFormatError(`unsupported item type: ${type}`);
    }
    return label;
  }

  public static itemType(label: string): ChecklistItem_Type | undefined {
    return CsvUtils.LABEL_TO_ITEM_TYPE.get(CsvUtils.normalizeLabel(label));
  }

  /** Spreadsheet-style reference, e.g. "B3", of the cell at the given zero-based column and row indexes */
  public static cellId(columnIndex: number, rowIndex: number): string {
    return `${CsvUtils._columnLetters(columnIndex)}${rowIndex + 1}`;
  }

  private static _columnLetters(columnIndex: number): string {
    // Spreadsheet column names are bijective base-26: A..Z, AA..AZ, BA..BZ, ...
    return columnIndex < 0
      ? ''
      : CsvUtils._columnLetters(Math.floor(columnIndex / 26) - 1) + String.fromCharCode(0x41 + (columnIndex % 26));
  }

  public static formatRow(cells: readonly string[]): string {
    return `${cells.map(CsvUtils._formatCell).join(',')}\r\n`;
  }

  private static _formatCell(cell: string): string {
    return CsvUtils.QUOTABLE.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
  }

  /** Polyfill for Map.groupBy for all currently supported browsers */
  public static groupBy(rows: CsvItemRow[], key: (row: CsvItemRow) => string): Map<string, CsvItemRow[]> {
    const groups = new Map<string, CsvItemRow[]>();
    for (const row of rows) {
      const rowKey = key(row);
      const group = groups.get(rowKey) ?? [];
      group.push(row);
      groups.set(rowKey, group);
    }
    return groups;
  }
}
