import {
  Checklist_CompletionAction,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import { CsvReader } from './csv-reader';
import { CsvUtils } from './csv-utils';
import { CsvWriter } from './csv-writer';
import { FormatId } from './format-id';
import { parseChecklistFile, serializeChecklistFile } from './format-registry';
import { EXPECTED_CONTENTS } from './test-data';
import { loadFile } from './test-utils';

function csvFile(rows: string[], name = 'test.csv'): File {
  return new File([rows.join('\n')], name, { type: 'text/csv' });
}

describe('CsvFormat', () => {
  it('should read test.csv file matching EXPECTED_CONTENTS', async () => {
    const file = await loadFile('/src/model/formats/test.csv', 'test.csv');
    const parsedFile = await parseChecklistFile(file);

    expect(parsedFile).toEqual(EXPECTED_CONTENTS);
  });

  it('should pass round-trip test with EXPECTED_CONTENTS', async () => {
    const file = await serializeChecklistFile(EXPECTED_CONTENTS, FormatId.CSV);

    expect(file.name).toBe(`${EXPECTED_CONTENTS.metadata!.name}.csv`);

    const parsedFile = await parseChecklistFile(file);

    expect(parsedFile).toEqual(EXPECTED_CONTENTS);
  });

  it('should write a byte order mark for spreadsheet applications', async () => {
    const file = await serializeChecklistFile(EXPECTED_CONTENTS, FormatId.CSV);

    // File.text() decodes as UTF-8 and drops the mark, so the raw bytes have to be inspected
    expect([...new Uint8Array(await file.slice(0, 3).arrayBuffer())]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('should parse metadata correctly from CSV text', async () => {
    const checklistFile = await CsvReader.read(
      csvFile([
        'Name:,"My Airplane Checklists, Main"',
        'Make & Model:,Cessna 172',
        'Aircraft:,N12345',
        'Manufacturer Info:,Cessna',
        'Copyright Info:,2026 Pilot',
        'Default Group:,Group 1',
        'Default Checklist:,Checklist 1',
        '',
        'Group,Checklist,Type,Text,Response,Indent,Center',
        'Group 1,Checklist 1,Title Bar,BEFORE START,,,true',
        'Group 1,Checklist 1,Challenge,Seats,ADJUSTED,,',
        'Group 1,Checklist 1,Information,Note line,,1,',
        'Group 1,Checklist 1,Space,,,,',
      ]),
    );

    expect(checklistFile.metadata).toEqual(
      ChecklistFileMetadata.create({
        name: 'My Airplane Checklists, Main',
        makeAndModel: 'Cessna 172',
        aircraftInfo: 'N12345',
        manufacturerInfo: 'Cessna',
        copyrightInfo: '2026 Pilot',
      }),
    );
    expect(checklistFile.groups).toHaveLength(1);
    expect(checklistFile.groups[0].title).toBe('Group 1');
    expect(checklistFile.groups[0].checklists[0].items).toEqual([
      ChecklistItem.create({ type: ChecklistItem_Type.ITEM_TITLE, prompt: 'BEFORE START', centered: true }),
      ChecklistItem.create({
        type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
        prompt: 'Seats',
        expectation: 'ADJUSTED',
      }),
      ChecklistItem.create({ type: ChecklistItem_Type.ITEM_PLAINTEXT, prompt: 'Note line', indent: 1 }),
      ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE }),
    ]);
  });

  it('should parse metadata written by spreadsheet applications', async () => {
    const checklistFile = await CsvReader.read(
      csvFile([
        `${CsvUtils.BOM}Name:,My Airplane Checklists`,
        'Make and Model:,Cessna 172',
        '',
        'Group,Checklist,Type,Text',
        'Group 1,Checklist 1,Title Bar,BEFORE START',
      ]),
    );

    expect(checklistFile.metadata?.name).toBe('My Airplane Checklists');
    expect(checklistFile.metadata?.makeAndModel).toBe('Cessna 172');
    expect(checklistFile.groups).toHaveLength(1);
  });

  it('should parse files delimited with semicolons by localized spreadsheet applications', async () => {
    const checklistFile = await CsvReader.read(
      csvFile([
        `${CsvUtils.BOM}Name:;My Airplane Checklists;;;`,
        ';;;;',
        'Group;Checklist;Type;Text;Response',
        'Group 1;Checklist 1;Challenge;"Fuel pressure; if low, pump";ON',
      ]),
    );

    expect(checklistFile.metadata?.name).toBe('My Airplane Checklists');
    expect(checklistFile.groups[0].checklists[0].items).toEqual([
      ChecklistItem.create({
        type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
        prompt: 'Fuel pressure; if low, pump',
        expectation: 'ON',
      }),
    ]);
  });

  it('should parse correctly when optional metadata is missing', async () => {
    const checklistFile = await CsvReader.read(
      csvFile([
        'Name:,My Simple Checklist',
        '',
        'Group,Checklist,Type,Text,Response,Indent,Center',
        'Group 1,Checklist 1,Title Bar,BEFORE START,,,',
      ]),
    );

    expect(checklistFile.metadata).toEqual(ChecklistFileMetadata.create({ name: 'My Simple Checklist' }));
    expect(checklistFile.groups).toHaveLength(1);
  });

  it('should name the file after itself when no name metadata is present', async () => {
    const checklistFile = await CsvReader.read(
      csvFile(['Group,Checklist,Type,Text', 'Group 1,Checklist 1,Title Bar,BEFORE START'], 'My Checklists.CSV'),
    );

    expect(checklistFile.metadata?.name).toBe('My Checklists');
  });

  it('should parse correctly when optional columns Indent and Center are missing', async () => {
    const checklistFile = await CsvReader.read(
      csvFile([
        'Name:,My Simple Checklist',
        '',
        'Group,Checklist,Type,Text,Response',
        'Group 1,Checklist 1,Title Bar,BEFORE START,',
        'Group 1,Checklist 1,Challenge,Seats,ADJUSTED',
      ]),
    );

    expect(checklistFile.groups).toHaveLength(1);
    expect(checklistFile.groups[0].checklists[0].items).toEqual([
      ChecklistItem.create({ type: ChecklistItem_Type.ITEM_TITLE, prompt: 'BEFORE START' }),
      ChecklistItem.create({
        type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
        prompt: 'Seats',
        expectation: 'ADJUSTED',
      }),
    ]);
  });

  it('should parse columns in any order, ignoring unknown ones', async () => {
    const checklistFile = await CsvReader.read(
      csvFile([
        'TEXT,response,Notes,type,checklist,GROUP',
        'Seats,ADJUSTED,Both of them,Challenge,Checklist 1,Group 1',
      ]),
    );

    expect(checklistFile.groups[0].title).toBe('Group 1');
    expect(checklistFile.groups[0].checklists[0].title).toBe('Checklist 1');
    expect(checklistFile.groups[0].checklists[0].items).toEqual([
      ChecklistItem.create({
        type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
        prompt: 'Seats',
        expectation: 'ADJUSTED',
      }),
    ]);
  });

  it('should accept the alternative type and centering labels', async () => {
    const checklistFile = await CsvReader.read(
      csvFile([
        'Group,Checklist,Type,Text,Center',
        'Group 1,Checklist 1,title,Centered title,1',
        'Group 1,Checklist 1,PLAIN TEXT,Plain text,yes',
        'Group 1,Checklist 1,blank,,TRUE',
      ]),
    );

    expect(checklistFile.groups[0].checklists[0].items).toEqual([
      ChecklistItem.create({ type: ChecklistItem_Type.ITEM_TITLE, prompt: 'Centered title', centered: true }),
      ChecklistItem.create({ type: ChecklistItem_Type.ITEM_PLAINTEXT, prompt: 'Plain text', centered: true }),
      ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE, centered: true }),
    ]);
  });

  it('should parse correctly when Group and Checklist column values are omitted on subsequent rows', async () => {
    const checklistFile = await CsvReader.read(
      csvFile([
        'Name:,My Simple Checklist',
        '',
        'Group,Checklist,Type,Text,Response',
        'Group 1,Checklist 1,Title Bar,BEFORE START,',
        ',,Challenge,Seats,ADJUSTED',
        ',Checklist 2,Challenge,Brakes,SET',
        'Group 2,Checklist 3,Information,Engine start,',
        ',,Information,Runup,',
      ]),
    );

    expect(checklistFile.groups).toHaveLength(2);
    expect(checklistFile.groups[0].checklists).toHaveLength(2);
    expect(checklistFile.groups[0].checklists[0].items).toHaveLength(2);
    expect(checklistFile.groups[0].checklists[0].title).toBe('Checklist 1');
    expect(checklistFile.groups[0].checklists[0].items[0].prompt).toBe('BEFORE START');
    expect(checklistFile.groups[0].checklists[0].items[1].prompt).toBe('Seats');
    expect(checklistFile.groups[0].checklists[1].title).toBe('Checklist 2');
    expect(checklistFile.groups[0].checklists[1].items[0].prompt).toBe('Brakes');
    expect(checklistFile.groups[1].checklists).toHaveLength(1);
    expect(checklistFile.groups[1].checklists[0].title).toBe('Checklist 3');
    expect(checklistFile.groups[1].checklists[0].items).toHaveLength(2);
    expect(checklistFile.groups[1].checklists[0].items[0].prompt).toBe('Engine start');
    expect(checklistFile.groups[1].checklists[0].items[1].prompt).toBe('Runup');
  });

  it('should gather rows of the same group and checklist that are not adjacent', async () => {
    const checklistFile = await CsvReader.read(
      csvFile([
        'Group,Checklist,Type,Text',
        'Group 1,Checklist 1,Challenge,Seats',
        'Group 2,Checklist 2,Challenge,Brakes',
        'Group 1,Checklist 1,Challenge,Doors',
      ]),
    );

    expect(checklistFile.groups).toHaveLength(2);
    expect(checklistFile.groups[0].checklists).toHaveLength(1);
    expect(checklistFile.groups[0].checklists[0].items).toHaveLength(2);
  });

  it('should round-trip fields containing separators, quotes and line breaks', async () => {
    const contents = ChecklistFile.create({
      metadata: { name: 'Quoting, "torture" test' },
      groups: [
        {
          category: ChecklistGroup_Category.normal,
          title: 'Group, with comma',
          checklists: [
            {
              title: 'Checklist "quoted"',
              completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
              items: [
                ChecklistItem.create({ type: ChecklistItem_Type.ITEM_CHALLENGE, prompt: 'Line 1\nLine 2' }),
                ChecklistItem.create({ type: ChecklistItem_Type.ITEM_NOTE, prompt: 'Say "hello", pilot' }),
              ],
            },
          ],
        },
      ],
    });

    const parsedFile = await CsvReader.read(new File([CsvWriter.write(contents)], 'quoting.csv'));

    expect(parsedFile).toEqual(contents);
  });

  it('should not name a checklist without items as the default one', async () => {
    const contents = ChecklistFile.create({
      metadata: { name: 'Empty default checklist', defaultGroupIndex: 0, defaultChecklistIndex: 0 },
      groups: [
        {
          category: ChecklistGroup_Category.normal,
          title: 'Group 1',
          checklists: [
            {
              title: 'Checklist without items',
              completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
              items: [],
            },
            {
              title: 'Checklist 1',
              completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
              items: [ChecklistItem.create({ type: ChecklistItem_Type.ITEM_CHALLENGE, prompt: 'Seats' })],
            },
          ],
        },
      ],
    });

    const parsedFile = await CsvReader.read(new File([CsvWriter.write(contents)], 'default.csv'));

    // Checklists without items are dropped on export, so the default one falls back to the first remaining one
    expect(parsedFile.groups[0].checklists.map((checklist) => checklist.title)).toEqual(['Checklist 1']);
    expect(parsedFile.metadata?.defaultGroupIndex).toBe(0);
    expect(parsedFile.metadata?.defaultChecklistIndex).toBe(0);
  });

  it('should refer to cells in spreadsheet notation', () => {
    expect([0, 25, 26, 27, 701, 702].map((column) => CsvUtils.cellId(column, 1))).toEqual([
      'A2',
      'Z2',
      'AA2',
      'AB2',
      'ZZ2',
      'AAA2',
    ]);
  });

  it('should throw CsvFormatError when table header is missing', async () => {
    await expect(CsvReader.read(csvFile(['Name:,Test', 'some,random,data']))).rejects.toThrow(
      'did not find table header row',
    );
  });

  it('should throw CsvFormatError on missing Group column', async () => {
    await expect(
      CsvReader.read(csvFile(['Group,Checklist,Type,Text,Response,Indent,Center', ',Checklist 1,Title Bar,Test,,,'])),
    ).rejects.toThrow('cell A2: invalid/missing "Group" column value');
  });

  it('should throw CsvFormatError on missing Checklist column', async () => {
    await expect(
      CsvReader.read(csvFile(['Group,Checklist,Type,Text,Response,Indent,Center', 'Group 1,,Title Bar,Test,,,'])),
    ).rejects.toThrow('cell B2: invalid/missing "Checklist" column value');
  });

  it('should throw CsvFormatError on unknown type', async () => {
    await expect(
      CsvReader.read(
        csvFile(['Group,Checklist,Type,Text,Response,Indent,Center', 'Group 1,Checklist 1,UnknownType,Test,,,']),
      ),
    ).rejects.toThrow('cell C2: unknown type "UnknownType"');
  });

  it('should throw CsvFormatError on invalid indent value', async () => {
    await expect(
      CsvReader.read(
        csvFile(['Group,Checklist,Type,Text,Response,Indent,Center', 'Group 1,Checklist 1,Information,Test,,abc,']),
      ),
    ).rejects.toThrow('cell F2: invalid indent value "abc"');
  });

  it('should throw CsvFormatError when default group/checklist is not found', async () => {
    await expect(
      CsvReader.read(
        csvFile([
          'Default Group:,NonExistentGroup',
          'Default Checklist:,NonExistentChecklist',
          'Group,Checklist,Type,Text,Response,Indent,Center',
          'Group 1,Checklist 1,Information,Test,,,',
        ]),
      ),
    ).rejects.toThrow('default checklist "NonExistentChecklist" in group "NonExistentGroup" not found');
  });

  it('should throw CsvFormatError on an item of unknown type', () => {
    const contents = ChecklistFile.create({
      metadata: { name: 'Broken' },
      groups: [
        {
          title: 'Group 1',
          checklists: [{ title: 'Checklist 1', items: [ChecklistItem.create({ prompt: 'Mystery item' })] }],
        },
      ],
    });

    expect(() => CsvWriter.write(contents)).toThrow('unsupported item type');
  });
});
