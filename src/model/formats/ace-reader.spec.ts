import { TestBed } from '@angular/core/testing';
import { AceReader } from './ace-reader';
import { EXPECTED_CONTENTS } from './test-data';

describe('AceReader', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('read test file', async () => {
    const f = await loadFile('/model/formats/test.ace');
    const readFile = await new AceReader(f).read();
    expect(readFile).toEqual(EXPECTED_CONTENTS);
  });

  async function loadFile(url: string): Promise<File> {
    const response = await fetch(url);
    expect(response.ok).toBeTrue();
    const blob = await response.blob();
    return new File([blob], 'test.ace');
  }
});
