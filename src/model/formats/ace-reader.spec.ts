import { TestBed } from '@angular/core/testing';
import { ChecklistFile, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { AceReader } from './ace-reader';

describe('AceReader', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({});
    });

    it('read test file', async () => {
        const EXPECTED_CONTENTS: ChecklistFile = {
            name: "Test checklist name",
            groups: [
                {
                    title: "Test group 1",
                    checklists: [{
                        title: "Test group 1 checklist 1",
                        items: [
                            { prompt: "Challenge item", type: ChecklistItem_Type.ITEM_CHALLENGE, expectation: '', indent: 0, centered: false },
                            { prompt: "Challenge item 2", expectation: "Item response", type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE, indent: 0, centered: false },
                            { prompt: "Plain text item", type: ChecklistItem_Type.ITEM_PLAINTEXT, expectation: '', indent: 0, centered: false },
                            { prompt: "Note item", type: ChecklistItem_Type.ITEM_NOTE, expectation: '', indent: 0, centered: false },
                            { prompt: "Subtitle item", type: ChecklistItem_Type.ITEM_TITLE, expectation: '', indent: 0, centered: false },
                            { prompt: "Warning item", type: ChecklistItem_Type.ITEM_WARNING, expectation: '', indent: 0, centered: false },
                            { prompt: "Caution item", type: ChecklistItem_Type.ITEM_CAUTION, expectation: '', indent: 0, centered: false },
                            { prompt: "Item with 1 blank line", type: ChecklistItem_Type.ITEM_PLAINTEXT, expectation: '', indent: 0, centered: false },
                            { type: ChecklistItem_Type.ITEM_SPACE, prompt: '', expectation: '', indent: 0, centered: false },
                            { prompt: "Item with 2 blank lines", type: ChecklistItem_Type.ITEM_CHALLENGE, expectation: '', indent: 0, centered: false },
                            { type: ChecklistItem_Type.ITEM_SPACE, prompt: '', expectation: '', indent: 0, centered: false },
                            { type: ChecklistItem_Type.ITEM_SPACE, prompt: '', expectation: '', indent: 0, centered: false },
                            { prompt: "Item with a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long text", expectation: "Response with a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long text", type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE, indent: 0, centered: false },
                            { prompt: "Item with indent 1", expectation: '', type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1, centered: false },
                            { prompt: "Item with indent 2", expectation: '', type: ChecklistItem_Type.ITEM_NOTE, indent: 2, centered: false },
                            { prompt: "Item with indent 3", expectation: '', type: ChecklistItem_Type.ITEM_CAUTION, indent: 3, centered: false },
                            { prompt: "Item with indent 4", expectation: '', type: ChecklistItem_Type.ITEM_WARNING, indent: 4, centered: false },
                            { prompt: "Centered item", expectation: '', type: ChecklistItem_Type.ITEM_TITLE, indent: 0, centered: true },
                        ],
                    }],
                }, {
                    title: "Test group 2 (default)",
                    checklists: [
                        {
                            title: "Test group 2 checklist 1",
                            items: [{ prompt: "Test group 2 checklist 1 item 1", type: ChecklistItem_Type.ITEM_PLAINTEXT, expectation: '', indent: 0, centered: false }],
                        },
                        {
                            title: "Test group 2 checklist 2",
                            items: [{ prompt: "Test group 2 checklist 2 item 1", type: ChecklistItem_Type.ITEM_TITLE, expectation: '', indent: 0, centered: false }],
                        },
                        {
                            title: "Test group 2 checklist 3 (default)",
                            items: [{ prompt: "Test group 2 checklist 3 item 1", type: ChecklistItem_Type.ITEM_NOTE, expectation: '', indent: 0, centered: false }],
                        },
                    ],
                },
            ],
            metadata: {
                defaultGroupIndex: 1,
                defaultChecklistIndex: 2,
                makeAndModel: "Test make and model",
                aircraftInfo: "Test aircraft",
                manufacturerInfo: "Test manufacturer",
                copyrightInfo: "Test copyright",
            },
        };

        const f = await loadFile("/model/formats/test.ace");
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