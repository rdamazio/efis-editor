import { CryptoUtils } from './crypto-utils';
import { FormatId } from './format-id';
import { parseChecklistFile, serializeChecklistFile } from './format-registry';
import { GarminPilotReader } from './garmin-pilot-reader';
import { GarminPilotUtils } from './garmin-pilot-utils';
import { EXPECTED_GARMIN_PILOT_CONTENTS } from './test-data';
import { loadFile } from './test-utils';

describe('GarminPilotFormat', () => {
  describe('GarminPilotUtils', () => {
    it('should encrypt and decrypt data passing round-trip', async () => {
      const checklistData = CryptoUtils.ENCODER.encode('oh my god secret secret is so amazing!');
      const encrypted = await GarminPilotUtils.encrypt(checklistData);
      const decrypted = await GarminPilotUtils.decrypt(await encrypted.arrayBuffer());
      expect(encrypted).not.toBe(new Blob([checklistData]));
      expect(encrypted.type).toBe('application/octet-stream');
      expect(decrypted).toEqual(checklistData);
    });
  });

  describe('GarminPilotReader', () => {
    it('should read test file', async () => {
      const file = await loadFile('/model/formats/test-garmin-pilot.gplts', 'test-garmin-pilot.gplts');
      const checklistFile = await parseChecklistFile(file);
      expect(checklistFile).toEqual(EXPECTED_GARMIN_PILOT_CONTENTS);
    });

    it('should pass a round-trip test', async () => {
      const writtenFile = await serializeChecklistFile(EXPECTED_GARMIN_PILOT_CONTENTS, FormatId.GARMIN_PILOT);
      const writtenData = new Uint8Array(await writtenFile.arrayBuffer());
      expect(writtenData.byteLength).toBeGreaterThan(10);

      const readFile = await GarminPilotReader.read(new File([writtenFile], 'test-garmin-pilot.gplts'));
      expect(readFile).toEqual(EXPECTED_GARMIN_PILOT_CONTENTS);
    });
  });
});
