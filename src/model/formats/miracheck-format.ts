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

/**
 * Header of the files Miracheck Goose exports. Despite the header, each row actually has an extra field after label2
 * (see MIRACHECK_EXPORT_RECORD_REGEX).
 */
const MIRACHECK_EXPORT_HEADER = 'list,section,label1,label2,labelOnly,labelOnlyBackgroundColor,mandatory';

/** Header of the (well-formed) CSV files Miracheck Goose imports, as in its downloadable template. */
const MIRACHECK_IMPORT_HEADER = 'list,section,label1,label2,comments,labelOnly,labelOnlyBackgroundColor,mandatory';
const MIRACHECK_IMPORT_COLUMN_COUNT = MIRACHECK_IMPORT_HEADER.split(',').length;

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
 * The first four fields (list, section, label1, label2) are always quoted. Miracheck Goose exports then include an
 * extra field that's missing from the header - in the position of the import format's comments column, but actually
 * containing an *unquoted* copy of label2 - which breaks CSV parsing whenever label2 contains commas or newlines. To
 * handle both that and well-formed files, anything between label2 and the trailing labelOnly, color and mandatory
 * fields is skipped.
 */
const MIRACHECK_EXPORT_RECORD_REGEX = new RegExp(
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

/** The fields of a single row, from either file layout. */
interface MiracheckRecord {
  list: string;
  section: string;
  label1: string;
  label2: string;
  comments: string;
  labelOnly: boolean;
}

interface MiracheckRow {
  list: string;
  section: string;
  items: ChecklistItem[];
}

/**
 * Import-only reader for Miracheck Goose checklist app (formerly just Miracheck) CSV files - both the files it exports,
 * and the files it imports (e.g. made from its template).
 *
 * Each "list" becomes a checklist group, each "section" a checklist and each row an item, with label1 as the challenge,
 * label2 as the response and any comments as notes below it.
 */
export class MiracheckFormat extends AbstractChecklistFormat {
  public override get extension(): FileExtension {
    return this._extension ?? MIRACHECK_EXTENSION;
  }

  public async toProto(file: File): Promise<ChecklistFile> {
    const contents = (await file.text()).replace(/^\uFEFF/, '');
    const newline = contents.indexOf('\n');
    const header = (newline < 0 ? contents : contents.slice(0, newline)).trim().toLowerCase();
    const body = newline < 0 ? '' : contents.slice(newline + 1);

    const rows = parseRecords(header, body).map(rowForRecord);
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

function parseRecords(header: string, body: string): MiracheckRecord[] {
  if (header === MIRACHECK_EXPORT_HEADER.toLowerCase()) {
    return [...body.matchAll(MIRACHECK_EXPORT_RECORD_REGEX)].map(parseExportRecord);
  }
  if (header === MIRACHECK_IMPORT_HEADER.toLowerCase()) {
    return parseImportRecords(body);
  }
  throw new FormatError('Not a Miracheck Goose CSV file: unexpected header row.');
}

function parseExportRecord(match: RegExpMatchArray): MiracheckRecord {
  const fields = match.groups!;
  const unescape = (field: string) => field.replaceAll('""', '"');
  return {
    list: unescape(fields['list']),
    section: unescape(fields['section']),
    label1: unescape(fields['label1']),
    label2: unescape(fields['label2']),
    // The export has no real comments column (see MIRACHECK_EXPORT_RECORD_REGEX).
    comments: '',
    labelOnly: fields['labelOnly'] === 'true',
  };
}

function parseImportRecords(body: string): MiracheckRecord[] {
  return parseCsv(body).flatMap((fields, index): MiracheckRecord[] => {
    if (fields.every((field) => !field.trim())) {
      return [];
    }
    if (fields.length !== MIRACHECK_IMPORT_COLUMN_COUNT) {
      // Row numbers as shown in a spreadsheet, where the header is row 1.
      throw new FormatError(
        `Row ${index + 2}: expected ${MIRACHECK_IMPORT_COLUMN_COUNT} columns, found ${fields.length}.`,
      );
    }
    const [list, section, label1, label2, comments, labelOnly] = fields;
    return [{ list, section, label1, label2, comments, labelOnly: /^\s*true\s*$/i.test(labelOnly) }];
  });
}

/**
 * Parses RFC 4180 CSV into records of fields. Quoted fields may contain commas, newlines and quotes (escaped as `""`).
 */
function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char !== '"') {
        field += char;
      } else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      records.push([...record, field]);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (inQuotes) {
    throw new FormatError('Unterminated quoted field in CSV file.');
  }
  if (field || record.length) {
    records.push([...record, field]);
  }
  return records;
}

function rowForRecord(record: MiracheckRecord): MiracheckRow {
  return {
    list: cleanField(record.list),
    section: cleanField(record.section),
    items: [
      ...itemsForRow(cleanField(record.label1), cleanField(record.label2), record.labelOnly),
      ...notesForComments(record.comments),
    ],
  };
}

/** Splits values into runs of consecutive values that have the same key, preserving their order. */
function groupConsecutive<T>(values: readonly T[], key: (value: T) => string): T[][] {
  const runStarts = values.flatMap((value, i) => (i === 0 || key(values[i - 1]) !== key(value) ? [i] : []));
  return runStarts.map((start, run) => values.slice(start, runStarts.at(run + 1)));
}

function cleanField(field: string): string {
  return field
    .replaceAll('\u200B', '')
    .replaceAll(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replaceAll(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}

/** Converts Miracheck Goose comments, which may be HTML, into indented notes - one per line or paragraph. */
function notesForComments(comments: string): ChecklistItem[] {
  const text = comments
    .replaceAll(/<br\s*\/?>|<\/p>/gi, '\n')
    // Only strip actual tags, so that text like "<50 RPM" is preserved.
    .replaceAll(/<\/?[a-z][^>]*>/gi, '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
  return cleanField(text)
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => ChecklistItem.create({ prompt: line, type: ChecklistItem_Type.ITEM_NOTE, indent: 1 }));
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
