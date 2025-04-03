import { EXPECTED_CONTENTS } from './test-data';
import { loadFile } from './test-utils';
import { parseChecklistFile } from './format-registry';

describe('JsonFormat', () => {
  it('read test file', async () => {
    const f = await loadFile('/model/formats/test.json', 'test.json');
    const readFile = await parseChecklistFile(f);
    expect(readFile).toEqual(EXPECTED_CONTENTS);
  });
});
