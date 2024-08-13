import { TestBed } from '@angular/core/testing';
import { ChecklistFile, ChecklistFileMetadata } from '../../../gen/ts/checklist';
import { AceReader } from './ace-reader';
import { AceWriter } from './ace-writer';
import { FormatError } from './error';

describe('AceWriter', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('read then write back test file', async () => {
    // Read the test file.
    // The correctness of the reading is already checked in ace-reader.spec.ts
    const f = await loadFile('/model/formats/test.ace');
    const readFile = await new AceReader(f).read();

    // Now write the file back.
    const writtenFile = await new AceWriter().write(readFile);
    const writtenData = new Uint8Array(await writtenFile.arrayBuffer());
    const readData = new Uint8Array(await f.arrayBuffer());
    expect(writtenData.byteLength).toBeGreaterThan(1000);
    expect(writtenData).toEqual(readData);
  });

  async function loadFile(url: string): Promise<File> {
    const response = await fetch(url);
    expect(response.ok).toBeTrue();
    const blob = await response.blob();
    return new File([blob], 'test.ace');
  }

  describe('try writing files without a name', async () => {
    [
      ChecklistFile.create({
        metadata: undefined,
      }),
      ChecklistFile.create({
        metadata: ChecklistFileMetadata.create({
          name: undefined,
        }),
      }),
      ChecklistFile.create({
        metadata: ChecklistFileMetadata.create({
          name: '',
        }),
      }),
    ].forEach((file) => {
      it('write nameless file', async () => {
        await expectAsync(new AceWriter().write(file)).toBeRejectedWithError(FormatError);
      });
    });
  });
});
