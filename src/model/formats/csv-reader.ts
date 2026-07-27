import { parse } from 'csv-parse/sync';
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
import { CsvFormatError } from './csv-format';

interface ItemFields {
  typeStr: string;
  text: string;
  response: string;
  indentStr: string;
  centerStr: string;
}

function colIndexToLetters(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

function cellId(colIndex: number, rowIndex: number): string {
  return `${colIndexToLetters(colIndex)}${rowIndex + 1}`;
}

export class CsvReader {
  public static async read(file: File): Promise<ChecklistFile> {
    const csvText = await file.text();
    const rows = parse(csvText, {
      /* eslint-disable @typescript-eslint/naming-convention */
      relax_column_count: true,
      relax_quotes: true,
      /* eslint-enable @typescript-eslint/naming-convention */
    });

    const minCols = ['group', 'checklist', 'type', 'text'];
    let tableHeaderIndex = -1;
    const colIndexMap = new Map<string, number>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= minCols.length) {
        const isHeader = minCols.every((col, idx) => row[idx]?.trim().toLowerCase() === col);
        if (isHeader) {
          tableHeaderIndex = i;
          row.forEach((cell: string, idx: number) => {
            colIndexMap.set(cell.trim().toLowerCase(), idx);
          });
          break;
        }
      }
    }

    if (tableHeaderIndex === -1) {
      throw new CsvFormatError('Did not find table header row with columns "Group", "Checklist", "Type", "Text"');
    }

    const metadata = ChecklistFileMetadata.create();
    let defaultGroupTitle: string | undefined;
    let defaultChecklistTitle: string | undefined;

    for (let i = 0; i < tableHeaderIndex; i++) {
      const row = rows[i];
      for (let j = 0; j < row.length - 1; j += 2) {
        const rawKey = row[j]?.trim();
        const val = row[j + 1]?.trim();
        if (!rawKey || !val) {
          continue;
        }

        let key = rawKey;
        if (key.endsWith(':')) {
          key = key.slice(0, -1).trim();
        }
        const normalizedKey = key.toLowerCase();

        if (normalizedKey === 'name') {
          metadata.name = val;
        } else if (normalizedKey === 'make & model' || normalizedKey === 'make and model') {
          metadata.makeAndModel = val;
        } else if (normalizedKey === 'aircraft' || normalizedKey === 'aircraft info') {
          metadata.aircraftInfo = val;
        } else if (normalizedKey === 'manufacturer info' || normalizedKey === 'manufacturer') {
          metadata.manufacturerInfo = val;
        } else if (normalizedKey === 'copyright info' || normalizedKey === 'copyright') {
          metadata.copyrightInfo = val;
        } else if (normalizedKey === 'default group') {
          defaultGroupTitle = val;
        } else if (normalizedKey === 'default checklist') {
          defaultChecklistTitle = val;
        } else {
          console.warn(`cell ${cellId(j, i)}: Ignoring unsupported metadata key: ${rawKey}`);
        }
      }
    }

    if (!metadata.name) {
      metadata.name = file.name.replace(/\.csv$/i, '');
    }

    const checklistFile = ChecklistFile.create({
      metadata,
      groups: [],
    });

    let currentGroup: ChecklistGroup | undefined;
    let currentChecklist: Checklist | undefined;

    for (let i = tableHeaderIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0 || row.every((c: string) => c.trim() === '')) {
        continue;
      }

      const getCell = (name: string): string => {
        const idx = colIndexMap.get(name);
        return idx !== undefined && idx < row.length ? (row[idx] ?? '') : '';
      };

      let groupTitle = getCell('group').trim();
      let checklistTitle = getCell('checklist').trim();
      const typeStr = getCell('type').trim();
      const text = getCell('text');
      const response = getCell('response');
      const indentStr = getCell('indent').trim();
      const centerStr = getCell('center').trim();

      if (!groupTitle) {
        if (currentGroup) {
          groupTitle = currentGroup.title;
        } else {
          const groupCol = colIndexMap.get('group') ?? 0;
          throw new CsvFormatError(`cell ${cellId(groupCol, i)}: invalid/missing "Group" column value`);
        }
      }

      if (!checklistTitle) {
        if (currentChecklist && currentGroup?.title === groupTitle) {
          checklistTitle = currentChecklist.title;
        } else {
          const checklistCol = colIndexMap.get('checklist') ?? 1;
          throw new CsvFormatError(`cell ${cellId(checklistCol, i)}: invalid/missing "Checklist" column value`);
        }
      }

      if (currentGroup?.title !== groupTitle) {
        let existingGroup = checklistFile.groups.find((g) => g.title === groupTitle);
        if (!existingGroup) {
          existingGroup = ChecklistGroup.create({
            title: groupTitle,
            category: ChecklistGroup_Category.normal,
            checklists: [],
          });
          checklistFile.groups.push(existingGroup);
        }
        currentGroup = existingGroup;
        currentChecklist = undefined;
      }

      if (currentChecklist?.title !== checklistTitle) {
        let existingChecklist = currentGroup.checklists.find((c) => c.title === checklistTitle);
        if (!existingChecklist) {
          existingChecklist = Checklist.create({
            title: checklistTitle,
            completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
            items: [],
          });
          currentGroup.checklists.push(existingChecklist);
        }
        currentChecklist = existingChecklist;
      }

      const item = CsvReader._parseItem(
        {
          typeStr,
          text,
          response,
          indentStr,
          centerStr,
        },
        i,
        colIndexMap,
      );
      currentChecklist.items.push(item);
    }

    if (defaultGroupTitle && defaultChecklistTitle) {
      let found = false;
      for (let i = 0; i < checklistFile.groups.length; i++) {
        const group = checklistFile.groups[i];
        if (group.title === defaultGroupTitle) {
          for (let j = 0; j < group.checklists.length; j++) {
            const checklist = group.checklists[j];
            if (checklist.title === defaultChecklistTitle) {
              checklistFile.metadata!.defaultGroupIndex = i;
              checklistFile.metadata!.defaultChecklistIndex = j;
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
      if (!found) {
        throw new CsvFormatError(
          `Default checklist "${defaultChecklistTitle}" in group "${defaultGroupTitle}" not found`,
        );
      }
    }

    return checklistFile;
  }

  private static _parseItem(fields: ItemFields, rowIdx: number, colIndexMap: Map<string, number>): ChecklistItem {
    const { typeStr, text, response, indentStr, centerStr } = fields;
    const item = ChecklistItem.create();
    const normalizedType = typeStr.toLowerCase();

    if (normalizedType === 'title bar' || normalizedType === 'title') {
      item.type = ChecklistItem_Type.ITEM_TITLE;
      item.prompt = text;
    } else if (normalizedType === 'challenge') {
      if (response.length > 0) {
        item.type = ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE;
        item.prompt = text;
        item.expectation = response;
      } else {
        item.type = ChecklistItem_Type.ITEM_CHALLENGE;
        item.prompt = text;
      }
    } else if (normalizedType === 'information' || normalizedType === 'plain text' || normalizedType === 'text') {
      item.type = ChecklistItem_Type.ITEM_PLAINTEXT;
      item.prompt = text;
    } else if (normalizedType === 'warning') {
      item.type = ChecklistItem_Type.ITEM_WARNING;
      item.prompt = text;
    } else if (normalizedType === 'caution') {
      item.type = ChecklistItem_Type.ITEM_CAUTION;
      item.prompt = text;
    } else if (normalizedType === 'note') {
      item.type = ChecklistItem_Type.ITEM_NOTE;
      item.prompt = text;
    } else if (normalizedType === 'space' || normalizedType === 'blank') {
      item.type = ChecklistItem_Type.ITEM_SPACE;
    } else {
      const typeCol = colIndexMap.get('type') ?? 2;
      throw new CsvFormatError(`cell ${cellId(typeCol, rowIdx)}: unknown type "${typeStr}"`);
    }

    if (indentStr.length > 0) {
      const indent = Number(indentStr);
      if (isNaN(indent) || indent < 0 || !Number.isInteger(indent)) {
        const indentCol = colIndexMap.get('indent') ?? 5;
        throw new CsvFormatError(`cell ${cellId(indentCol, rowIdx)}: invalid indent value "${indentStr}"`);
      }
      if (indent > 0) {
        item.indent = indent;
      }
    }

    if (centerStr.length > 0) {
      const c = centerStr.toLowerCase();
      if (c === 'true' || c === '1' || c === 'yes') {
        item.centered = true;
      }
    }

    return item;
  }
}
