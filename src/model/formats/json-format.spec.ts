import { JsonFormat } from './json-format';
import { EXPECTED_CONTENTS } from './test-data';
import { loadFile } from './test-utils';

describe('JsonFormat', () => {
  it('read test file', async () => {
    const f = await loadFile('/model/formats/test.json', 'test.json');
    const readFile = await JsonFormat.toProto(f);
    expect(readFile).toEqual(EXPECTED_CONTENTS);
  });
});
