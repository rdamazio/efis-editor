import {
  ForeFlightChecklist,
  ForeFlightChecklistContainer,
  ForeFlightChecklistGroup,
  ForeFlightChecklistItem,
  ForeFlightChecklistSubgroup,
} from '../../../gen/ts/foreflight';
import {
  Checklist,
  ChecklistFile,
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
      metadata: {
        name: ForeFlightUtils.getChecklistFileName(file, container),
        description: container.payload.metadata.detail || '',
        defaultGroupIndex: 0,
        defaultChecklistIndex: 0,
        makeAndModel: '',
        aircraftInfo: container.payload.metadata.tailNumber || '',
        manufacturerInfo: '',
        copyrightInfo: '',
      },
    };
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
    const result = [
      checklistItem.type === ForeFlightUtils.ITEM_HEADER
        ? // Detail Item
          checklistItem.title
          ? // Title is set - interpret as title
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_TITLE,
              prompt: checklistItem.title,
            })
          : // Title is not set
            checklistItem.detail
            ? // Detail is set - interpret as unindented text
              ChecklistItem.create(ForeFlightUtils.promptToPartialChecklistItem(checklistItem.detail))
            : // Neither title, nor detail set - interpret as empty space
              ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE })
        : // Check Item
          checklistItem.detail
          ? // Detail is set - interpret as expectation
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: checklistItem.title,
              expectation: checklistItem.detail.toUpperCase(),
            })
          : // Detail not set - interpret as prompt-only
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE,
              prompt: checklistItem.title,
            }),
    ];

    // Note handling
    if (
      // Detail Item, but with both title and detail
      (checklistItem.type === ForeFlightUtils.ITEM_HEADER && checklistItem.title && checklistItem.detail) ||
      // Check Item with a note
      checklistItem.note
    ) {
      result.push(
        ChecklistItem.create({
          indent: ForeFlightUtils.NOTE_INDENT,
          ...ForeFlightUtils.promptToPartialChecklistItem(
            (checklistItem.type === ForeFlightUtils.ITEM_HEADER ? checklistItem.detail : checklistItem.note) || '',
          ),
        }),
      );
    }

    return result;
  }
}
