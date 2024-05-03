import { ChecklistFile, ChecklistItem, ChecklistItem_Type } from "../../../gen/ts/checklist";

export const EXPECTED_CONTENTS: ChecklistFile = {
    groups: [
        {
            title: "Test group 1",
            checklists: [{
                title: "Test group 1 checklist 1",
                items: [
                    ChecklistItem.create({ prompt: "Challenge item", type: ChecklistItem_Type.ITEM_CHALLENGE }),
                    ChecklistItem.create({ prompt: "Challenge item 2", expectation: "Item response", type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE }),
                    ChecklistItem.create({ prompt: "Plain text item", type: ChecklistItem_Type.ITEM_PLAINTEXT }),
                    ChecklistItem.create({ prompt: "Note item", type: ChecklistItem_Type.ITEM_NOTE }),
                    ChecklistItem.create({ prompt: "Subtitle item", type: ChecklistItem_Type.ITEM_TITLE }),
                    ChecklistItem.create({ prompt: "Warning item", type: ChecklistItem_Type.ITEM_WARNING }),
                    ChecklistItem.create({ prompt: "Caution item", type: ChecklistItem_Type.ITEM_CAUTION }),
                    ChecklistItem.create({ prompt: "Item with 1 blank line", type: ChecklistItem_Type.ITEM_PLAINTEXT }),
                    ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE }),
                    ChecklistItem.create({ prompt: "Item with 2 blank lines", type: ChecklistItem_Type.ITEM_CHALLENGE }),
                    ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE }),
                    ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE }),
                    ChecklistItem.create({
                        prompt: "Item with a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long text",
                        expectation: "Response with a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long text",
                        type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE
                    }),
                    ChecklistItem.create({ prompt: "Item with indent 1", type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1 }),
                    ChecklistItem.create({ prompt: "Item with indent 2", type: ChecklistItem_Type.ITEM_NOTE, indent: 2 }),
                    ChecklistItem.create({ prompt: "Item with indent 3", type: ChecklistItem_Type.ITEM_CAUTION, indent: 3 }),
                    ChecklistItem.create({ prompt: "Item with indent 4", type: ChecklistItem_Type.ITEM_WARNING, indent: 4 }),
                    ChecklistItem.create({ prompt: "Centered item", type: ChecklistItem_Type.ITEM_TITLE, indent: 0, centered: true }),
                ],
            }],
        }, {
            title: "Test group 2 (default)",
            checklists: [
                {
                    title: "Test group 2 checklist 1",
                    items: [ChecklistItem.create({ prompt: "Test group 2 checklist 1 item 1", type: ChecklistItem_Type.ITEM_PLAINTEXT })],
                },
                {
                    title: "Test group 2 checklist 2",
                    items: [ChecklistItem.create({ prompt: "Test group 2 checklist 2 item 1", type: ChecklistItem_Type.ITEM_TITLE })],
                },
                {
                    title: "Test group 2 checklist 3 (default)",
                    items: [ChecklistItem.create({ prompt: "Test group 2 checklist 3 item 1", type: ChecklistItem_Type.ITEM_NOTE })],
                },
            ],
        },
    ],
    metadata: {
        name: "Test checklist name",
        defaultGroupIndex: 1,
        defaultChecklistIndex: 2,
        makeAndModel: "Test make and model",
        aircraftInfo: "Test aircraft",
        manufacturerInfo: "Test manufacturer",
        copyrightInfo: "Test copyright",
    },
};
