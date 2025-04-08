import { ChecklistItem, ChecklistItem_Type } from '../../../gen/ts/checklist';
import { FormatError } from './error';

export function swap<T1, T2>([a, b]: [T1, T2]): [T2, T1] {
  return [b, a];
}

interface PartialChecklistItem {
  type: ChecklistItem_Type;
  prompt: string;
}

export class FormatUtils {
  private static readonly NOTE_INDENT = 1;

  public static readonly CHECKLIST_ITEM_PREFIXES = new Map([
    [ChecklistItem_Type.ITEM_PLAINTEXT, ''],
    [ChecklistItem_Type.ITEM_NOTE, 'NOTE: '],
    [ChecklistItem_Type.ITEM_CAUTION, 'CAUTION: '],
    [ChecklistItem_Type.ITEM_WARNING, 'WARNING: '],
  ]);

  private static readonly CHECKLIST_ITEM_TYPES = new Map(
    Array.from(FormatUtils.CHECKLIST_ITEM_PREFIXES.entries()).map((item) => swap(item)),
  );

  public static getChecklistItemPrefix(type: ChecklistItem_Type): string {
    const prefix = FormatUtils.CHECKLIST_ITEM_PREFIXES.get(type);
    if (prefix === undefined) {
      throw new FormatError(`unsupported item prefix type: ${type}`);
    }
    return prefix;
  }

  private static _splitLines(text: string): string[] {
    return text.split(/\r?\n/);
  }

  private static _splitByColon(text: string): [string, string] {
    const matches = /^([^:]+: )?(.*)$/.exec(text); // eslint-disable-line prefer-named-capture-group
    return matches !== null ? [matches[1] || '', matches[2]] : ['', text];
  }

  public static promptToPartialChecklistItem(prompt: string): PartialChecklistItem {
    const [prefix, rest] = FormatUtils._splitByColon(prompt);
    const itemType = FormatUtils.CHECKLIST_ITEM_TYPES.get(prefix);
    return itemType !== undefined
      ? { type: itemType, prompt: rest }
      : { type: ChecklistItem_Type.ITEM_PLAINTEXT, prompt: prompt };
  }

  public static possiblyMultilineNoteToChecklistItems(text: string, standalone: boolean): ChecklistItem[] {
    const noteLines = FormatUtils._splitLines(text);
    return noteLines.map((noteLine) =>
      ChecklistItem.create({
        // Add extra indent for lines belonging to the same multiline note or notes attached to a previous item
        indent: noteLines.length > 1 || !standalone ? FormatUtils.NOTE_INDENT : 0,
        ...FormatUtils.promptToPartialChecklistItem(noteLine),
      }),
    );
  }

  public static shouldMergeNotes(
    itemEFIS: ChecklistItem,
    lastItemEFIS: ChecklistItem,
    titleLikeItems: ChecklistItem_Type[] = [ChecklistItem_Type.ITEM_TITLE, ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE],
  ): boolean {
    return (
      // Previous item was a title-like entry (detail or check item with note)
      (titleLikeItems.includes(lastItemEFIS.type) && lastItemEFIS.indent < itemEFIS.indent) ||
      // Previous item was an indented note-like entry (multiline note)
      ([...FormatUtils.CHECKLIST_ITEM_PREFIXES.keys()].includes(lastItemEFIS.type) &&
        lastItemEFIS.indent <= itemEFIS.indent &&
        lastItemEFIS.indent >= FormatUtils.NOTE_INDENT)
    );
  }
}
