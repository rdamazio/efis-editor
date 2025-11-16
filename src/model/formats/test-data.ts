import {
  Checklist_CompletionAction,
  ChecklistFile,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';

export const EXPECTED_CONTENTS = ChecklistFile.create({
  groups: [
    {
      category: ChecklistGroup_Category.normal,
      title: 'Test group 1',
      checklists: [
        {
          title: 'Test group 1 checklist 1',
          completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
          items: [
            ChecklistItem.create({ prompt: 'Challenge item', type: ChecklistItem_Type.ITEM_CHALLENGE }),
            ChecklistItem.create({
              prompt: 'Challenge item 2',
              expectation: 'Item response',
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
            }),
            ChecklistItem.create({ prompt: 'Plain text item', type: ChecklistItem_Type.ITEM_PLAINTEXT }),
            ChecklistItem.create({ prompt: 'Note item', type: ChecklistItem_Type.ITEM_NOTE }),
            ChecklistItem.create({ prompt: 'Subtitle item', type: ChecklistItem_Type.ITEM_TITLE }),
            ChecklistItem.create({ prompt: 'Warning item', type: ChecklistItem_Type.ITEM_WARNING }),
            ChecklistItem.create({ prompt: 'Caution item', type: ChecklistItem_Type.ITEM_CAUTION }),
            ChecklistItem.create({ prompt: 'Item with 1 blank line', type: ChecklistItem_Type.ITEM_PLAINTEXT }),
            ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE }),
            ChecklistItem.create({ prompt: 'Item with 2 blank lines', type: ChecklistItem_Type.ITEM_CHALLENGE }),
            ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE }),
            ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE }),
            ChecklistItem.create({
              prompt:
                'Item with a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long text',
              expectation:
                'Response with a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long text',
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
            }),
            ChecklistItem.create({ prompt: 'Item with indent 1', type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1 }),
            ChecklistItem.create({ prompt: 'Item with indent 2', type: ChecklistItem_Type.ITEM_NOTE, indent: 2 }),
            ChecklistItem.create({ prompt: 'Item with indent 3', type: ChecklistItem_Type.ITEM_CAUTION, indent: 3 }),
            ChecklistItem.create({ prompt: 'Item with indent 4', type: ChecklistItem_Type.ITEM_WARNING, indent: 4 }),
            ChecklistItem.create({
              prompt: 'Centered item',
              type: ChecklistItem_Type.ITEM_TITLE,
              indent: 0,
              centered: true,
            }),
          ],
        },
      ],
    },
    {
      category: ChecklistGroup_Category.normal,
      title: 'Test group 2 (default)',
      checklists: [
        {
          title: 'Test group 2 checklist 1',
          completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
          items: [
            ChecklistItem.create({
              prompt: 'Test group 2 checklist 1 item 1',
              type: ChecklistItem_Type.ITEM_PLAINTEXT,
            }),
          ],
        },
        {
          title: 'Test group 2 checklist 2',
          completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
          items: [
            ChecklistItem.create({ prompt: 'Test group 2 checklist 2 item 1', type: ChecklistItem_Type.ITEM_TITLE }),
          ],
        },
        {
          title: 'Test group 2 checklist 3 (default)',
          completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
          items: [
            ChecklistItem.create({ prompt: 'Test group 2 checklist 3 item 1', type: ChecklistItem_Type.ITEM_NOTE }),
          ],
        },
      ],
    },
  ],
  metadata: {
    name: 'Test checklist name',
    defaultGroupIndex: 1,
    defaultChecklistIndex: 2,
    makeAndModel: 'Test make and model',
    aircraftInfo: 'Test aircraft',
    manufacturerInfo: 'Test manufacturer',
    copyrightInfo: 'Test copyright',
  },
});

// Most formats don't support indented spaces, but for those that do, provide that.
export const EXPECTED_CONTENTS_WITH_INDENTED_SPACE: ChecklistFile = (() => {
  const expectedContents = ChecklistFile.clone(EXPECTED_CONTENTS);
  const blankItem = expectedContents.groups[0].checklists[0].items[8];
  if (blankItem.type !== ChecklistItem_Type.ITEM_SPACE) {
    throw new Error('Unexpected item type');
  }
  blankItem.indent = 1;
  return expectedContents;
})();

export const EXPECTED_CONTENTS_WITH_COMPLETION_ACTION: ChecklistFile = (() => {
  const expectedContents = ChecklistFile.clone(EXPECTED_CONTENTS_WITH_INDENTED_SPACE);
  expectedContents.groups[1].checklists[0].completionAction = Checklist_CompletionAction.ACTION_DO_NOTHING;
  expectedContents.groups[1].checklists[1].completionAction = Checklist_CompletionAction.ACTION_OPEN_FLIGHT_PLAN;
  expectedContents.groups[1].checklists[2].completionAction = Checklist_CompletionAction.ACTION_OPEN_TAXI_CHART;
  return expectedContents;
})();

