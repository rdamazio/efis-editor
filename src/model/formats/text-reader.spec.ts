import { ChecklistGroup_Category, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { TextReader } from './text-reader';

describe('TextReader', () => {
  it('should parse a text file with groups and checklists', async () => {
    const textContent = `> BEFORE START
>> Cockpit
Item 1
Item 2 - RESPONSE
NOTE: This is a note
> EMERGENCY
>> Engine Failure
Airspeed - 76 KIAS
WARNING: Brace for impact`;

    const file = new File([textContent], 'test-checklist.txt', { type: 'text/plain' });
    const reader = new TextReader(file);
    const result = await reader.read();

    expect(result.metadata?.name).toBe('test-checklist');
    expect(result.groups.length).toBe(2);

    expect(result.groups[0].title).toBe('BEFORE START');
    expect(result.groups[0].category).toBe(ChecklistGroup_Category.normal);
    expect(result.groups[0].checklists.length).toBe(1);
    expect(result.groups[0].checklists[0].title).toBe('Cockpit');
    expect(result.groups[0].checklists[0].items.length).toBe(3);
    expect(result.groups[0].checklists[0].items[0].prompt).toBe('Item 1');
    expect(result.groups[0].checklists[0].items[0].type).toBe(ChecklistItem_Type.ITEM_PLAINTEXT);
    expect(result.groups[0].checklists[0].items[1].prompt).toBe('Item 2');
    expect(result.groups[0].checklists[0].items[1].expectation).toBe('RESPONSE');
    expect(result.groups[0].checklists[0].items[1].type).toBe(ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE);
    expect(result.groups[0].checklists[0].items[2].prompt).toBe('This is a note');
    expect(result.groups[0].checklists[0].items[2].type).toBe(ChecklistItem_Type.ITEM_NOTE);

    expect(result.groups[1].title).toBe('EMERGENCY');
    expect(result.groups[1].category).toBe(ChecklistGroup_Category.emergency);
    expect(result.groups[1].checklists.length).toBe(1);
    expect(result.groups[1].checklists[0].title).toBe('Engine Failure');
    expect(result.groups[1].checklists[0].items.length).toBe(2);
    expect(result.groups[1].checklists[0].items[0].prompt).toBe('Airspeed');
    expect(result.groups[1].checklists[0].items[0].expectation).toBe('76 KIAS');
    expect(result.groups[1].checklists[0].items[0].type).toBe(ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE);
    expect(result.groups[1].checklists[0].items[1].prompt).toBe('Brace for impact');
    expect(result.groups[1].checklists[0].items[1].type).toBe(ChecklistItem_Type.ITEM_WARNING);
  });

  it('should parse items without explicit checklist or group', async () => {
    const textContent = `Item 1\nItem 2`;

    const file = new File([textContent], 'loose-items.txt', { type: 'text/plain' });
    const reader = new TextReader(file);
    const result = await reader.read();

    expect(result.groups.length).toBe(1);
    expect(result.groups[0].title).toBe('Default Group');
    expect(result.groups[0].checklists.length).toBe(1);
    expect(result.groups[0].checklists[0].title).toBe('Default Group');
    expect(result.groups[0].checklists[0].items.length).toBe(2);
  });

  it('should parse items directly under a group without a checklist', async () => {
    const textContent = `> PREFLIGHT\nItem 1`;

    const file = new File([textContent], 'group-items.txt', { type: 'text/plain' });
    const reader = new TextReader(file);
    const result = await reader.read();

    expect(result.groups.length).toBe(1);
    expect(result.groups[0].title).toBe('PREFLIGHT');
    expect(result.groups[0].checklists.length).toBe(1);
    expect(result.groups[0].checklists[0].title).toBe('PREFLIGHT');
    expect(result.groups[0].checklists[0].items.length).toBe(1);
    expect(result.groups[0].checklists[0].items[0].prompt).toBe('Item 1');
  });

  it('should handle abnormal category', async () => {
    const textContent = `> ABNORMAL PROCEDURES\n>> Engine restart`;

    const file = new File([textContent], 'abnormal.txt', { type: 'text/plain' });
    const reader = new TextReader(file);
    const result = await reader.read();

    expect(result.groups[0].category).toBe(ChecklistGroup_Category.abnormal);
  });

  it('should handle an empty file', async () => {
    const file = new File([''], 'empty.txt', { type: 'text/plain' });
    const reader = new TextReader(file);
    const result = await reader.read();

    expect(result.groups.length).toBe(0);
  });
});