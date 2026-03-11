import { FormatId } from './format-id';
import { parseChecklistFile, serializeChecklistFile } from './format-registry';
import { DYNON_EXPECTED_CONTENTS } from './test-data';
import { loadFile } from './test-utils';
import { TextWriter } from './text-writer';

describe('DynonFormat', () => {
  beforeAll(() => {
    TextWriter.testingTime = new Date(2024, 4, 3);
  });

  afterAll(() => {
    TextWriter.testingTime = undefined;
  });

  describe('read then write back test file', () => {
    it('with no wrapping', async () => {
      await expectWriteRead('test-dynon.txt', FormatId.DYNON);
    });

    it('with 31-column wrapping', async () => {
      await expectWriteRead('test-dynon31.txt', FormatId.DYNON31);
    });

    it('with 40-column wrapping', async () => {
      await expectWriteRead('test-dynon40.txt', FormatId.DYNON40);
    });
  });

  async function expectWriteRead(fileName: string, formatId: FormatId): Promise<void> {
    const f = await loadFile('/src/model/formats/' + fileName, 'test.txt');
    const readFile = await parseChecklistFile(f);
    expect(readFile).toEqual(DYNON_EXPECTED_CONTENTS);

    // Now write the file back.
    const decoder = new TextDecoder('UTF-8');
    const writtenFile = await serializeChecklistFile(readFile, formatId);
    const writtenData = decoder.decode(await writtenFile.arrayBuffer());
    const writtenLines = writtenData.split('\r\n');
    const readData = decoder.decode(await f.arrayBuffer());
    const readLines = readData.split('\r\n');
    expect(writtenLines).toEqual(readLines);
  }
});
