import { ChecklistFile, ChecklistGroup, ChecklistItem, ChecklistItem_Type } from '../../../gen/ts/checklist';
import {
  ForeFlightChecklistContainer,
  ForeFlightChecklistGroup,
  ForeFlightChecklistItem,
} from '../../../gen/ts/foreflight';

import { ForeFlightCategory, ForeFlightUtils } from './foreflight-utils';

export class ForeFlightWriter {
  public static async write(file: ChecklistFile): Promise<Blob> {
    return ForeFlightUtils.encrypt(
      ForeFlightChecklistContainer.toJsonString(await ForeFlightWriter.checklistFileToFF(file), { prettySpaces: 2 }),
    );
  }

  private static checklistFileToFF(file: ChecklistFile): ForeFlightChecklistContainer {
    return {
      type: ForeFlightUtils.CONTAINER_TYPE,
      payload: {
        objectId: ForeFlightUtils.getObjectId(),
        schemaVersion: ForeFlightUtils.SCHEMA_VERSION,
        metadata: {
          name: file.metadata?.name,
          detail: file.metadata?.description,
          tailNumber: file.metadata?.aircraftInfo.toUpperCase(),
        },
        groups: ForeFlightWriter.checklistGroupsToFF(file.groups),
      },
    };
  }

  private static checklistGroupsToFF(groupsEFIS: ChecklistGroup[]): ForeFlightChecklistGroup[] {
    return Object.values(ForeFlightCategory).map((categoryFF) => ({
      objectId: ForeFlightUtils.getObjectId(),
      groupType: categoryFF,
      items: groupsEFIS
        .filter((checklistGroupEFIS) => checklistGroupEFIS.category === ForeFlightUtils.categoryToEFIS(categoryFF))
        .map((checklistGroupEFIS) => ({
          objectId: ForeFlightUtils.getObjectId(),
          title: checklistGroupEFIS.title,
          items: checklistGroupEFIS.checklists.map((checklistEFIS) => ({
            objectId: ForeFlightUtils.getObjectId(),
            title: checklistEFIS.title,
            items: ForeFlightWriter.checklistItemsToFF(checklistEFIS.items),
          })),
        })),
    }));
  }

  private static checklistItemsToFF(itemsEFIS: ChecklistItem[]): ForeFlightChecklistItem[] {
    const itemsFF: ForeFlightChecklistItem[] = [];

    // TypeScript has map, reduce, but no scan :-( WHY??!!!11
    for (const itemEFIS of itemsEFIS) {
      switch (itemEFIS.type) {
        case ChecklistItem_Type.ITEM_TITLE:
          itemsFF.push({
            objectId: ForeFlightUtils.getObjectId(),
            type: ForeFlightUtils.ITEM_HEADER,
            title: itemEFIS.prompt,
          });
          break;
        case ChecklistItem_Type.ITEM_CHALLENGE:
          itemsFF.push({
            objectId: ForeFlightUtils.getObjectId(),
            title: itemEFIS.prompt,
          });
          break;
        case ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE:
          itemsFF.push({
            objectId: ForeFlightUtils.getObjectId(),
            title: itemEFIS.prompt,
            detail: itemEFIS.expectation.toUpperCase(),
          });
          break;
        case ChecklistItem_Type.ITEM_NOTE: {
          // JavaScript, why not [-1] or .last() !? :-(
          const lastItemFF = itemsFF[itemsFF.length - 1];
          if (lastItemFF && itemEFIS.indent === ForeFlightUtils.NOTE_INDENT) {
            if (lastItemFF.type === ForeFlightUtils.ITEM_HEADER) {
              lastItemFF.detail = itemEFIS.prompt;
            } else {
              lastItemFF.note = itemEFIS.prompt;
            }
          }
        }
      }
    }

    return itemsFF;
  }
}
