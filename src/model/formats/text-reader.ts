import escapeStringRegexp from 'escape-string-regexp';

import { Checklist, ChecklistFile, ChecklistFileMetadata, ChecklistGroup, ChecklistItem, ChecklistItem_Type } from "../../../gen/ts/checklist";
import { FormatError } from "./error";
import { DEFAULT_FIRST_GROUP, METADATA_AIRCRAFT_TITLE, METADATA_CHECKLIST_TITLE, METADATA_COPYRIGHT_TITLE, METADATA_FILE_TITLE, METADATA_MAKE_MODEL_TITLE, METADATA_MANUFACTURER_TITLE, TextFormatOptions, WRAP_PREFIX } from "./text-format-options";

export class TextReader {
    private readonly _titleSuffix: string;
    private readonly _checklistPrefixMatch: RegExp;
    private readonly _itemPrefixMatch: RegExp;

    constructor(
        private _file: File,
        private _options: TextFormatOptions,
    ) {
        this._titleSuffix = this._options.titlePrefixSuffix.split('').reverse().join('');
        this._checklistPrefixMatch = this._options.checklistPrefixMatcher ||
            new RegExp('^' + escapeStringRegexp(this._options.checklistPrefix) + '$');
        this._itemPrefixMatch = this._options.itemPrefixMatcher ||
            new RegExp('^' + escapeStringRegexp(this._options.itemPrefix) + '$');
    }

    public async read(): Promise<ChecklistFile> {
        let name = this._file.name;
        for (let ext of this._options.fileExtensions) {
            if (name.endsWith(ext)) {
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
        const processItem = () => {
            if (currentItemSeen && currentChecklist) {
                let item = this._itemForContents(currentItemContents, currentItemIndent);
                if (!this._options.checklistTopBlankLine || item.type !== ChecklistItem_Type.ITEM_SPACE ||
                    currentChecklist.items.length > 0) {
                    currentChecklist.items.push(item);

                    const debugstr = ChecklistItem.toJsonString(item);
                }
                currentItemContents = '';
                currentItemSeen = false;
            }
        };
        for (let line of lines) {
            if (this._options.commentPrefix && line.startsWith(this._options.commentPrefix)) {
                console.log(`Skipped as a comment`);
                continue;
            }
            if (!line.trim()) {
                continue;
            }

            const firstSpaceIdx = line.indexOf(' ');
            let prefix, lineContents: string;
            if (firstSpaceIdx == -1 ) {
                prefix = line;
                lineContents = '';
            } else {
                prefix = line.slice(0, firstSpaceIdx == -1 ? line.length : firstSpaceIdx);
                lineContents = line.slice(firstSpaceIdx + 1);
            }

            if (this._checklistPrefixMatch.test(prefix)) {
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
                    };
                    outFile.groups.push(currentGroup);
                }

                currentChecklist = {
                    title: checklistTitle,
                    items: [],
                };
                currentGroup.checklists.push(currentChecklist);
                continue;
            }

            // TODO: Match/extract numbers from template.
            if (this._itemPrefixMatch.test(prefix)) {
                if (!currentChecklist) {
                    throw new FormatError('Checklist item found before start of checklist');
                }

                const newIndent = Math.floor((lineContents.length - lineContents.trimStart().length) / this._options.indentWidth);
                lineContents = lineContents.slice(newIndent * this._options.indentWidth);

                let item: ChecklistItem;
                if (this._options.maxLineLength && lineContents.startsWith(WRAP_PREFIX)) {
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

    private _itemForContents(contents: string, indent: number): ChecklistItem {
        const endTrimmedContents = contents.trimEnd();
        let endSpaces = (contents.length - endTrimmedContents.length)
        // If it was indented on both sides, meaning it was centered
        const centered = (endSpaces > 0 && endSpaces === this._options.indentWidth * indent);
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
        } else if (prompt.startsWith(this._options.titlePrefixSuffix) &&
            prompt.endsWith(this._titleSuffix)) {
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
                expectation = prompt.slice(responseSepIdx + this._options.expectationSeparator.length + 1);
                prompt = prompt.slice(0, responseSepIdx - 1);
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
        for (let group of out.groups) {
            if (firstGroup && this._options.skipFirstGroup) {
                group.title = this._properCase(DEFAULT_FIRST_GROUP);
            }
            firstGroup = false;
            group.title = this._properCase(group.title);
            for (let list of group.checklists) {
                list.title = this._properCase(list.title);
                for (let item of list.items) {
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