export const EXPECTED_FOREFLIGHT_CONTENTS = ChecklistFile.create({
  groups: [
    { category: ChecklistGroup_Category.normal, title: 'Empty subgroup', checklists: [] },
    {
      category: ChecklistGroup_Category.normal,
      title: 'Subgroup with empty checklist',
      checklists: [
        {
          title: 'Empty checklist',
          completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
          items: [],
        },
      ],
    },
    {
      category: ChecklistGroup_Category.normal,
      title: 'Subgroup',
      checklists: [
        {
          title: 'Checklist',
          completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
          items: [
            ChecklistItem.create({ prompt: 'First', type: ChecklistItem_Type.ITEM_PLAINTEXT }),
            ChecklistItem.create({ prompt: 'Second', type: ChecklistItem_Type.ITEM_WARNING }),
            ChecklistItem.create({
              prompt: 'Challenge',
              expectation: 'RESPONSE',
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
            }),
            ChecklistItem.create({ prompt: 'Detail1', type: ChecklistItem_Type.ITEM_TITLE }),
            ChecklistItem.create({
              prompt: 'Another challenge',
              expectation: 'CHECK',
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
            }),
            ChecklistItem.create({
              prompt: 'Challenge with note',
              expectation: 'RESPONSE',
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
            }),
            ChecklistItem.create({ prompt: 'Notes', type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1 }),
            ChecklistItem.create({ prompt: 'Challenge w/o response', type: ChecklistItem_Type.ITEM_CHALLENGE }),
            ChecklistItem.create({
              prompt: 'Challenge without note',
              expectation: 'CHECK',
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
            }),
            ChecklistItem.create({ prompt: 'in-between', type: ChecklistItem_Type.ITEM_CAUTION }),
            ChecklistItem.create({
              prompt: 'Challenge',
              expectation: 'RESPONSE',
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
            }),
            ChecklistItem.create({ prompt: 'scary multiline note!', type: ChecklistItem_Type.ITEM_WARNING, indent: 1 }),
            ChecklistItem.create({ type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1 }),
            ChecklistItem.create({ prompt: 'line after line break.', type: ChecklistItem_Type.ITEM_NOTE, indent: 1 }),
            ChecklistItem.create({ prompt: 'Adjacent text.', type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1 }),
            ChecklistItem.create({
              prompt: 'Challenge',
              expectation: 'RESPONSE',
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
            }),
            ChecklistItem.create({ prompt: 'keep in mind ', type: ChecklistItem_Type.ITEM_CAUTION, indent: 1 }),
            ChecklistItem.create({ type: ChecklistItem_Type.ITEM_CHALLENGE }),
            ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE }),
            ChecklistItem.create({ prompt: 'Detail2', type: ChecklistItem_Type.ITEM_TITLE }),
            ChecklistItem.create({ prompt: 'With note', type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1 }),
            ChecklistItem.create({ prompt: 'Detail w/o title', type: ChecklistItem_Type.ITEM_PLAINTEXT }),
            ChecklistItem.create({ prompt: 'No title', type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1 }),
            ChecklistItem.create({ prompt: 'Multi', type: ChecklistItem_Type.ITEM_WARNING, indent: 1 }),
            ChecklistItem.create({ prompt: 'Line', type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1 }),
            ChecklistItem.create({ prompt: 'Note', type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1 }),
            ChecklistItem.create({ prompt: 'No title single line', type: ChecklistItem_Type.ITEM_PLAINTEXT }),
            ChecklistItem.create({ prompt: 'Detail3', type: ChecklistItem_Type.ITEM_TITLE }),
          ],
        },
      ],
    },
    { category: ChecklistGroup_Category.abnormal, title: 'Test empty abnormal subgroup', checklists: [] },
  ],
  metadata: {
    name: 'Checklist name',
    defaultGroupIndex: 0,
    defaultChecklistIndex: 0,
    makeAndModel: 'Make and model',
    aircraftInfo: 'TAIL NUMBER',
    manufacturerInfo: '',
    copyrightInfo: '',
  },
});

