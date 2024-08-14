import { AceReader } from './ace-reader';
import { EXPECTED_CONTENTS } from './test-data';
import { loadFile } from './test-utils';

describe('AceReader', () => {
  it('read test file', async () => {
    const f = await loadFile('/model/formats/test.ace', 'test.ace');
    const readFile = await new AceReader(f).read();
    expect(readFile).toEqual(EXPECTED_CONTENTS);
  });
});
