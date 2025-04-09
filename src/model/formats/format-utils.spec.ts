import { ChecklistItem_Type } from '../../../gen/ts/checklist';
import { FormatUtils } from './format-utils';

describe('FormatUtils', () => {
  it('should determine checklist item type by prefix correctly', () => {
    for (const [expectedType, prefix] of FormatUtils.CHECKLIST_ITEM_PREFIXES) {
      const { type: actualType, prompt: text } = FormatUtils.promptToPartialChecklistItem(`${prefix}: text`);
      expect(actualType).toBe(expectedType);
      expect(text).toBe(': text');
    }
  });

  it('should determine checklist item prefix by type correctly', () => {
    for (const [expectedPrefix, type] of FormatUtils.CHECKLIST_ITEM_TYPES) {
      expect(FormatUtils.getChecklistItemPrefix(type)).toBe(expectedPrefix);
    }
  });

  it('should reject unknown checklist item types', () => {
    expect(() => {
      FormatUtils.getChecklistItemPrefix(ChecklistItem_Type.ITEM_SPACE);
    }).toThrowError(/unsupported item prefix type/);
  });
});
