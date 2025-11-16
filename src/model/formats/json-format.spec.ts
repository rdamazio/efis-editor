import { parseChecklistFile } from './format-registry';
import { EXPECTED_CONTENTS_WITH_COMPLETION_ACTION } from './test-data';
import { loadFile } from './test-utils';

describe('JsonFormat', () => {
  it('read test file', async () => {
    const f = await loadFile('/model/formats/test.json', 'test.json');
    const readFile = await parseChecklistFile(f);
    expect(readFile).toEqual(EXPECTED_CONTENTS_WITH_COMPLETION_ACTION);
  });
});
