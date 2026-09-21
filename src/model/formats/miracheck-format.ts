import {
  Checklist,
  ChecklistFile,
  ChecklistGroup,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import { AbstractChecklistFormat, FileExtension } from './abstract-format';
import { FormatError } from './error';

export const MIRACHECK_EXTENSION: FileExtension = '.csv';

const MIRACHECK_HEADER = 'list,section,label1,label2,labelOnly,labelOnlyBackgroundColor,mandatory';

/**
 * Matches a single record of a Miracheck Goose CSV export.
 *
 * The first four fields (list, section, label1, label2) are always quoted. Some Miracheck Goose exports then include an
 * extra, *unquoted* copy of label2, which breaks naive CSV parsing whenever label2 contains commas or newlines. To
 * handle both that and well-formed files, anything between label2 and the trailing labelOnly, color and mandatory
 * fields is skipped.
 */
const MIRACHECK_RECORD_REGEX = new RegExp(
  String.raw`^"((?:[^"]|"")*)","((?:[^"]|"")*)","((?:[^"]|"")*)","((?:[^"]|"")*)",` +
    String.raw`(?:.*?,)??"?(true|false)"?,"?(#?[0-9A-Fa-f]*)"?,"?(true|false)"?[ \t]*\r?$`,
  'gms',
);

/**
 * Import-only reader for CSV files exported by the Miracheck Goose checklist app (formerly just Miracheck).
 *
 * Each "list" becomes a checklist group, each "section" a checklist and each row an item, with label1 as the challenge
 * and label2 as the response.
 */
export class MiracheckFormat extends AbstractChecklistFormat {
  public override get extension(): FileExtension {
    return this._extension ?? MIRACHECK_EXTENSION;
  }

  public async toProto(file: File): Promise<ChecklistFile> {
    const contents = (await file.text()).replace(/^\uFEFF/, '');
    const newline = contents.indexOf('\n');
    const header = (newline < 0 ? contents : contents.slice(0, newline)).trim();
    if (header !== MIRACHECK_HEADER) {
      throw new FormatError('Not a Miracheck Goose CSV file: unexpected header row.');
    }

    const groups: ChecklistGroup[] = [];
    for (const match of contents.slice(newline + 1).matchAll(MIRACHECK_RECORD_REGEX)) {
      const [groupTitle, checklistTitle, label1, label2] = match.slice(1, 5).map(cleanField);
      const labelOnly = match[5] === 'true';

      let group = groups.at(-1);
      if (group?.title !== groupTitle) {
        group = ChecklistGroup.create({ title: groupTitle, category: categoryForGroup(groupTitle) });
        groups.push(group);
      }

      let checklist = group.checklists.at(-1);
      if (checklist?.title !== checklistTitle) {
        checklist = Checklist.create({ title: checklistTitle });
        group.checklists.push(checklist);
      }

      checklist.items.push(...itemsForRow(label1, label2, labelOnly));
    }

    if (!groups.length) {
      throw new FormatError('No checklist items found in Miracheck Goose CSV file.');
    }

    return ChecklistFile.create({
      metadata: { name: file.name.replace(/\.csv$/i, '') },
      groups,
    });
  }

  public async fromProto(): Promise<File> {
    return Promise.reject(new FormatError('Exporting to Miracheck Goose CSV is not supported.'));
  }
}

function cleanField(field: string): string {
  return field
    .replaceAll('""', '"')
    .replaceAll('\u200B', '')
    .replaceAll('\r', '')
    .split('\n')
    .map((line) => line.replaceAll(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}

function categoryForGroup(title: string): ChecklistGroup_Category {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('emergenc')) {
    return ChecklistGroup_Category.emergency;
  }
  if (lowerTitle.includes('abnormal')) {
    return ChecklistGroup_Category.abnormal;
  }
  return ChecklistGroup_Category.normal;
}

function itemsForRow(label1: string, label2: string, labelOnly: boolean): ChecklistItem[] {
  const prompt = label1.replaceAll('\n', ' ');
  if (labelOnly) {
    return [ChecklistItem.create({ prompt, type: ChecklistItem_Type.ITEM_TITLE })];
  }

  const lines = label2.split('\n').filter((line) => line.length > 0);
  // A response whose continuation lines all start in lowercase is a single soft-wrapped sentence.
  if (lines.length <= 1 || lines.slice(1).every((line) => /^\p{Ll}/u.test(line))) {
    const expectation = lines.join(' ');
    return [
      ChecklistItem.create({
        prompt,
        expectation,
        type: expectation ? ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE : ChecklistItem_Type.ITEM_CHALLENGE,
      }),
    ];
  }

  // Otherwise the response is a list, so show each line as an indented plain text item under the challenge.
  return [
    ChecklistItem.create({ prompt, type: ChecklistItem_Type.ITEM_CHALLENGE }),
    ...lines.map((line) => ChecklistItem.create({ prompt: line, type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1 })),
  ];
}
