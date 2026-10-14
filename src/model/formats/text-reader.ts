import {
  Checklist,
  Checklist_CompletionAction,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import { FormatUtils } from './format-utils';
import { TextFormatOptions } from './text-format-options';

export class TextReader {
  constructor(private readonly _file: File, private readonly _options?: TextFormatOptions) {}

  public async read(): Promise<ChecklistFile> {
    const text = await this._file.text();
    const lines = text.split(/\r?\n/);

    let name = this._file.name;
    if (name.toLowerCase().endsWith('.txt')) {
      name = name.slice(0, -4);
    }

    const outFile: ChecklistFile = {
      groups: [],
      metadata: ChecklistFileMetadata.create({
        name: name,
      }),
    };

    let currentGroup: ChecklistGroup | undefined = undefined;
    let currentChecklist: Checklist | undefined = undefined;

    const groupPrefix = this._options?.readGroupPrefix ?? '> ';
    const checklistPrefix = this._options?.readChecklistPrefix ?? '>> ';

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line.startsWith(checklistPrefix)) {
        const title = line.substring(checklistPrefix.length).trim();
        currentChecklist = Checklist.create({
          title,
          completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
        });

        if (!currentGroup) {
          currentGroup = {
            title: 'Default Group',
            checklists: [],
            category: ChecklistGroup_Category.normal,
          };
          outFile.groups.push(currentGroup);
        }
        currentGroup.checklists.push(currentChecklist);
      } else if (line.startsWith(groupPrefix)) {
        const title = line.substring(groupPrefix.length).trim();
        
        let category = ChecklistGroup_Category.normal;
        const upperTitle = title.toUpperCase();
        if (upperTitle.includes('EMERGENCY')) {
          category = ChecklistGroup_Category.emergency;
        } else if (upperTitle.includes('ABNORMAL')) {
          category = ChecklistGroup_Category.abnormal;
        }

        currentGroup = { title, checklists: [], category };
        outFile.groups.push(currentGroup);
        currentChecklist = undefined;
      } else if (line.length > 0) {
        if (!currentGroup) {
          currentGroup = { title: 'Default Group', checklists: [], category: ChecklistGroup_Category.normal };
          outFile.groups.push(currentGroup);
        }
        
        if (!currentChecklist) {
          currentChecklist = Checklist.create({
            title: currentGroup.title,
            completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
          });
          currentGroup.checklists.push(currentChecklist);
        }

        const item = this._parseItem(line);
        currentChecklist.items.push(item);
      }
    }

    return outFile;
  }

  private _parseItem(line: string): ChecklistItem {
    const separator = this._options?.expectationSeparator ?? ' - ';
    const splitIndex = line.indexOf(separator);
    if (splitIndex !== -1) {
      const prompt = line.substring(0, splitIndex).trim();
      const expectation = line.substring(splitIndex + separator.length).trim();
      return ChecklistItem.create({
        type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
        prompt,
        expectation,
      });
    }

    const partial = FormatUtils.promptToPartialChecklistItem(line);
    return ChecklistItem.create(partial);
  }
}