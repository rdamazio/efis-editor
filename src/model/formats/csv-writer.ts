import { ChecklistFile, ChecklistFileMetadata } from '../../../gen/ts/checklist';
import { CsvItemRow, CsvUtils } from './csv-utils';

export class CsvWriter {
  public static write(file: ChecklistFile): Blob {
    return new Blob([CsvUtils.BOM, ...CsvWriter._rows(file).map(CsvUtils.formatRow)], {
      type: 'text/csv;charset=utf-8',
    });
  }

  private static _rows(file: ChecklistFile): string[][] {
    const metadata = file.metadata ?? ChecklistFileMetadata.create();
    const filledMetadataFields = CsvUtils.METADATA_FIELDS.filter(([field]) => metadata[field]);

    return [
      ...filledMetadataFields.map(([field, label]) => [`${label}:`, metadata[field]]),
      ...CsvWriter._defaultRows(file, metadata),
      [], // a blank row separates the metadata block from the checklist items table
      CsvUtils.COLUMNS.map(([column]) => column),
      ...CsvWriter._itemRows(file).map((row) => CsvUtils.COLUMNS.map(([, cell]) => cell(row))),
    ];
  }

  private static _defaultRows(file: ChecklistFile, metadata: ChecklistFileMetadata): string[][] {
    if (metadata.defaultGroupIndex < 0 || metadata.defaultChecklistIndex < 0) {
      return [];
    }

    const group = file.groups.at(metadata.defaultGroupIndex);
    const checklist = group?.checklists.at(metadata.defaultChecklistIndex);

    // A checklist without items has no rows of its own, so naming it as the default one would fail the import
    return group && checklist?.items.length
      ? [
          [`${CsvUtils.DEFAULT_GROUP_LABEL}:`, group.title],
          [`${CsvUtils.DEFAULT_CHECKLIST_LABEL}:`, checklist.title],
        ]
      : [];
  }

  private static _itemRows(file: ChecklistFile): CsvItemRow[] {
    return file.groups.flatMap((group) =>
      group.checklists.flatMap((checklist) =>
        checklist.items.map((item): CsvItemRow => ({ group: group.title, checklist: checklist.title, item: item })),
      ),
    );
  }
}
