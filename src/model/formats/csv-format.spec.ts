import { CsvReader } from './csv-reader';
import { FormatId } from './format-id';
import { parseChecklistFile, serializeChecklistFile } from './format-registry';
import { EXPECTED_CONTENTS } from './test-data';
import { loadFile } from './test-utils';

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

  it('should parse metadata correctly from CSV text', async () => {
    const csvText = [
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
    ].join('\n');

    const mockFile = new File([csvText], 'test.csv', { type: 'text/csv' });
    const checklistFile = await CsvReader.read(mockFile);

    expect(checklistFile.metadata?.name).toBe('My Airplane Checklists, Main');
    expect(checklistFile.metadata?.makeAndModel).toBe('Cessna 172');
    expect(checklistFile.metadata?.aircraftInfo).toBe('N12345');
    expect(checklistFile.metadata?.manufacturerInfo).toBe('Cessna');
    expect(checklistFile.metadata?.copyrightInfo).toBe('2026 Pilot');
    expect(checklistFile.metadata?.defaultGroupIndex).toBe(0);
    expect(checklistFile.metadata?.defaultChecklistIndex).toBe(0);

    expect(checklistFile.groups).toHaveLength(1);

    const group = checklistFile.groups[0];

    expect(group.title).toBe('Group 1');
    expect(group.checklists).toHaveLength(1);

    const items = group.checklists[0].items;

    expect(items).toHaveLength(4);
    expect(items[0].prompt).toBe('BEFORE START');
    expect(items[0].centered).toBe(true);
    expect(items[1].prompt).toBe('Seats');
    expect(items[1].expectation).toBe('ADJUSTED');
    expect(items[2].prompt).toBe('Note line');
    expect(items[2].indent).toBe(1);
  });

  it('should parse correctly when optional metadata is missing', async () => {
    const csvText = [
      'Name:,My Simple Checklist',
      '',
      'Group,Checklist,Type,Text,Response,Indent,Center',
      'Group 1,Checklist 1,Title Bar,BEFORE START,,,',
    ].join('\n');

    const mockFile = new File([csvText], 'simple.csv', { type: 'text/csv' });
    const checklistFile = await CsvReader.read(mockFile);

    expect(checklistFile.metadata?.name).toBe('My Simple Checklist');
    expect(checklistFile.metadata?.makeAndModel).toBe('');
    expect(checklistFile.metadata?.aircraftInfo).toBe('');
    expect(checklistFile.metadata?.manufacturerInfo).toBe('');
    expect(checklistFile.metadata?.copyrightInfo).toBe('');
    expect(checklistFile.metadata?.defaultGroupIndex).toBe(0);
    expect(checklistFile.metadata?.defaultChecklistIndex).toBe(0);

    expect(checklistFile.groups).toHaveLength(1);
  });

  it('should parse correctly when optional columns Indent and Center are missing', async () => {
    const csvText = [
      'Name:,My Simple Checklist',
      '',
      'Group,Checklist,Type,Text,Response',
      'Group 1,Checklist 1,Title Bar,BEFORE START,',
      'Group 1,Checklist 1,Challenge,Seats,ADJUSTED',
    ].join('\n');

    const mockFile = new File([csvText], 'no-indent.csv', { type: 'text/csv' });
    const checklistFile = await CsvReader.read(mockFile);

    expect(checklistFile.groups).toHaveLength(1);

    const items = checklistFile.groups[0].checklists[0].items;

    expect(items).toHaveLength(2);
    expect(items[0].prompt).toBe('BEFORE START');
    expect(items[0].centered).toBe(false);
    expect(items[1].prompt).toBe('Seats');
    expect(items[1].expectation).toBe('ADJUSTED');
    expect(items[1].indent).toBe(0);
  });

  it('should parse correctly when Group column value is omitted on subsequent rows', async () => {
    const csvText = [
      'Name:,My Simple Checklist',
      '',
      'Group,Checklist,Type,Text,Response',
      'Group 1,Checklist 1,Title Bar,BEFORE START,',
      ',Checklist 1,Challenge,Seats,ADJUSTED',
      ',Checklist 2,Challenge,Brakes,SET',
      'Group 2,Checklist 3,Information,Engine start,',
    ].join('\n');

    const mockFile = new File([csvText], 'omitted-group.csv', { type: 'text/csv' });
    const checklistFile = await CsvReader.read(mockFile);

    expect(checklistFile.groups).toHaveLength(2);
    expect(checklistFile.groups[0].title).toBe('Group 1');
    expect(checklistFile.groups[0].checklists).toHaveLength(2);
    expect(checklistFile.groups[0].checklists[0].items).toHaveLength(2);
    expect(checklistFile.groups[0].checklists[1].items).toHaveLength(1);
    expect(checklistFile.groups[1].title).toBe('Group 2');
    expect(checklistFile.groups[1].checklists).toHaveLength(1);
    expect(checklistFile.groups[1].checklists[0].items).toHaveLength(1);
  });

  it('should parse correctly when both Group and Checklist column values are omitted on subsequent rows', async () => {
    const csvText = [
      'Name:,My Simple Checklist',
      '',
      'Group,Checklist,Type,Text,Response',
      'Group 1,Checklist 1,Title Bar,BEFORE START,',
      ',,Challenge,Seats,ADJUSTED',
      ',Checklist 2,Challenge,Brakes,SET',
      'Group 2,Checklist 3,Information,Engine start,',
      ',,Information,Runup,',
    ].join('\n');

    const mockFile = new File([csvText], 'omitted-both.csv', { type: 'text/csv' });
    const checklistFile = await CsvReader.read(mockFile);

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

  it('should throw CsvFormatError when table header is missing', async () => {
    const csvText = 'Name:,Test\nsome,random,data';
    const mockFile = new File([csvText], 'invalid.csv');

    await expect(CsvReader.read(mockFile)).rejects.toThrow('Did not find table header row');
  });

  it('should throw CsvFormatError on missing Group column', async () => {
    const csvText = ['Group,Checklist,Type,Text,Response,Indent,Center', ',Checklist 1,Title Bar,Test,,,'].join('\n');
    const mockFile = new File([csvText], 'invalid.csv');

    await expect(CsvReader.read(mockFile)).rejects.toThrow('cell A2: invalid/missing "Group" column value');
  });

  it('should throw CsvFormatError on missing Checklist column', async () => {
    const csvText = ['Group,Checklist,Type,Text,Response,Indent,Center', 'Group 1,,Title Bar,Test,,,'].join('\n');
    const mockFile = new File([csvText], 'invalid.csv');

    await expect(CsvReader.read(mockFile)).rejects.toThrow('cell B2: invalid/missing "Checklist" column value');
  });

  it('should throw CsvFormatError on unknown type', async () => {
    const csvText = [
      'Group,Checklist,Type,Text,Response,Indent,Center',
      'Group 1,Checklist 1,UnknownType,Test,,,',
    ].join('\n');
    const mockFile = new File([csvText], 'invalid.csv');

    await expect(CsvReader.read(mockFile)).rejects.toThrow('cell C2: unknown type "UnknownType"');
  });

  it('should throw CsvFormatError on invalid indent value', async () => {
    const csvText = [
      'Group,Checklist,Type,Text,Response,Indent,Center',
      'Group 1,Checklist 1,Information,Test,,abc,',
    ].join('\n');
    const mockFile = new File([csvText], 'invalid.csv');

    await expect(CsvReader.read(mockFile)).rejects.toThrow('cell F2: invalid indent value "abc"');
  });

  it('should throw CsvFormatError when default group/checklist is not found', async () => {
    const csvText = [
      'Default Group:,NonExistentGroup',
      'Default Checklist:,NonExistentChecklist',
      'Group,Checklist,Type,Text,Response,Indent,Center',
      'Group 1,Checklist 1,Information,Test,,,',
    ].join('\n');
    const mockFile = new File([csvText], 'invalid.csv');

    await expect(CsvReader.read(mockFile)).rejects.toThrow(
      'Default checklist "NonExistentChecklist" in group "NonExistentGroup" not found',
    );
  });
});
