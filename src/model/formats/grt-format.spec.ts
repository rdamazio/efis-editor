import { TestBed } from '@angular/core/testing';
import { GRT_FORMAT_OPTIONS, GrtFormat } from './grt-format';
import { EXPECTED_CONTENTS } from './test-data';
import { TextReader } from './text-reader';

const GRT_EXPECTED_CONTENTS = new TextReader(new File([], 'fake'), GRT_FORMAT_OPTIONS).testCaseify(EXPECTED_CONTENTS);

describe('GrtFormat', () => {

    beforeEach(() => {
        TestBed.configureTestingModule({});
    });

    it('read test file', async () => {
        const f = await loadFile("/model/formats/test-grt.txt");
        const readFile = await GrtFormat.toProto(f);
        expect(readFile).toEqual(GRT_EXPECTED_CONTENTS);
    });

    async function loadFile(url: string): Promise<File> {
        const response = await fetch(url);
        expect(response.ok).toBeTrue();
        const blob = await response.blob();
        return new File([blob], 'test.txt');
    }
});