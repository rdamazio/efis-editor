import { parse } from 'csv-parse/sync';
import {
  Checklist_CompletionAction,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import { CsvColumn, CsvColumnIndexes, CsvFormatError, CsvItemRow, CsvUtils } from './csv-utils';
import { FormatId } from './format-id';

type CellReader = (column: CsvColumn) => string;
type CellError = (column: CsvColumn, message: string) => CsvFormatError;

const DEFAULT_LABELS = new Set(
  [CsvUtils.DEFAULT_GROUP_LABEL, CsvUtils.DEFAULT_CHECKLIST_LABEL].map(CsvUtils.normalizeLabel),
);

export class CsvReader {
  public static async read(file: File): Promise<ChecklistFile> {
    const [rows, itemsHeaderIndex] = CsvReader._parseRows(await file.text());

    const itemRows = [...rows.entries()]
      .slice(itemsHeaderIndex + 1)
      // Blank rows may be used to visually separate checklists
      .filter(([, cells]) => cells.some((cell) => cell.trim()));
    const groups = CsvReader._checklistGroupsToEFIS(
      CsvReader._readItemRows(itemRows, CsvUtils.columnIndexes(rows[itemsHeaderIndex])),
    );

    return {
      groups: groups,
      metadata: CsvReader._checklistMetadataToEFIS(rows.slice(0, itemsHeaderIndex), file, groups),
    };
  }

  /**
   * Spreadsheets in locales where the comma is the decimal separator write semicolon-delimited files instead,
   * so the file is imported with whichever delimiter makes its item table header show up.
   */
  private static _parseRows(text: string): [string[][], number] {
    for (const delimiter of [',', ';']) {
      const rows: string[][] = parse(text, {
        delimiter: delimiter,
        /* eslint-disable @typescript-eslint/naming-convention */
        relax_column_count: true, // metadata rows are shorter than the rows of the checklist item table
        relax_quotes: true, // tolerate quotes within unquoted fields
        /* eslint-enable @typescript-eslint/naming-convention */
      });
      const itemsHeaderIndex = rows.findIndex(CsvReader._isItemsHeader);
      if (itemsHeaderIndex !== -1) {
        return [rows, itemsHeaderIndex];
      } else {
        console.warn(`CSV: continuing after failed parse attempt using delimiter "${delimiter}"`);
      }
    }

    const columns = CsvUtils.REQUIRED_COLUMNS.map((column) => `"${column}"`).join(', ');
    throw new CsvFormatError(`did not find table header row with columns ${columns}`);
  }

  private static _isItemsHeader(cells: string[]): boolean {
    const columns = CsvUtils.columnIndexes(cells);
    return CsvUtils.REQUIRED_COLUMNS.every((column) => columns.has(column));
  }

  private static _readItemRows(rows: [number, string[]][], columns: CsvColumnIndexes): CsvItemRow[] {
    const itemRows: CsvItemRow[] = [];

    for (const [rowIndex, cells] of rows) {
      const cellReader: CellReader = (column) => CsvUtils.cell(cells, columns, column);
      const cellError: CellError = (column, message) =>
        new CsvFormatError(`cell ${CsvUtils.cellId(columns.get(column) ?? -1, rowIndex)}: ${message}`);

      // Titles omitted on a row are carried over, but a checklist only continues within its own group
      const previous = itemRows.at(-1);
      const group = cellReader('Group').trim() || previous?.group;
      if (!group) {
        throw cellError('Group', 'invalid/missing "Group" column value');
      }
      const checklist = cellReader('Checklist').trim() || (previous?.group === group ? previous.checklist : undefined);
      if (!checklist) {
        throw cellError('Checklist', 'invalid/missing "Checklist" column value');
      }

      itemRows.push({ group: group, checklist: checklist, item: CsvReader._readItem(cellReader, cellError) });
    }

    return itemRows;
  }

  private static _readItem(cellReader: CellReader, cellError: CellError): ChecklistItem {
    const label = cellReader('Type').trim();
    const type = CsvUtils.itemType(label);
    if (type === undefined) {
      throw cellError('Type', `unknown type "${label}"`);
    }

    // A response promotes a challenge to a challenge/response item, and is meaningless for any other type
    const response = cellReader('Response');
    const isChallengeResponse = type === ChecklistItem_Type.ITEM_CHALLENGE && Boolean(response);

    return ChecklistItem.create({
      type: isChallengeResponse ? ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE : type,
      prompt: cellReader('Text'),
      expectation: isChallengeResponse ? response : '',
      indent: CsvReader._readIndent(cellReader('Indent').trim(), cellError),
      centered: CsvUtils.CENTERED_VALUES.has(cellReader('Center').trim().toLowerCase()),
    });
  }

  private static _readIndent(value: string, cellError: CellError): number {
    const indent = value ? Number(value) : 0;
    if (!Number.isInteger(indent) || indent < 0) {
      throw cellError('Indent', `invalid indent value "${value}"`);
    }
    return indent;
  }

  private static _checklistGroupsToEFIS(itemRows: CsvItemRow[]): ChecklistGroup[] {
    // Rows of one group or checklist don't have to be adjacent, so they are gathered by title
    return [...CsvUtils.groupBy(itemRows, (row) => row.group)].map(([title, groupRows]) => ({
      category: ChecklistGroup_Category.normal,
      title: title,
      checklists: [...CsvUtils.groupBy(groupRows, (row) => row.checklist)].map(([checklistTitle, checklistRows]) => ({
        title: checklistTitle,
        completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
        items: checklistRows.map((row) => row.item),
      })),
    }));
  }

  private static _checklistMetadataToEFIS(
    rows: string[][],
    file: File,
    groups: ChecklistGroup[],
  ): ChecklistFileMetadata {
    const values = CsvReader._readMetadataValues(rows);
    const [defaultGroupIndex, defaultChecklistIndex] = CsvReader._defaultIndexes(values, groups);

    const metadata = ChecklistFileMetadata.create({
      name: file.name.replace(new RegExp(`\\.${FormatId.CSV}$`, 'i'), ''),
      defaultGroupIndex: defaultGroupIndex,
      defaultChecklistIndex: defaultChecklistIndex,
    });

    for (const [label, value] of values) {
      const field = CsvUtils.METADATA_FIELD_BY_LABEL.get(label);
      if (field) {
        metadata[field] = value;
      } else if (!DEFAULT_LABELS.has(label)) {
        console.warn(`CSV: ignoring unsupported metadata key "${label}"`);
      }
    }

    return metadata;
  }

  private static _readMetadataValues(rows: string[][]): ReadonlyMap<string, string> {
    const values = new Map<string, string>();

    for (const [labelCell = '', valueCell = ''] of rows) {
      const label = CsvUtils.normalizeLabel(labelCell);
      const value = valueCell.trim();
      if (label && value) {
        values.set(label, value);
      }
    }

    return values;
  }

  private static _defaultIndexes(values: ReadonlyMap<string, string>, groups: ChecklistGroup[]): [number, number] {
    const groupTitle = values.get(CsvUtils.normalizeLabel(CsvUtils.DEFAULT_GROUP_LABEL));
    const checklistTitle = values.get(CsvUtils.normalizeLabel(CsvUtils.DEFAULT_CHECKLIST_LABEL));
    if (groupTitle === undefined || checklistTitle === undefined) {
      return [0, 0];
    }

    const groupIndex = groups.findIndex((group) => group.title === groupTitle);
    const checklistIndex =
      groupIndex === -1
        ? -1
        : groups[groupIndex].checklists.findIndex((checklist) => checklist.title === checklistTitle);
    if (checklistIndex === -1) {
      throw new CsvFormatError(`default checklist "${checklistTitle}" in group "${groupTitle}" not found`);
    }

    return [groupIndex, checklistIndex];
  }
}
