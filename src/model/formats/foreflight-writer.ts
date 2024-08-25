import {
  ChecklistFile,
  ChecklistGroup,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import {
  ForeFlightChecklistContainer,
  ForeFlightChecklistGroup,
  ForeFlightChecklistItem,
  ForeFlightChecklistSubgroup,
} from '../../../gen/ts/foreflight';

import { ForeFlightUtils } from './foreflight-utils';

export class ForeFlightWriter {
  public static async write(file: ChecklistFile): Promise<Blob> {
    return ForeFlightUtils.encrypt(
      ForeFlightChecklistContainer.toJsonString(ForeFlightWriter.checklistFileToFF(file), {
        // Explicit serialization of enum first elements is required for ForeFlight!
        emitDefaultValues: true,
        prettySpaces: 2,
      }),
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
        groups: ForeFlightWriter.checklistGroupsToFFGroup(file.groups),
      },
    };
  }

  private static checklistGroupsToFFGroup(groupsEFIS: ChecklistGroup[]): ForeFlightChecklistGroup[] {
    return Object.keys(ChecklistGroup_Category)
      .filter((categoryKey) => isNaN(Number(categoryKey)))
      .map((categoryKey) => ChecklistGroup_Category[categoryKey as keyof typeof ChecklistGroup_Category])
      .map((checklistGroupCategory) => ({
        objectId: ForeFlightUtils.getObjectId(),
        groupType: checklistGroupCategory,
        items: groupsEFIS
          .filter((checklistGroupEFIS) => checklistGroupEFIS.category === checklistGroupCategory)
          .map(ForeFlightWriter.checklistGroupToFFSubgroup),
      }));
  }

  private static checklistGroupToFFSubgroup(checklistGroupEFIS: ChecklistGroup): ForeFlightChecklistSubgroup {
    return {
      objectId: ForeFlightUtils.getObjectId(),
      title: checklistGroupEFIS.title,
      items: checklistGroupEFIS.checklists.map((checklistEFIS) => ({
        objectId: ForeFlightUtils.getObjectId(),
        title: checklistEFIS.title,
        items: ForeFlightWriter.checklistItemsToFF(checklistEFIS.items),
      })),
    };
  }

  private static checklistItemsToFF(itemsEFIS: ChecklistItem[]): ForeFlightChecklistItem[] {
    return itemsEFIS
      .reduce<[ForeFlightChecklistItem, ChecklistItem][]>((accumulator, itemEFIS) => {
        switch (itemEFIS.type) {
          case ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE:
            accumulator.push([
              {
                objectId: ForeFlightUtils.getObjectId(),
                title: itemEFIS.prompt,
                detail: itemEFIS.expectation.toUpperCase(),
              },
              itemEFIS,
            ]);
            break;
          case ChecklistItem_Type.ITEM_CHALLENGE:
            accumulator.push([
              {
                objectId: ForeFlightUtils.getObjectId(),
                title: itemEFIS.prompt,
              },
              itemEFIS,
            ]);
            break;
          case ChecklistItem_Type.ITEM_TITLE:
            accumulator.push([
              {
                objectId: ForeFlightUtils.getObjectId(),
                type: ForeFlightUtils.ITEM_HEADER,
                title: itemEFIS.prompt,
              },
              itemEFIS,
            ]);
            break;
          case ChecklistItem_Type.ITEM_PLAINTEXT:
          case ChecklistItem_Type.ITEM_NOTE:
          case ChecklistItem_Type.ITEM_CAUTION:
          case ChecklistItem_Type.ITEM_WARNING: {
            const text = ForeFlightUtils.CHECKLIST_ITEM_PREFIXES.get(itemEFIS.type) + itemEFIS.prompt;
            const [lastItemFF, lastItemEFIS] = accumulator[accumulator.length - 1] || [];
            if (lastItemFF && lastItemEFIS && lastItemEFIS.indent < itemEFIS.indent) {
              // If this is an indented text item, then...
              const appendNote = (field: string, text: string) => {
                type fieldType = keyof typeof lastItemFF;
                const typedField = field as fieldType;
                lastItemFF[typedField] = lastItemFF[typedField] ? lastItemFF[typedField] + '\n' + text : text;
              };
              appendNote(
                lastItemFF.type !== ForeFlightUtils.ITEM_HEADER
                  ? // ...append note to the previous Check...
                    'note'
                  : // ...or Detail Item
                    'detail',
                text,
              );
            } else {
              // ...otherwise, create a Detail Item without title, but with a note
              accumulator.push([
                {
                  objectId: ForeFlightUtils.getObjectId(),
                  type: ForeFlightUtils.ITEM_HEADER,
                  detail: text,
                },
                itemEFIS,
              ]);
            }
            break;
          }
          case ChecklistItem_Type.ITEM_SPACE:
            accumulator.push([
              { objectId: ForeFlightUtils.getObjectId(), type: ForeFlightUtils.ITEM_HEADER },
              itemEFIS,
            ]);
        }
        return accumulator;
      }, [])
      .map((tuple) => tuple[0]);
  }
}
