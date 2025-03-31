import { validate } from 'uuid';
import { ChecklistFileMetadata } from '../../../gen/ts/checklist';
import { ForeFlightChecklistMetadata } from '../../../gen/ts/foreflight';
import { ForeFlightReader } from './foreflight-reader';
import { ForeFlightUtils } from './foreflight-utils';
import { ForeFlightWriter } from './foreflight-writer';
import { EXPECTED_FOREFLIGHT_CONTENTS } from './test-data';
import { loadFile } from './test-utils';

describe('ForeFlightFormat', () => {
  describe('ForeFlightUtils', () => {
    it(`should generate uuid v4 objectIds w/o dashes`, () => {
      const objectId = ForeFlightUtils.getObjectId();

      const groupSizes = [8, 4, 4, 4, 12];
      const groupOctets: string[] = [];

      groupSizes.reduce((previousValue: number, currentValue: number) => {
        groupOctets.push(objectId.slice(previousValue, previousValue + currentValue));
        return previousValue + currentValue;
      }, 0);

      expect(objectId).toMatch(`[a-f0-9]{12}4[a-f0-9]{19}`); // check case and v4
      expect(validate(groupOctets.join('-'))).toBe(true);
    });

    it('should encrypt and decrypt data passing round-trip', async () => {
      const checklistData = 'oh my god secret secret is so amazing!';
      const encrypted = await ForeFlightUtils.encrypt(checklistData);
      const decrypted = await ForeFlightUtils.decrypt(await encrypted.arrayBuffer());
      expect(encrypted).not.toBe(new Blob([checklistData]));
      expect(encrypted.type).toBe('application/octet-stream');
      expect(decrypted).toBe(checklistData);
    });

    it('should determine checklist item type by prefix correctly', () => {
      for (const [expectedType, prefix] of ForeFlightUtils.CHECKLIST_ITEM_PREFIXES) {
        const { type: actualType, prompt: text } = ForeFlightUtils.promptToPartialChecklistItem(`${prefix}: text`);
        expect(actualType).toBe(expectedType);
        expect(text).toBe(': text');
      }
    });
  });

  describe('ForeFlightReader', () => {
    it('should determine correct checklist metadata', () => {
      const mockFile = new File([], 'bar.fmd');
      expect(ForeFlightReader.getChecklistMetadata(mockFile, ForeFlightChecklistMetadata.create())).toEqual(
        ChecklistFileMetadata.create({ name: 'bar' }),
      );

      const mockMetadata = ForeFlightChecklistMetadata.create({
        name: 'foo',
        tailNumber: 'TAIL NUMBER',
        detail: 'Wright Model B',
      });
      const actualMetadata = ForeFlightReader.getChecklistMetadata(mockFile, mockMetadata);
      expect(actualMetadata).toEqual(
        ChecklistFileMetadata.create({ name: 'foo', aircraftInfo: 'TAIL NUMBER', makeAndModel: 'Wright Model B' }),
      );
    });
  });

  it('should read test file', async () => {
    const file = await loadFile('/model/formats/test-foreflight.fmd', 'test-foreflight.fmd');
    const checklistFile = await ForeFlightReader.read(file);
    expect(checklistFile).toEqual(EXPECTED_FOREFLIGHT_CONTENTS);
  });

  /**
   * Test it this way to avoid having to deal with constantly changing objectIds
   **/
  it('should pass a round-trip test', async () => {
    const writtenFile = await ForeFlightWriter.write(EXPECTED_FOREFLIGHT_CONTENTS);
    const writtenData = new Uint8Array(await writtenFile.arrayBuffer());
    expect(writtenData.byteLength).toBeGreaterThan(1000);

    const readFile = await ForeFlightReader.read(new File([writtenFile], 'test-foreflight.fmd'));
    expect(readFile).toEqual(EXPECTED_FOREFLIGHT_CONTENTS);
  });
});
