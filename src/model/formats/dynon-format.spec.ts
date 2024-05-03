import { TestBed } from '@angular/core/testing';
import { DYNON_FORMAT_OPTIONS, DynonFormat } from './dynon-format';
import { EXPECTED_CONTENTS } from './test-data';
import { TextReader } from './text-reader';

const DYNON_EXPECTED_CONTENTS = new TextReader(new File([], 'fake'), DYNON_FORMAT_OPTIONS).testCaseify(EXPECTED_CONTENTS);

describe('DynonFormat', () => {

    beforeEach(() => {
        TestBed.configureTestingModule({});
    });

    it('read test file', async () => {
        const f = await loadFile("/model/formats/test-dynon.txt");
        const readFile = await DynonFormat.toProto(f);
        expect(readFile).toEqual(DYNON_EXPECTED_CONTENTS);
    });

    async function loadFile(url: string): Promise<File> {
        const response = await fetch(url);
        expect(response.ok).toBeTrue();
        const blob = await response.blob();
        return new File([blob], 'test.txt');
    }
});