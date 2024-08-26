import {
  ForeFlightChecklist,
  ForeFlightChecklistContainer,
  ForeFlightChecklistGroup,
  ForeFlightChecklistItem,
  ForeFlightChecklistMetadata,
  ForeFlightChecklistSubgroup,
} from '../../../gen/ts/foreflight';
import {
  Checklist,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import { ForeFlightFormatError } from './foreflight-format';
import { ForeFlightUtils } from './foreflight-utils';

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
      groups: ForeFlightReader.checklistGroupsToEFIS(container.payload.groups),
      metadata: ForeFlightReader.getChecklistMetadata(file, container.payload.metadata),
    };
  }

  public static getChecklistMetadata(file: File, metadata: ForeFlightChecklistMetadata): ChecklistFileMetadata {
    return ChecklistFileMetadata.create({
      name: metadata.name || file.name.replace(new RegExp(`\\.${ForeFlightUtils.FILE_EXTENSION}$`), ''),
      aircraftInfo: metadata.tailNumber,
      makeAndModel: metadata.detail,
    });
  }

  private static checklistGroupsToEFIS(groups: ForeFlightChecklistGroup[]): ChecklistGroup[] {
    // We map FF subgroups to groups, so need to filter out possibly empty FF groups as they can't be represented
    return groups.flatMap(ForeFlightReader.checklistGroupToEFIS);
  }

  private static checklistGroupToEFIS(checklistGroup: ForeFlightChecklistGroup): ChecklistGroup[] {
    return checklistGroup.items
      ? checklistGroup.items.map((item) => ForeFlightReader.checklistSubgroupToEFIS(checklistGroup.groupType, item))
      : []; // if the FF group (not subgroup!) is empty, drop it - we need a subgroup to represent a group
  }

  private static checklistSubgroupToEFIS(
    category: ChecklistGroup_Category,
    checklistSubgroup: ForeFlightChecklistSubgroup,
  ): ChecklistGroup {
    return {
      category: category,
      title: checklistSubgroup.title,
      checklists: checklistSubgroup.items?.map(ForeFlightReader.checklistToEFIS) || [], // items might be missing
    };
  }

  private static checklistToEFIS(checkList: ForeFlightChecklist): Checklist {
    return {
      title: checkList.title,
      items: checkList.items?.flatMap(ForeFlightReader.checklistItemToEFIS) || [], // items might be missing
    };
  }

  private static checklistItemToEFIS(checklistItem: ForeFlightChecklistItem): ChecklistItem[] {
    const result = [];

    if (checklistItem.type === ForeFlightUtils.ITEM_HEADER) {
      // Detail Item
      if (checklistItem.title) {
        // Title is set - interpret as title
        result.push(ChecklistItem.create({ type: ChecklistItem_Type.ITEM_TITLE, prompt: checklistItem.title }));
      } else {
        // Title is not set
        if (checklistItem.detail) {
          // Detail is set - interpret as unindented text
          result.push(ChecklistItem.create(ForeFlightUtils.promptToPartialChecklistItem(checklistItem.detail)));
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
        result.push(
          ChecklistItem.create({
            type: ChecklistItem_Type.ITEM_CHALLENGE,
            prompt: checklistItem.title,
          }),
        );
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
      for (const noteLine of ForeFlightUtils.splitLines(possibleNote || '')) {
        result.push(
          ChecklistItem.create({
            indent: ForeFlightUtils.NOTE_INDENT,
            ...ForeFlightUtils.promptToPartialChecklistItem(noteLine),
          }),
        );
      }
    }

    return result;
  }
}
