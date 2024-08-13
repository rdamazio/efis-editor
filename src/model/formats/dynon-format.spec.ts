import { TestBed } from '@angular/core/testing';
import { DYNON_FORMAT_OPTIONS, DynonFormat } from './dynon-format';
import { EXPECTED_CONTENTS } from './test-data';
import { TextReader } from './text-reader';
import { TextWriter } from './text-writer';

const DYNON_EXPECTED_CONTENTS = new TextReader(new File([], 'fake'), DYNON_FORMAT_OPTIONS).testCaseify(
  EXPECTED_CONTENTS,
);

describe('DynonFormat', () => {
  beforeAll(() => {
    TextWriter.testingTime = new Date(2024, 4, 3);
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  describe('read then write back test file', () => {
    it('with no wrapping', async () => {
      await testWriteRead('test-dynon.txt');
    });
    it('with 31-column wrapping', async () => {
      await testWriteRead('test-dynon31.txt', 31);
    });
    it('with 40-column wrapping', async () => {
      await testWriteRead('test-dynon40.txt', 40);
    });
  });

  async function testWriteRead(fileName: string, maxLineLength?: number) {
    const f = await loadFile('/model/formats/' + fileName);
    const readFile = await DynonFormat.toProto(f);
    expect(readFile).toEqual(DYNON_EXPECTED_CONTENTS);

    // Now write the file back.
    const decoder = new TextDecoder('UTF-8');
    const writtenFile = await DynonFormat.fromProto(readFile, 'foo.txt', maxLineLength);
    const writtenData = decoder.decode(await writtenFile.arrayBuffer());
    const writtenLines = writtenData.split('\r\n');
    const readData = decoder.decode(await f.arrayBuffer());
    const readLines = readData.split('\r\n');
    expect(writtenLines).toEqual(readLines);
  }

  async function loadFile(url: string): Promise<File> {
    const response = await fetch(url);
    expect(response.ok).toBeTrue();
    const blob = await response.blob();
    return new File([blob], 'test.txt');
  }
});
