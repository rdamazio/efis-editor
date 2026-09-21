import { ChecklistFile, ChecklistGroup_Category, ChecklistItem, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { FormatError } from './error';
import { FormatId } from './format-id';
import { FORMAT_REGISTRY, parseChecklistFile, serializeChecklistFile } from './format-registry';
import { loadFile } from './test-utils';

const HEADER = 'list,section,label1,label2,labelOnly,labelOnlyBackgroundColor,mandatory';

function challengeResponse(prompt: string, expectation: string): ChecklistItem {
  return ChecklistItem.create({ prompt, expectation, type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE });
}

const EXPECTED_MIRACHECK_CONTENTS = ChecklistFile.create({
  metadata: { name: 'N12345' },
  groups: [
    {
      title: 'Preflight',
      category: ChecklistGroup_Category.normal,
      checklists: [
        {
          title: 'Before Start',
          items: [
            challengeResponse('Fuel Selector', 'Both'),
            challengeResponse('Master', 'On'),
            challengeResponse('Throttle', '1,000 RPM'),
            ChecklistItem.create({ prompt: 'Engine Run-up', type: ChecklistItem_Type.ITEM_TITLE }),
            ChecklistItem.create({ prompt: 'Mixture', type: ChecklistItem_Type.ITEM_CHALLENGE }),
          ],
        },
        {
          title: 'Before Takeoff',
          items: [challengeResponse('Doors', 'Closed, latched')],
        },
      ],
    },
    {
      title: 'Emergency',
      category: ChecklistGroup_Category.emergency,
      checklists: [
        {
          title: 'Engine Fire',
          items: [
            challengeResponse('Radio', 'Declare "MAYDAY"'),
            challengeResponse('Land', 'As soon as possible and if the fire does not go out, evacuate'),
          ],
        },
      ],
    },
    {
      title: 'Reference',
      category: ChecklistGroup_Category.normal,
      checklists: [
        {
          title: 'Speeds',
          items: [
            ChecklistItem.create({ prompt: 'V-Speeds', type: ChecklistItem_Type.ITEM_CHALLENGE }),
            ChecklistItem.create({ prompt: 'Vx - 60 kts', type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1 }),
            ChecklistItem.create({ prompt: 'Vy - 75 kts', type: ChecklistItem_Type.ITEM_PLAINTEXT, indent: 1 }),
          ],
        },
      ],
    },
  ],
});

describe('MiracheckFormat', () => {
  it('reads test file', async () => {
    const f = await loadFile('/src/model/formats/test-miracheck.csv', 'N12345.csv');
    const readFile = await parseChecklistFile(f);

    expect(readFile).toEqual(EXPECTED_MIRACHECK_CONTENTS);
  });

  it('reads well-formed CSV with CRLF line endings', async () => {
    const contents = [
      HEADER,
      '"Abnormal","Alternator Failure","Master","Off",false,#FFF8C6,true',
      '"Abnormal","Alternator Failure","Loads","Shed, then land",false,#FFF8C6,false',
      '',
    ].join('\r\n');
    const readFile = await parseChecklistFile(new File([contents], 'Plane.CSV'));

    expect(readFile).toEqual(
      ChecklistFile.create({
        metadata: { name: 'Plane' },
        groups: [
          {
            title: 'Abnormal',
            category: ChecklistGroup_Category.abnormal,
            checklists: [
              {
                title: 'Alternator Failure',
                items: [challengeResponse('Master', 'Off'), challengeResponse('Loads', 'Shed, then land')],
              },
            ],
          },
        ],
      }),
    );
  });

  it('rejects CSV files with a different header', async () => {
    const f = new File(['a,b,c\n1,2,3\n'], 'other.csv');

    await expect(FORMAT_REGISTRY.getFormat(FormatId.MIRACHECK).toProto(f)).rejects.toThrow(/unexpected header/);
  });

  it('rejects CSV files without any items', async () => {
    const f = new File([`${HEADER}\n`], 'empty.csv');

    await expect(FORMAT_REGISTRY.getFormat(FormatId.MIRACHECK).toProto(f)).rejects.toThrow(/No checklist items/);
  });

  it('does not support export', async () => {
    expect(FORMAT_REGISTRY.getSupportedOutputFormats().map((format) => format.id)).not.toContain(FormatId.MIRACHECK);
    await expect(serializeChecklistFile(EXPECTED_MIRACHECK_CONTENTS, FormatId.MIRACHECK)).rejects.toThrow(FormatError);
  });
});
