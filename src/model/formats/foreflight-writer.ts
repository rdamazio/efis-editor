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

  private static async checklistFileToFF(file: ChecklistFile): Promise<ForeFlightChecklistContainer> {
    return {
      type: ForeFlightUtils.CONTAINER_TYPE,
      payload: {
        objectId: await ForeFlightUtils.getObjectId(),
        schemaVersion: ForeFlightUtils.SCHEMA_VERSION,
        metadata: {
          name: file.metadata?.name,
          detail: file.metadata?.description,
          tailNumber: file.metadata?.aircraftInfo,
        },
        groups: await ForeFlightWriter.checklistGroupsToFF(file.groups),
      },
    };
  }

  private static async checklistGroupsToFF(groupsEFIS: ChecklistGroup[]): Promise<ForeFlightChecklistGroup[]> {
    return Promise.all(
      Object.values(ForeFlightCategory).map(
        async (categoryFF): Promise<ForeFlightChecklistGroup> => ({
          objectId: await ForeFlightUtils.getObjectId(),
          groupType: categoryFF,
          items: await Promise.all(
            groupsEFIS
              .filter(
                (checklistGroupEFIS) => checklistGroupEFIS.category === ForeFlightUtils.categoryToEFIS(categoryFF),
              )
              .map(async (checklistGroupEFIS) => ({
                objectId: await ForeFlightUtils.getObjectId(),
                title: checklistGroupEFIS.title,
                items: await Promise.all(
                  checklistGroupEFIS.checklists.map(async (checklistEFIS) => ({
                    objectId: await ForeFlightUtils.getObjectId(),
                    title: checklistEFIS.title,
                    items: await ForeFlightWriter.checklistItemsToFF(checklistEFIS.items),
                  })),
                ),
              })),
          ),
        }),
      ),
    );
  }

  private static async checklistItemsToFF(itemsEFIS: ChecklistItem[]): Promise<ForeFlightChecklistItem[]> {
    const itemsFF: ForeFlightChecklistItem[] = [];

    // TypeScript has map, reduce, but no scan :-( WHY??!!!11
    for (const itemEFIS of itemsEFIS) {
      switch (itemEFIS.type) {
        case ChecklistItem_Type.ITEM_TITLE:
          itemsFF.push({
            objectId: await ForeFlightUtils.getObjectId(),
            type: ForeFlightUtils.ITEM_HEADER,
            title: itemEFIS.prompt,
          });
          break;
        case ChecklistItem_Type.ITEM_CHALLENGE:
          itemsFF.push({
            objectId: await ForeFlightUtils.getObjectId(),
            title: itemEFIS.prompt,
          });
          break;
        case ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE:
          itemsFF.push({
            objectId: await ForeFlightUtils.getObjectId(),
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
