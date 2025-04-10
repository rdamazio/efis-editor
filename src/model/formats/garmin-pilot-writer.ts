import { createTarGzip } from 'nanotar';
import { v4 as uuidV4 } from 'uuid';
import {
  Checklist,
  ChecklistFile,
  ChecklistGroup,
  ChecklistGroup_Category,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import {
  GarminPilotChecklist,
  GarminPilotChecklist_CompletionItem,
  GarminPilotChecklistContainer,
  GarminPilotChecklistItem,
  GarminPilotChecklistItem_ItemType,
  GarminPilotMetadata,
} from '../../../gen/ts/garmin_pilot';
import { NullValue } from '../../../gen/ts/google/protobuf/struct';
import { FormatUtils } from './format-utils';
import { GarminPilotLiveData } from './garmin-pilot-live-data';
import { GarminChecklistGroupKey, GarminPilotFormatError, GarminPilotUtils } from './garmin-pilot-utils';

export class GarminPilotWriter {
  private readonly _checklistsGarmin = new Map<GarminChecklistGroupKey, GarminPilotChecklist[]>();
  private readonly _checklistItemsGarmin: GarminPilotChecklistItem[] = [];

  public async write(file: ChecklistFile): Promise<Blob> {
    const compressed = await createTarGzip([
      {
        name: GarminPilotUtils.CONTENT_FILENAME,
        data: GarminPilotChecklistContainer.toJsonString(this._checklistFileToGarmin(file), {
          enumAsInteger: true,
          emitDefaultValues: true,
          prettySpaces: 2,
        }),
      },
    ]);
    return new Blob([compressed as Uint8Array<ArrayBuffer>]);
  }

  private _checklistFileToGarmin(file: ChecklistFile): GarminPilotChecklistContainer {
    this._checklistsGarmin.clear();
    this._checklistItemsGarmin.length = 0;

    let metadata;

    try {
      metadata = GarminPilotMetadata.fromJsonString(file.metadata!.copyrightInfo);
    } catch (e) {
      console.warn('Unable to parse GarminPilotMetadata:', e);
      metadata = GarminPilotMetadata.create({ sortOrder: 0 });
    }

    file.groups.forEach((groupEFIS) => {
      this._checklistGroupToGarmin(groupEFIS);
    });

    return {
      dataModelVersion: GarminPilotUtils.DATA_MODEL_VERSION,
      packageTypeVersion: GarminPilotUtils.PACKAGE_TYPE_VERSION,
      name: file.metadata!.name,
      type: GarminPilotUtils.CONTAINER_TYPE,
      objects: [
        {
          checklists: ([] as GarminPilotChecklist[]).concat(...this._checklistsGarmin.values()),
          binders: [
            {
              uuid: uuidV4(),
              sourceTemplateUUID: metadata.sourceTemplateUUID,
              sortOrder: metadata.sortOrder,
              name: file.metadata!.name,
              checklists: [...this._checklistsGarmin]
                .map(([_checklistKeyGarmin, checklistsGarmin]) => checklistsGarmin)
                .flatMap((checklistsGarmin) => checklistsGarmin.map((checklistGarmin) => checklistGarmin.uuid)),
            },
          ],
          checklistItems: this._checklistItemsGarmin,
          version: NullValue.NULL_VALUE,
        },
      ],
    };
  }

  private _checklistGroupToGarmin(checklistGroupEFIS: ChecklistGroup) {
    const groupKeyGarmin = GarminPilotUtils.efisGroupKeyToGarmin([
      checklistGroupEFIS.category,
      checklistGroupEFIS.title,
    ]);
    const checklistGroupsGarmin = this._checklistsGarmin.get(groupKeyGarmin) ?? [];

    checklistGroupEFIS.checklists.forEach((checklistEFIS) => {
      const [completionAction, itemsGarmin] = GarminPilotWriter._checklistToGarmin(
        checklistGroupEFIS.category,
        checklistEFIS,
      );

      this._checklistItemsGarmin.push(...itemsGarmin);

      const [checklistTypeGarmin, checklistSubTypeGarmin] = groupKeyGarmin;
      checklistGroupsGarmin.push({
        completionItem: completionAction,
        uuid: uuidV4(),
        checklistItems: itemsGarmin.map((itemGarmin) => itemGarmin.uuid),
        name: checklistEFIS.title,
        type: checklistTypeGarmin,
        subtype: checklistSubTypeGarmin,
      });
    });

    this._checklistsGarmin.set(groupKeyGarmin, checklistGroupsGarmin);
  }

  private static _checklistToGarmin(
    categoryEFIS: ChecklistGroup_Category,
    checklistEFIS: Checklist,
  ): [GarminPilotChecklist_CompletionItem, GarminPilotChecklistItem[]] {
    let garminCompletionAction =
      categoryEFIS === ChecklistGroup_Category.normal
        ? GarminPilotChecklist_CompletionItem.ACTION_GO_TO_NEXT_CHECKLIST
        : GarminPilotChecklist_CompletionItem.ACTION_DO_NOTHING;

    const itemsGarmin = checklistEFIS.items
      .reduce<[GarminPilotChecklistItem, ChecklistItem][]>((accumulator, itemEFIS) => {
        const itemGarmin: GarminPilotChecklistItem = {
          checked: false,
          itemType: GarminPilotChecklistItem_ItemType.TYPE_PLAIN_TEXT,
          title: itemEFIS.prompt,
          uuid: uuidV4(),
          action: itemEFIS.expectation,
        };
        accumulator.push([itemGarmin, itemEFIS]);

        switch (itemEFIS.type) {
          case ChecklistItem_Type.ITEM_UNKNOWN:
            throw new GarminPilotFormatError(`unknown EFIS item type for '${itemEFIS.prompt}'`);

          case ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE: {
            const garminLiveDataItemType = GarminPilotLiveData.getGarminLiveDataTypeByExpectation(itemEFIS.expectation);
            [itemGarmin.itemType, itemGarmin.action] =
              garminLiveDataItemType !== undefined
                ? [garminLiveDataItemType, '']
                : [GarminPilotChecklistItem_ItemType.TYPE_PLAIN_TEXT, itemEFIS.expectation];
            break;
          }

          case ChecklistItem_Type.ITEM_CHALLENGE:
            itemGarmin.action = '';
            break;

          case ChecklistItem_Type.ITEM_TITLE:
            itemGarmin.itemType = GarminPilotChecklistItem_ItemType.TYPE_NOTE;
            itemGarmin.action = '';
            break;

          case ChecklistItem_Type.ITEM_PLAINTEXT:
          case ChecklistItem_Type.ITEM_NOTE:
          case ChecklistItem_Type.ITEM_CAUTION:
          case ChecklistItem_Type.ITEM_WARNING: {
            itemGarmin.itemType = GarminPilotChecklistItem_ItemType.TYPE_NOTE;
            itemGarmin.title = '';

            // Handle special completion action entry
            if (GarminPilotUtils.COMPLETION_ACTION_TO_GARMIN.has(itemEFIS.prompt)) {
              garminCompletionAction = GarminPilotUtils.COMPLETION_ACTION_TO_GARMIN.get(itemEFIS.prompt)!;
              accumulator.pop();
              break;
            }

            // Handle EFIS note types translated as prefixes
            const text = FormatUtils.getChecklistItemPrefix(itemEFIS.type) + itemEFIS.prompt;

            const [lastItemGarmin, lastItemEFIS] = accumulator.at(-2) ?? [];
            if (
              lastItemGarmin &&
              lastItemEFIS &&
              FormatUtils.shouldMergeNotes(itemEFIS, lastItemEFIS, [ChecklistItem_Type.ITEM_TITLE])
            ) {
              // Join multi-line notes
              lastItemGarmin.action = lastItemGarmin.action ? `${lastItemGarmin.action}\n${text}` : text;
              accumulator.pop();
            } else {
              itemGarmin.action = text;
            }

            break;
          }

          case ChecklistItem_Type.ITEM_SPACE:
            itemGarmin.itemType = GarminPilotChecklistItem_ItemType.TYPE_NOTE;
            [itemGarmin.title, itemGarmin.action] = ['', ''];
            break;
        }

        return accumulator;
      }, [])
      .map(([itemGarmin, _itemEFIS]) => itemGarmin);

    return [garminCompletionAction, itemsGarmin];
  }
}
