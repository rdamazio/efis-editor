import { TestBed } from '@angular/core/testing';
import { AceReader } from './ace-reader';
import { AceWriter } from './ace-writer';

describe('AceWriter', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({});
    });

    it('read then write back test file', async () => {
        // Read the test file.
        // The correctness of the reading is already checked in ace-reader.spec.ts
        let f = await loadFile("/model/formats/test.ace");
        let readFile = await new AceReader(f).read();

        // Now write the file back.
        let writtenFile = await new AceWriter().write(readFile);
        let writtenData = new Uint8Array(await writtenFile.arrayBuffer());
        let readData = new Uint8Array(await f.arrayBuffer());
        expect(writtenData.byteLength).toBeGreaterThan(1000);
        expect(writtenData).toEqual(readData);
    });

    async function loadFile(url: string): Promise<File> {
        const response = await fetch(url);
        expect(response.ok).toBeTrue();
        const blob = await response.blob();
        return new File([blob], 'test.ace');
    }
});