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
  ForeFlightChecklistMetadata,
  ForeFlightChecklistSubgroup,
} from '../../../gen/ts/foreflight';

import { ForeFlightUtils } from './foreflight-utils';

export class ForeFlightWriter {
  public static async write(file: ChecklistFile): Promise<Blob> {
    return ForeFlightUtils.encrypt(
      ForeFlightChecklistContainer.toJsonString(ForeFlightWriter._checklistFileToFF(file), {
        // Explicit serialization of enum first elements is required for ForeFlight!
        emitDefaultValues: true,
        prettySpaces: 2,
      }),
    );
  }

  private static _checklistFileToFF(file: ChecklistFile): ForeFlightChecklistContainer {
    return {
      type: ForeFlightUtils.CONTAINER_TYPE,
      payload: {
        objectId: ForeFlightUtils.getObjectId(),
        schemaVersion: ForeFlightUtils.SCHEMA_VERSION,
        metadata: ForeFlightWriter.getChecklistMetadata(file),
        groups: ForeFlightWriter._checklistGroupsToFFGroup(file.groups),
      },
    };
  }

  public static getChecklistMetadata(file: ChecklistFile): ForeFlightChecklistMetadata {
    return {
      name: file.metadata?.name,
      detail: file.metadata?.makeAndModel,
      tailNumber: file.metadata?.aircraftInfo.toUpperCase(),
    };
  }

  private static _checklistGroupsToFFGroup(groupsEFIS: ChecklistGroup[]): ForeFlightChecklistGroup[] {
    return [ChecklistGroup_Category.normal, ChecklistGroup_Category.abnormal, ChecklistGroup_Category.emergency].map(
      (category) => ({
        objectId: ForeFlightUtils.getObjectId(),
        groupType: category,
        items: groupsEFIS
          .filter((group: ChecklistGroup) => group.category === category)
          .map(ForeFlightWriter._checklistGroupToFFSubgroup),
      }),
    );
  }

  private static _checklistGroupToFFSubgroup(checklistGroupEFIS: ChecklistGroup): ForeFlightChecklistSubgroup {
    return {
      objectId: ForeFlightUtils.getObjectId(),
      title: checklistGroupEFIS.title,
      items: checklistGroupEFIS.checklists.map((checklistEFIS) => ({
        objectId: ForeFlightUtils.getObjectId(),
        title: checklistEFIS.title,
        items: ForeFlightWriter._checklistItemsToFF(checklistEFIS.items),
      })),
    };
  }

  private static _checklistItemsToFF(itemsEFIS: ChecklistItem[]): ForeFlightChecklistItem[] {
    return itemsEFIS
      .reduce<[ForeFlightChecklistItem, ChecklistItem][]>((accumulator, itemEFIS) => {
        const itemFF: ForeFlightChecklistItem = {
          objectId: ForeFlightUtils.getObjectId(),
          title: itemEFIS.prompt,
          detail: itemEFIS.expectation.toUpperCase(),
        };
        accumulator.push([itemFF, itemEFIS]);

        switch (itemEFIS.type) {
          case ChecklistItem_Type.ITEM_UNKNOWN:
            throw new Error(`unknown item type for "${itemEFIS.prompt}"`);

          case ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE:
            break;

          case ChecklistItem_Type.ITEM_CHALLENGE:
            itemFF.detail = undefined;
            break;

          case ChecklistItem_Type.ITEM_TITLE:
            itemFF.type = ForeFlightUtils.ITEM_HEADER;
            itemFF.detail = undefined;
            break;

          case ChecklistItem_Type.ITEM_PLAINTEXT:
          case ChecklistItem_Type.ITEM_NOTE:
          case ChecklistItem_Type.ITEM_CAUTION:
          case ChecklistItem_Type.ITEM_WARNING: {
            const text = ForeFlightUtils.getChecklistItemPrefix(itemEFIS.type) + itemEFIS.prompt;

            const [lastItemFF, lastItemEFIS] = accumulator.at(-2) ?? [];
            if (lastItemFF && lastItemEFIS && ForeFlightUtils.shouldMergeNotes(itemEFIS, lastItemEFIS)) {
              // If this is an indented text item, then...
              const appendNote = (field: string, appendText: string) => {
                const typedField = field as keyof typeof lastItemFF;
                lastItemFF[typedField] = lastItemFF[typedField]
                  ? lastItemFF[typedField] + '\n' + appendText
                  : appendText;
              };

              appendNote(
                lastItemFF.type !== ForeFlightUtils.ITEM_HEADER
                  ? // ...append note to the previous Check...
                    'note'
                  : // ...or Detail Item
                    'detail',
                text,
              );

              accumulator.pop();
              break;
            }

            // ...otherwise, create a Detail Item without title, but with a note
            itemFF.type = ForeFlightUtils.ITEM_HEADER;
            itemFF.title = undefined;
            itemFF.detail = text;
            break;
          }

          case ChecklistItem_Type.ITEM_SPACE:
            itemFF.type = ForeFlightUtils.ITEM_HEADER;
            itemFF.title = undefined;
            itemFF.detail = undefined;
        }

        return accumulator;
      }, [])
      .map(([itemFF, _itemEFIS]) => itemFF);
  }
}
