import { TestBed } from '@angular/core/testing';
import { JsonFormat } from './json-format';
import { EXPECTED_CONTENTS } from './test-data';

describe('JsonFormat', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({});
    });

    it('read test file', async () => {
        const f = await loadFile("/model/formats/test.json");
        const readFile = await JsonFormat.toProto(f);
        expect(readFile).toEqual(EXPECTED_CONTENTS);
    });

    async function loadFile(url: string): Promise<File> {
        const response = await fetch(url);
        expect(response.ok).toBeTrue();
        const blob = await response.blob();
        return new File([blob], 'test.json');
    }
});