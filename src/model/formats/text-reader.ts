import escapeStringRegexp from 'escape-string-regexp';

import {
  Checklist,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import { FormatError } from './error';
import {
  DEFAULT_FIRST_GROUP,
  METADATA_AIRCRAFT_TITLE,
  METADATA_CHECKLIST_TITLE,
  METADATA_COPYRIGHT_TITLE,
  METADATA_FILE_TITLE,
  METADATA_MAKE_MODEL_TITLE,
  METADATA_MANUFACTURER_TITLE,
  TextFormatOptions,
  WRAP_PREFIX,
} from './text-format-options';

export class TextReader {
  private readonly _titleSuffix: string;
  private readonly _checklistPrefixMatch: RegExp;
  private readonly _itemPrefixMatch: RegExp;
  private readonly _checklistNumOffset: number;
  private readonly _itemNumOffset: number;

  constructor(
    private _file: File,
    private _options: TextFormatOptions,
  ) {
    this._titleSuffix = this._options.titlePrefixSuffix.split('').reverse().join('');
    this._checklistPrefixMatch =
      this._options.checklistPrefixMatcher || new RegExp('^' + escapeStringRegexp(this._options.checklistPrefix) + '$');
    this._itemPrefixMatch =
      this._options.itemPrefixMatcher || new RegExp('^' + escapeStringRegexp(this._options.itemPrefix) + '$');
    this._checklistNumOffset = this._options.checklistZeroIndexed ? 0 : 1;
    this._itemNumOffset = this._options.checklistItemZeroIndexed ? 0 : 1;
  }

  public async read(): Promise<ChecklistFile> {
    let name = this._file.name;
    for (const ext of this._options.fileExtensions) {
      if (name.toLowerCase().endsWith(ext.toLowerCase())) {
        name = name.slice(0, -ext.length);
        break;
      }
    }

    const groupSep = this._options.groupNameSeparator;

    const outFile: ChecklistFile = {
      metadata: ChecklistFileMetadata.create({
        name: name,
      }),
      groups: [],
    };
    const text = await this._file.text();
    const lines = text.split(/\r?\n/);
    let currentGroup: ChecklistGroup | undefined;
    let currentChecklist: Checklist | undefined;
    let currentItemSeen = false;
    let currentItemContents = '';
    let currentItemIndent = 0;
    let currentItemStartSpaces = 0;
    let currentChecklistNum = 0;
    let currentItemLineNum = 0;
    const processItem = () => {
      if (currentItemSeen && currentChecklist) {
        const item = this._itemForContents(currentItemContents, currentItemIndent, currentItemStartSpaces);
        if (
          !this._options.checklistTopBlankLine ||
          item.type !== ChecklistItem_Type.ITEM_SPACE ||
          currentChecklist.items.length > 0
        ) {
          currentChecklist.items.push(item);
        }
        currentItemContents = '';
        currentItemSeen = false;
      }
    };
    for (const line of lines) {
      if (this._options.commentPrefix && line.startsWith(this._options.commentPrefix)) {
        continue;
      }
      if (!line.trim()) {
        continue;
      }

      const firstSpaceIdx = line.indexOf(' ');
      let prefix, lineContents: string;
      if (firstSpaceIdx === -1) {
        prefix = line;
        lineContents = '';
      } else {
        prefix = line.slice(0, firstSpaceIdx === -1 ? line.length : firstSpaceIdx);
        lineContents = line.slice(firstSpaceIdx + 1);
      }

      const checklistMatch = this._checklistPrefixMatch.exec(prefix);
      if (checklistMatch) {
        // If we had an item we were accumulating contents for, process it now.
        processItem();

        let groupTitle = this._properCase(DEFAULT_FIRST_GROUP);
        let checklistTitle = lineContents;

        if (groupSep && (outFile.groups.length > 0 || !this._options.skipFirstGroup)) {
          const groupSepIdx = lineContents.indexOf(groupSep);
          if (groupSepIdx !== -1) {
            groupTitle = lineContents.slice(0, groupSepIdx);
            checklistTitle = lineContents.slice(groupSepIdx + groupSep.length);
          }
        }
        if (!currentGroup || currentGroup.title !== groupTitle) {
          currentGroup = {
            title: groupTitle,
            checklists: [],
            category: ChecklistGroup_Category.normal,
          };
          outFile.groups.push(currentGroup);
        }

        currentChecklist = {
          title: checklistTitle,
          items: [],
        };
        currentGroup.checklists.push(currentChecklist);
        currentItemLineNum = 0;
        currentChecklistNum++;

        if (checklistMatch.groups && 'checklistNum' in checklistMatch.groups) {
          const checklistNum = parseInt(checklistMatch.groups['checklistNum'] as string);
          const expectedNum = currentChecklistNum - 1 + this._checklistNumOffset;
          if (checklistNum !== expectedNum) {
            throw new FormatError(
              `Unexpected checklist number ${checklistNum} in "${prefix}" (expected ${expectedNum})`,
            );
          }
        }

        continue;
      }

      const itemMatch = this._itemPrefixMatch.exec(prefix);
      if (itemMatch) {
        if (!currentChecklist || !currentGroup) {
          throw new FormatError('Checklist item found before start of checklist');
        }

        currentItemStartSpaces = lineContents.length - lineContents.trimStart().length;
        const newIndent = Math.floor(currentItemStartSpaces / this._options.indentWidth);
        lineContents = lineContents.slice(newIndent * this._options.indentWidth);

        if (lineContents.startsWith(WRAP_PREFIX)) {
          // Wrapped line found - add to previous item.
          const wrappedContents = lineContents.slice(WRAP_PREFIX.length);
          currentItemContents += ' ' + wrappedContents;
        } else {
          // Entirely new item found.

          // Process the previous item that we were accumulating contents for.
          processItem();

          // Start accumulating new contents.
          currentItemContents = lineContents;
          currentItemIndent = newIndent;
          currentItemSeen = true;
        }

        if (itemMatch.groups) {
          if ('checklistNum' in itemMatch.groups) {
            const checklistNum = parseInt(itemMatch.groups['checklistNum'] as string);
            const expectedNum = currentChecklistNum - 1 + this._checklistNumOffset;
            if (checklistNum !== expectedNum) {
              throw new FormatError(
                `Unexpected checklist number ${checklistNum} in "${prefix}" (expected ${expectedNum})`,
              );
            }
          }
          if ('itemNum' in itemMatch.groups) {
            const itemNum = parseInt(itemMatch.groups['itemNum'] as string);
            const expectedNum = currentItemLineNum + this._itemNumOffset;
            if (itemNum !== expectedNum) {
              throw new FormatError(`Unexpected item number ${itemNum} in "${prefix}" (expected ${expectedNum})`);
            }
          }
        }
        currentItemLineNum++;
        continue;
      }

      throw new FormatError(`Unexpected line format: prefix="${prefix}"; contents="${line}"`);
    }
    // Process the last item.
    processItem();

    if (currentChecklist && currentChecklist.title === this._properCase(METADATA_CHECKLIST_TITLE)) {
      outFile.metadata = this._extractMetadata(currentChecklist);
      currentGroup!.checklists.pop();
      if (currentGroup!.checklists.length === 0) {
        // Group only had the metadata
        outFile.groups.pop();
      }
    }

    if (!outFile.metadata!.name) {
      throw new FormatError('No file name in uploaded file');
    }
    return outFile;
  }

  private _itemForContents(contents: string, indent: number, startSpaces: number): ChecklistItem {
    const endTrimmedContents = contents.trimEnd();
    const endSpaces = contents.length - endTrimmedContents.length;
    // If it was indented on both sides, meaning it was centered
    const centered = endSpaces > 0 && endSpaces === startSpaces;
    if (centered) {
      indent = 0;
    }

    let prompt = endTrimmedContents.trimStart();
    let expectation = '';
    let itemType = ChecklistItem_Type.ITEM_CHALLENGE;
    if (!prompt) {
      itemType = ChecklistItem_Type.ITEM_SPACE;
    } else if (prompt.startsWith(this._options.notePrefix)) {
      itemType = ChecklistItem_Type.ITEM_NOTE;
      prompt = prompt.slice(this._options.notePrefix.length);
    } else if (prompt.startsWith(this._options.titlePrefixSuffix) && prompt.endsWith(this._titleSuffix)) {
      itemType = ChecklistItem_Type.ITEM_TITLE;
      prompt = prompt.slice(this._options.titlePrefixSuffix.length, -this._titleSuffix.length);
    } else if (prompt.startsWith(this._options.warningPrefix)) {
      itemType = ChecklistItem_Type.ITEM_WARNING;
      prompt = prompt.slice(this._options.warningPrefix.length);
    } else if (prompt.startsWith(this._options.cautionPrefix)) {
      itemType = ChecklistItem_Type.ITEM_CAUTION;
      prompt = prompt.slice(this._options.cautionPrefix.length);
    } else {
      const responseSepIdx = prompt.indexOf(this._options.expectationSeparator);
      if (responseSepIdx !== -1) {
        itemType = ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE;
        expectation = prompt.slice(responseSepIdx + this._options.expectationSeparator.length);
        prompt = prompt.slice(0, responseSepIdx);
      }
    }

    return {
      prompt: prompt,
      expectation: expectation,
      type: itemType,
      indent: indent,
      centered: centered,
    };
  }

  private _extractMetadata(checklist: Checklist): ChecklistFileMetadata {
    const metadata = ChecklistFileMetadata.create();

    // Extract metadata.
    const items = checklist.items;
    for (let i = 0; i < items.length - 1; i++) {
      const item = items[i];
      if (item.prompt === this._properCase(METADATA_FILE_TITLE)) {
        metadata.name = items[++i].prompt;
      } else if (item.prompt === this._properCase(METADATA_MAKE_MODEL_TITLE)) {
        metadata.makeAndModel = items[++i].prompt;
      } else if (item.prompt === this._properCase(METADATA_AIRCRAFT_TITLE)) {
        metadata.aircraftInfo = items[++i].prompt;
      } else if (item.prompt === this._properCase(METADATA_MANUFACTURER_TITLE)) {
        metadata.manufacturerInfo = items[++i].prompt;
      } else if (item.prompt === this._properCase(METADATA_COPYRIGHT_TITLE)) {
        metadata.copyrightInfo = items[++i].prompt;
      }
    }
    return metadata;
  }

  private _properCase(str: string) {
    if (this._options.allUppercase) {
      return str.toUpperCase();
    } else {
      return str;
    }
  }

  public testCaseify(file: ChecklistFile): ChecklistFile {
    const out = ChecklistFile.clone(file);
    const metadata = out.metadata;
    if (metadata) {
      metadata.aircraftInfo = this._properCase(metadata.aircraftInfo);
      metadata.copyrightInfo = this._properCase(metadata.copyrightInfo);
      metadata.makeAndModel = this._properCase(metadata.makeAndModel);
      metadata.manufacturerInfo = this._properCase(metadata.manufacturerInfo);
      metadata.name = this._properCase(metadata.name);

      // Not supported
      metadata.defaultChecklistIndex = 0;
      metadata.defaultGroupIndex = 0;
    }

    let firstGroup = true;
    for (const group of out.groups) {
      if (firstGroup && this._options.skipFirstGroup) {
        group.title = this._properCase(DEFAULT_FIRST_GROUP);
      }
      firstGroup = false;
      group.title = this._properCase(group.title);
      for (const list of group.checklists) {
        list.title = this._properCase(list.title);
        for (const item of list.items) {
          item.prompt = this._properCase(item.prompt);
          item.expectation = this._properCase(item.expectation);

          // Not supported.
          if (item.type === ChecklistItem_Type.ITEM_PLAINTEXT) {
            item.type = ChecklistItem_Type.ITEM_CHALLENGE;
          }
        }
      }
    }
    return out;
  }
}
