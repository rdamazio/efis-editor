import { ChecklistGroup_Category } from '../../../gen/ts/checklist';
import { ForeFlightCategory, ForeFlightUtils } from './foreflight-utils';
import { EXPECTED_FOREFLIGHT_CONTENTS } from './test-data';
import { ForeFlightReader } from './foreflight-reader';
import { loadFile } from './test-utils';
import { ForeFlightWriter } from './foreflight-writer';

describe('ForeFlightFormat', () => {
  describe('ForeFlightUtils', () => {
    it(`should generate ${ForeFlightUtils.OBJECT_ID_LENGTH}-characters long alphanumeric IDs`, async () => {
      const objectId = await ForeFlightUtils.getObjectId();
      expect(objectId).toMatch(`[a-z0-9]{${ForeFlightUtils.OBJECT_ID_LENGTH}}`);
    });

    it('should encrypt and decrypt data passing round-trip', async () => {
      const checklistData = 'oh my god secret secret is so amazing!';
      const encrypted = await ForeFlightUtils.encrypt(checklistData);
      const decrypted = await ForeFlightUtils.decrypt(await encrypted.arrayBuffer());
      expect(encrypted).not.toBe(new Blob([checklistData]));
      expect(encrypted.type).toBe('application/octet-stream');
      expect(decrypted).toBe(checklistData);
    });

    it('should map ForeFlight categories to EFIS', async () => {
      expect(ForeFlightUtils.categoryToEFIS(ForeFlightCategory.Normal)).toBe(ChecklistGroup_Category.NORMAL);
      expect(() => {
        ForeFlightUtils.categoryToEFIS('undefined');
      }).toThrowError("ForeFlight: unknown category 'undefined'");
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
