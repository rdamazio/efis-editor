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

/** A double-quoted CSV field (with `""` escaping a quote), captured as `name`. */
function quotedField(name: string): string {
  return `"(?<${name}>(?:[^"]|"")*)"`;
}

/** A field matching `pattern` that may or may not be quoted, captured as `name`. */
function optionallyQuotedField(name: string, pattern: string): string {
  return `"?(?<${name}>${pattern})"?`;
}

/**
 * Matches a single record of a Miracheck Goose CSV export.
 *
 * The first four fields (list, section, label1, label2) are always quoted. Some Miracheck Goose exports then include an
 * extra, *unquoted* copy of label2, which breaks naive CSV parsing whenever label2 contains commas or newlines. To
 * handle both that and well-formed files, anything between label2 and the trailing labelOnly, color and mandatory
 * fields is skipped.
 */
const MIRACHECK_RECORD_REGEX = new RegExp(
  [
    '^',
    `${quotedField('list')},${quotedField('section')},${quotedField('label1')},${quotedField('label2')},`,
    // The unquoted copy of label2, if present. This is lazy and optional, so that it's skipped only when needed and
    // never swallows the following record of a well-formed file.
    '(?:.*?,)??',
    optionallyQuotedField('labelOnly', 'true|false'),
    ',',
    optionallyQuotedField('color', '#?[0-9A-Fa-f]*'),
    ',',
    optionallyQuotedField('mandatory', 'true|false'),
    String.raw`[ \t]*\r?$`,
  ].join(''),
  'gms',
);

const GROUP_CATEGORY_PATTERNS: readonly (readonly [RegExp, ChecklistGroup_Category])[] = [
  [/emergenc/i, ChecklistGroup_Category.emergency],
  [/abnormal/i, ChecklistGroup_Category.abnormal],
];

interface MiracheckRow {
  list: string;
  section: string;
  items: ChecklistItem[];
}

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

    const rows = [...contents.slice(newline + 1).matchAll(MIRACHECK_RECORD_REGEX)].map(parseRecord);
    if (!rows.length) {
      throw new FormatError('No checklist items found in Miracheck Goose CSV file.');
    }

    const groups = groupConsecutive(rows, (row) => row.list).map((listRows) =>
      ChecklistGroup.create({
        title: listRows[0].list,
        category: categoryForGroup(listRows[0].list),
        checklists: groupConsecutive(listRows, (row) => row.section).map((sectionRows) =>
          Checklist.create({
            title: sectionRows[0].section,
            items: sectionRows.flatMap((row) => row.items),
          }),
        ),
      }),
    );

    return ChecklistFile.create({
      metadata: { name: file.name.replace(/\.csv$/i, '') },
      groups,
    });
  }

  public async fromProto(): Promise<File> {
    return Promise.reject(new FormatError('Exporting to Miracheck Goose CSV is not supported.'));
  }
}

function parseRecord(match: RegExpMatchArray): MiracheckRow {
  const fields = match.groups!;
  return {
    list: cleanField(fields['list']),
    section: cleanField(fields['section']),
    items: itemsForRow(cleanField(fields['label1']), cleanField(fields['label2']), fields['labelOnly'] === 'true'),
  };
}

/** Splits values into runs of consecutive values that have the same key, preserving their order. */
function groupConsecutive<T>(values: readonly T[], key: (value: T) => string): T[][] {
  const runStarts = values.flatMap((value, i) => (i === 0 || key(values[i - 1]) !== key(value) ? [i] : []));
  return runStarts.map((start, run) => values.slice(start, runStarts.at(run + 1)));
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
  return GROUP_CATEGORY_PATTERNS.find(([pattern]) => pattern.test(title))?.[1] ?? ChecklistGroup_Category.normal;
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
