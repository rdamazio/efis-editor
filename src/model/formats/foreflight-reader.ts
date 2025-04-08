import {
  Checklist,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import {
  ForeFlightChecklist,
  ForeFlightChecklistContainer,
  ForeFlightChecklistGroup,
  ForeFlightChecklistItem,
  ForeFlightChecklistMetadata,
  ForeFlightChecklistSubgroup,
} from '../../../gen/ts/foreflight';
import { ForeFlightFormatError } from './foreflight-format';
import { ForeFlightUtils } from './foreflight-utils';
import { FormatId } from './format-id';

export class ForeFlightReader {
  public static async read(file: File): Promise<ChecklistFile> {
    const plaintext = await ForeFlightUtils.decrypt(await file.arrayBuffer());
    const container: ForeFlightChecklistContainer = ForeFlightChecklistContainer.fromJsonString(plaintext);

    if (container.type !== ForeFlightUtils.CONTAINER_TYPE) {
      throw new ForeFlightFormatError(`unknown checklist type '${container.type}'`);
    }

    if (!container.payload) throw new ForeFlightFormatError('missing checklist payload');

    if (container.payload.schemaVersion !== ForeFlightUtils.SCHEMA_VERSION) {
      throw new ForeFlightFormatError(`unknown checklist schema version '${container.payload.schemaVersion}'`);
    }

    if (!container.payload.metadata) {
      throw new ForeFlightFormatError('missing checklist metadata');
    }

    return {
      groups: ForeFlightReader._checklistGroupsToEFIS(container.payload.groups),
      metadata: ForeFlightReader.getChecklistMetadata(file, container.payload.metadata),
    };
  }

  public static getChecklistMetadata(file: File, metadata: ForeFlightChecklistMetadata): ChecklistFileMetadata {
    return ChecklistFileMetadata.create({
      // eslint-disable-next-line  @typescript-eslint/prefer-nullish-coalescing
      name: metadata.name || file.name.replace(new RegExp(`\\.${FormatId.FOREFLIGHT}$`), ''),
      aircraftInfo: metadata.tailNumber,
      makeAndModel: metadata.detail,
    });
  }

  private static _checklistGroupsToEFIS(groups: ForeFlightChecklistGroup[]): ChecklistGroup[] {
    // We map FF subgroups to groups, so need to filter out possibly empty FF groups as they can't be represented
    return groups.flatMap(ForeFlightReader._checklistGroupToEFIS);
  }

  private static _checklistGroupToEFIS(checklistGroup: ForeFlightChecklistGroup): ChecklistGroup[] {
    return checklistGroup.items.map((subgroup: ForeFlightChecklistSubgroup) =>
      ForeFlightReader._checklistSubgroupToEFIS(checklistGroup.groupType, subgroup),
    );
  }

  private static _checklistSubgroupToEFIS(
    category: ChecklistGroup_Category,
    checklistSubgroup: ForeFlightChecklistSubgroup,
  ): ChecklistGroup {
    return {
      category: category,
      title: checklistSubgroup.title,
      checklists: checklistSubgroup.items.map(ForeFlightReader._checklistToEFIS),
    };
  }

  private static _checklistToEFIS(checkList: ForeFlightChecklist): Checklist {
    return { title: checkList.title, items: checkList.items.flatMap(ForeFlightReader._checklistItemToEFIS) };
  }

  private static _checklistItemToEFIS(checklistItem: ForeFlightChecklistItem): ChecklistItem[] {
    const result = [];

    if (checklistItem.type === ForeFlightUtils.ITEM_HEADER) {
      // Detail Item
      if (checklistItem.title) {
        // Title is set - interpret as title
        result.push(ChecklistItem.create({ type: ChecklistItem_Type.ITEM_TITLE, prompt: checklistItem.title }));
      } else {
        // Title is not set
        if (checklistItem.detail) {
          // Detail is set - interpret as unindented text (unless multi-line note)
          result.push(...ForeFlightUtils.possiblyMultilineNoteToChecklistItems(checklistItem.detail, true));
        } else {
          // Neither title, nor detail set - interpret as empty space
          result.push(ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE }));
        }
      }
    } else {
      // Check Item
      if (checklistItem.detail) {
        // Detail is set - interpret as expectation
        result.push(
          ChecklistItem.create({
            type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
            prompt: checklistItem.title,
            expectation: checklistItem.detail.toUpperCase(),
          }),
        );
      } else {
        // Detail not set - interpret as prompt-only
        result.push(ChecklistItem.create({ type: ChecklistItem_Type.ITEM_CHALLENGE, prompt: checklistItem.title }));
      }
    }

    // Handle notes
    const possibleNote = checklistItem.type === ForeFlightUtils.ITEM_HEADER ? checklistItem.detail : checklistItem.note;

    if (
      // Detail Item, but with both title and detail
      (checklistItem.type === ForeFlightUtils.ITEM_HEADER && checklistItem.title && checklistItem.detail) ||
      // Check Item with a note
      checklistItem.note
    ) {
      result.push(...ForeFlightUtils.possiblyMultilineNoteToChecklistItems(possibleNote ?? '', false));
    }

    return result;
  }
}
