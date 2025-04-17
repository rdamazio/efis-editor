import { ChecklistFile, ChecklistFileMetadata } from '../../../gen/ts/checklist';
import { AceReader } from './ace-reader';
import { FormatError } from './error';
import { FormatId } from './format-id';
import { parseChecklistFile, serializeChecklistFile } from './format-registry';
import { EXPECTED_CONTENTS } from './test-data';
import { loadFile } from './test-utils';

describe('AceWriter', () => {
  it('read then write back test file', async () => {
    // Read the test file.
    // The correctness of the reading is already checked in ace-reader.spec.ts
    const f = await loadFile('/model/formats/test.ace', 'test.ace');
    const readFile = await parseChecklistFile(f);

    // Now write the file back.
    const writtenFile = await serializeChecklistFile(readFile, FormatId.ACE);
    const writtenData = new Uint8Array(await writtenFile.arrayBuffer());
    const readData = new Uint8Array(await f.arrayBuffer());
    expect(writtenData.byteLength).toBeGreaterThan(1000);
    expect(writtenData).toEqual(readData);
  });

  describe('try writing files without a name', () => {
    [
      ChecklistFile.create({ metadata: undefined }),
      ChecklistFile.create({ metadata: ChecklistFileMetadata.create({ name: undefined }) }),
      ChecklistFile.create({ metadata: ChecklistFileMetadata.create({ name: '' }) }),
    ].forEach((file: ChecklistFile) => {
      it('write nameless file', async () => {
        await expectAsync(serializeChecklistFile(file, FormatId.ACE)).toBeRejectedWithError(FormatError);
      });
    });
  });

  describe('try writing files without metadata fields', () => {
    ['makeAndModel', 'aircraftInfo', 'manufacturerInfo', 'copyrightInfo'].forEach((field) => {
      it(`without ${field}`, async () => {
        const contents = ChecklistFile.clone(EXPECTED_CONTENTS);
        (contents.metadata as unknown as Record<string, string>)[field] = '';
        const writtenFile = await serializeChecklistFile(contents, FormatId.ACE);

        // Try reading back normally first.
        const readFile1 = await parseChecklistFile(writtenFile);
        expect(readFile1).toEqual(contents);

        // Read back without trimming to verify that the file contains a space in the metadata field.
        AceReader.trimMetadataFields = false;
        const readFile2 = await parseChecklistFile(writtenFile);
        const expectedContents2 = ChecklistFile.clone(EXPECTED_CONTENTS);
        (expectedContents2.metadata as unknown as Record<string, string>)[field] = ' ';
        expect(readFile2).toEqual(expectedContents2);
      });
    });

    afterEach(() => {
      AceReader.trimMetadataFields = true;
    });
  });
});