export const EXPECTED_GARMIN_PILOT_CONTENTS = ChecklistFile.create({
  groups: [
    {
      category: ChecklistGroup_Category.normal,
      title: 'Preflight',
      checklists: [
        {
          title: 'New Checklist - Normal Preflight ',
          completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
          items: [
            ChecklistItem.create({ type: ChecklistItem_Type.ITEM_CHALLENGE }),
            ChecklistItem.create({ type: ChecklistItem_Type.ITEM_CHALLENGE, prompt: 'Call w/o action' }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: 'Call with action ',
              expectation: 'Action',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              expectation: 'Action w/o Call',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              expectation: '\n\n',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_TITLE,
              prompt: 'Note subject w/o body',
            }),
            ChecklistItem.create({ prompt: 'Note body w/o subject', type: ChecklistItem_Type.ITEM_PLAINTEXT }),
            ChecklistItem.create({ prompt: 'Note subject', type: ChecklistItem_Type.ITEM_TITLE }),
            ChecklistItem.create({ prompt: 'Note body', type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1 }),
            ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: 'Local Altimeter ',
              expectation: '%LOCAL_ALTIMETER%',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: 'Open Nearest',
              expectation: '%OPEN_NEAREST%',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: 'Open ATIS ScratchPad',
              expectation: '%OPEN_ATIS_SCRATCHPAD%',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: 'Open CRAFT ScratchPad',
              expectation: '%OPEN_CRAFT_SCRATCHPAD%',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: 'Weather Frequency ',
              expectation: '%WEATHER_FREQUENCY%',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: 'Clearance Frequency ',
              expectation: '%CLEARANCE_FREQUENCY%',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: 'Ground/CTAF Frequency ',
              expectation: '%GROUND_CTAF_FREQUENCY%',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: 'Tower/CTAF Frequency ',
              expectation: '%TOWER_CTAF_FREQUENCY%',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: 'Approach Frequency ',
              expectation: '%APPROACH_FREQUENCY%',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: 'Center Frequency',
              expectation: '%CENTER_FREQUENCY%',
            }),
          ],
        },
      ],
    },
    {
      category: ChecklistGroup_Category.normal,
      title: 'Takeoff/Cruise',
      checklists: [
        {
          title: 'New Checklist - Normal Takeoff/Cruise',
          completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
          items: [],
        },
      ],
    },
    {
      category: ChecklistGroup_Category.normal,
      title: 'Landing',
      checklists: [
        {
          title: 'New Checklist - Normal Landing ',
          completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
          items: [],
        },
      ],
    },
    {
      category: ChecklistGroup_Category.normal,
      title: 'Other',
      checklists: [
        {
          title: 'New Checklist - Normal Other',
          completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
          items: [],
        },
      ],
    },
    {
      category: ChecklistGroup_Category.abnormal,
      title: 'Abnormal',
      checklists: [
        {
          title: 'New Checklist - Abnormal - Go to Next Checklist ',
          completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
          items: [],
        },
        {
          title: 'New Checklist - Completion - Do Nothing',
          completionAction: Checklist_CompletionAction.ACTION_DO_NOTHING,
          items: [],
        },
        {
          title: 'New Checklist - Completion Open Flight Plan',
          completionAction: Checklist_CompletionAction.ACTION_OPEN_FLIGHT_PLAN,
          items: [],
        },
        {
          title: 'New Checklist - Completion Close Flihgh Plan',
          completionAction: Checklist_CompletionAction.ACTION_CLOSE_FLIGHT_PLAN,
          items: [],
        },
        {
          title: 'New Checklist - Completion - Open SafeTaxi',
          completionAction: Checklist_CompletionAction.ACTION_OPEN_TAXI_CHART,
          items: [],
        },
        {
          title: 'New Checklist - Completion - Open Map',
          completionAction: Checklist_CompletionAction.ACTION_OPEN_MAP,
          items: [],
        },
      ],
    },
    {
      category: ChecklistGroup_Category.emergency,
      title: 'Emergency',
      checklists: [
        {
          title: 'New Checklist - Emergency ',
          completionAction: Checklist_CompletionAction.ACTION_DO_NOTHING,
          items: [],
        },
        {
          title: 'Notes Torture Checklist',
          completionAction: Checklist_CompletionAction.ACTION_DO_NOTHING,
          items: [
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_TITLE,
              prompt: 'Title without note',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_PLAINTEXT,
              prompt: 'Normal note',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_TITLE,
              prompt: 'Note with title',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_PLAINTEXT,
              prompt: 'And',
              indent: 1,
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_PLAINTEXT,
              prompt: 'Multiple',
              indent: 1,
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_PLAINTEXT,
              prompt: 'Lines',
              indent: 1,
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_NOTE,
              prompt: 'some note',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_TITLE,
              prompt: 'Note with title',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_PLAINTEXT,
              prompt: 'And one line',
              indent: 1,
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CAUTION,
              prompt: 'some caution ',
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_PLAINTEXT,
              prompt: 'Note without title',
              indent: 1,
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_PLAINTEXT,
              prompt: 'With',
              indent: 1,
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CAUTION,
              prompt: 'multiple',
              indent: 1,
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_PLAINTEXT,
              prompt: 'Lines',
              indent: 1,
            }),
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_WARNING,
              prompt: 'some warning',
            }),
          ],
        },
      ],
    },
  ],
  metadata: {
    name: 'New Checklist Binder',
  },
});
