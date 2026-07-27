import { stringify } from 'csv-stringify/sync';
import { ChecklistFile, ChecklistItem, ChecklistItem_Type } from '../../../gen/ts/checklist';

export class CsvWriter {
  public static write(file: ChecklistFile): Blob {
    const rows: string[][] = [];

    if (file.metadata?.name) {
      rows.push(['Name:', file.metadata.name]);
    }
    if (file.metadata?.makeAndModel) {
      rows.push(['Make & Model:', file.metadata.makeAndModel]);
    }
    if (file.metadata?.aircraftInfo) {
      rows.push(['Aircraft:', file.metadata.aircraftInfo]);
    }
    if (file.metadata?.manufacturerInfo) {
      rows.push(['Manufacturer Info:', file.metadata.manufacturerInfo]);
    }
    if (file.metadata?.copyrightInfo) {
      rows.push(['Copyright Info:', file.metadata.copyrightInfo]);
    }

    const defaultGroupIndex = file.metadata?.defaultGroupIndex;
    const defaultChecklistIndex = file.metadata?.defaultChecklistIndex;
    if (defaultGroupIndex !== undefined && defaultGroupIndex >= 0 && defaultGroupIndex < file.groups.length) {
      const defGroup = file.groups[defaultGroupIndex];
      if (
        defaultChecklistIndex !== undefined &&
        defaultChecklistIndex >= 0 &&
        defaultChecklistIndex < defGroup.checklists.length
      ) {
        const defChecklist = defGroup.checklists[defaultChecklistIndex];
        rows.push(['Default Group:', defGroup.title]);
        rows.push(['Default Checklist:', defChecklist.title]);
      }
    }

    rows.push([]);

    rows.push(['Group', 'Checklist', 'Type', 'Text', 'Response', 'Indent', 'Center']);

    for (const group of file.groups) {
      for (const checklist of group.checklists) {
        for (const item of checklist.items) {
          rows.push(CsvWriter._formatItemRow(group.title, checklist.title, item));
        }
      }
    }

    const csvContent = stringify(rows);
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  }

  private static _formatItemRow(groupTitle: string, checklistTitle: string, item: ChecklistItem): string[] {
    let typeStr: string;
    let responseStr = '';

    switch (item.type) {
      case ChecklistItem_Type.ITEM_TITLE:
        typeStr = 'Title Bar';
        break;
      case ChecklistItem_Type.ITEM_CHALLENGE:
        typeStr = 'Challenge';
        break;
      case ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE:
        typeStr = 'Challenge';
        responseStr = item.expectation || '';
        break;
      case ChecklistItem_Type.ITEM_PLAINTEXT:
        typeStr = 'Information';
        break;
      case ChecklistItem_Type.ITEM_WARNING:
        typeStr = 'Warning';
        break;
      case ChecklistItem_Type.ITEM_CAUTION:
        typeStr = 'Caution';
        break;
      case ChecklistItem_Type.ITEM_NOTE:
        typeStr = 'Note';
        break;
      case ChecklistItem_Type.ITEM_SPACE:
        typeStr = 'Space';
        break;
      case ChecklistItem_Type.ITEM_UNKNOWN:
      default:
        typeStr = 'Information';
        break;
    }

    const textStr = item.prompt || '';
    const indentStr = item.indent ? String(item.indent) : '';
    const centerStr = item.centered ? 'true' : '';

    return [groupTitle, checklistTitle, typeStr, textStr, responseStr, indentStr, centerStr];
  }
}
