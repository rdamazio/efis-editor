import { FormatId } from './format-id';
import { parseChecklistFile, serializeChecklistFile } from './format-registry';
import { GarminPilotReader } from './garmin-pilot-reader';
import { EXPECTED_GARMIN_PILOT_CONTENTS } from './test-data';
import { loadFile } from './test-utils';

describe('GarminPilotFormat', () => {
  describe('GarminPilotReader', () => {
    it('should read test file', async () => {
      const file = await loadFile('/model/formats/test-garmin-pilot.gplt', 'test-garmin-pilot.gplt');
      const checklistFile = await parseChecklistFile(file);
      expect(checklistFile).toEqual(EXPECTED_GARMIN_PILOT_CONTENTS);
    });

    it('should pass a round-trip test', async () => {
      const writtenFile = await serializeChecklistFile(EXPECTED_GARMIN_PILOT_CONTENTS, FormatId.GARMIN_PILOT);
      const writtenData = new Uint8Array(await writtenFile.arrayBuffer());
      expect(writtenData.byteLength).toBeGreaterThan(10);

      const readFile = await GarminPilotReader.read(new File([writtenFile], 'test-garmin-pilot.gplt'));
      expect(readFile).toEqual(EXPECTED_GARMIN_PILOT_CONTENTS);
    });
  });
});
