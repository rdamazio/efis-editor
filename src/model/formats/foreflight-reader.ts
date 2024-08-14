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
    const container: ForeFlightChecklistContainer = JSON.parse(plaintext);

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
        name: ForeFlightReader.getChecklistName(container.payload.metadata),
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

  /**
   * Unfortunately, all fields in ForeFlight are optional, so take first one filled out or default
   */
  private static getChecklistName(metadata: ForeFlightChecklistMetadata): string {
    return [metadata.name, metadata.tailNumber, metadata.detail, 'ForeFlight Checklist']
      .filter((item) => !!item)
      .shift() as string;
  }

  private static checklistGroupsToEFIS(groups: ForeFlightChecklistGroup[]): ChecklistGroup[] {
    // We map FF subgroups to groups, so need to filter out possibly empty FF groups as they can't be represented
    return groups.flatMap(ForeFlightReader.checklistGroupToEFIS);
  }

  private static checklistGroupToEFIS(checklistGroup: ForeFlightChecklistGroup): ChecklistGroup[] {
    const category = ForeFlightUtils.categoryToEFIS(checklistGroup.groupType);
    return checklistGroup.items
      ? checklistGroup.items.map((item) => ForeFlightReader.checklistSubgroupToEFIS(category, item))
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
    return checklistItem.type === ForeFlightUtils.ITEM_HEADER
      ? [
          ChecklistItem.create({
            type: ChecklistItem_Type.ITEM_TITLE,
            prompt: checklistItem.title,
          }),
        ]
      : [
          ChecklistItem.create({
            type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
            prompt: checklistItem.title,
            expectation: checklistItem.detail,
          }),
          ...(checklistItem.note
            ? [
                ChecklistItem.create({
                  type: ChecklistItem_Type.ITEM_NOTE,
                  prompt: checklistItem.note,
                  indent: ForeFlightUtils.NOTE_INDENT,
                }),
              ]
            : []),
        ];
  }
}
