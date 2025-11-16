import { parseTarGzip } from 'nanotar';
import {
  Checklist,
  Checklist_CompletionAction,
  ChecklistFile,
  ChecklistFileMetadata,
  ChecklistGroup,
  ChecklistItem,
  ChecklistItem_Type,
} from '../../../gen/ts/checklist';
import {
  GarminPilotChecklist,
  GarminPilotChecklistContainer,
  GarminPilotChecklistItem,
  GarminPilotChecklistItem_ItemType,
  GarminPilotObjectsContainer,
} from '../../../gen/ts/garmin_pilot';
import { FormatUtils } from './format-utils';
import { GarminPilotLiveData } from './garmin-pilot-live-data';
import {
  EfisChecklistGroupKey,
  GarminChecklistGroupKey,
  GarminPilotFormatError,
  GarminPilotUtils,
} from './garmin-pilot-utils';

export class GarminPilotReader {
  public static async read(file: File): Promise<ChecklistFile> {
    const contents = await parseTarGzip(await file.arrayBuffer());

    if (contents.length > 1) {
      throw new GarminPilotFormatError(`more than one item found: ${contents.map((item) => item.name)}`);
    }

    const [data] = contents.filter((item) => item.name === GarminPilotUtils.CONTENT_FILENAME);
    const container = GarminPilotChecklistContainer.fromJsonString(data.text);

    if (!GarminPilotUtils.isSupportedContainerType(container)) {
      throw new GarminPilotFormatError('unsupported container type');
    }

    return {
      groups: GarminPilotReader._checklistGroupsToEFIS(container.objects[0]),
      // TODO: If we start supporting Garmin-Pilot-generated GPLTS files, then we'll also
      // want to preserve binder metadata like sort order and UUID.
      metadata: ChecklistFileMetadata.create({ name: container.name }),
    };
  }

  private static _checklistGroupsToEFIS(objects: GarminPilotObjectsContainer): ChecklistGroup[] {
    const checklistItems = GarminPilotReader._checklistItemsToEFIS(objects.checklistItems);

    const ungroupedChecklists = objects.checklists
      .map((checklist) => GarminPilotReader._checklistToEFIS(checklist, checklistItems))
      .sort(([garminChecklistGroupKey1, _checklist1], [garminChecklistGroupKey2, _checklist2]) =>
        GarminPilotUtils.compareGarminChecklistGroupKeys(garminChecklistGroupKey1, garminChecklistGroupKey2),
      );

    const groupedChecklists = new Map<EfisChecklistGroupKey, Checklist[]>();

    ungroupedChecklists.forEach(([garminChecklistGroupKey, checklistEFIS]) => {
      const checklistGroupKeyEFIS = GarminPilotUtils.garminGroupKeyToEFIS(garminChecklistGroupKey);
      const checklistGroup = groupedChecklists.get(checklistGroupKeyEFIS) ?? [];
      checklistGroup.push(checklistEFIS);
      groupedChecklists.set(checklistGroupKeyEFIS, checklistGroup);
    });

    return [...groupedChecklists].map(([[categoryEFIS, titleEFIS], checklistsEFIS]) => ({
      category: categoryEFIS,
      title: titleEFIS,
      checklists: checklistsEFIS,
    }));
  }

  private static _checklistToEFIS(
    checklistGarmin: GarminPilotChecklist,
    checklistItemsEFIS: Map<string, ChecklistItem[]>,
  ): [GarminChecklistGroupKey, Checklist] {
    const items = [...checklistItemsEFIS]
      .filter(([itemKey, _checklistItems]) => checklistGarmin.checklistItems.includes(itemKey))
      .flatMap(([_itemKey, checklistItems]) => checklistItems);

    return [
      [checklistGarmin.type, checklistGarmin.subtype],
      {
        title: checklistGarmin.name,
        items,
        // TODO: Proper translation.
        completionAction: Checklist_CompletionAction.ACTION_GO_TO_NEXT_CHECKLIST,
      },
    ];
  }

  private static _checklistItemsToEFIS(checklistItems: GarminPilotChecklistItem[]): Map<string, ChecklistItem[]> {
    const resultMap = new Map<string, ChecklistItem[]>();

    checklistItems.forEach((checklistItemGarmin) => {
      switch (checklistItemGarmin.itemType) {
        case GarminPilotChecklistItem_ItemType.TYPE_PLAIN_TEXT:
          // Plain text item (= check item)
          if (checklistItemGarmin.action) {
            // Action is set - interpret as expectation
            resultMap.set(checklistItemGarmin.uuid, [
              ChecklistItem.create({
                type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
                prompt: checklistItemGarmin.title,
                expectation: checklistItemGarmin.action,
              }),
            ]);
          } else {
            // Action not set - interpret as prompt-only
            resultMap.set(checklistItemGarmin.uuid, [
              ChecklistItem.create({ type: ChecklistItem_Type.ITEM_CHALLENGE, prompt: checklistItemGarmin.title }),
            ]);
          }
          break;

        case GarminPilotChecklistItem_ItemType.TYPE_NOTE: {
          const resultItems = [];

          // Note item
          if (!checklistItemGarmin.title && !checklistItemGarmin.action) {
            // Neither title, nor action set - interpret as empty space
            resultItems.push(ChecklistItem.create({ type: ChecklistItem_Type.ITEM_SPACE }));
          } else if (checklistItemGarmin.title) {
            // Title is set - interpret as title
            resultItems.push(
              ChecklistItem.create({ type: ChecklistItem_Type.ITEM_TITLE, prompt: checklistItemGarmin.title }),
            );
          }

          if (checklistItemGarmin.action) {
            // Action is set - interpret as a note (standalone if title is not set)
            resultItems.push(
              ...FormatUtils.possiblyMultilineNoteToChecklistItems(
                checklistItemGarmin.action,
                !checklistItemGarmin.title,
              ),
            );
          }

          resultMap.set(checklistItemGarmin.uuid, resultItems);
          break;
        }

        case GarminPilotChecklistItem_ItemType.TYPE_LOCAL_ALTIMETER:
        case GarminPilotChecklistItem_ItemType.TYPE_OPEN_NEAREST:
        case GarminPilotChecklistItem_ItemType.TYPE_OPEN_ATIS_SCRATCHPAD:
        case GarminPilotChecklistItem_ItemType.TYPE_OPEN_CRAFT_SCRATCHPAD:
        case GarminPilotChecklistItem_ItemType.TYPE_WEATHER_FREQUENCY:
        case GarminPilotChecklistItem_ItemType.TYPE_CLEARANCE_FREQUENCY:
        case GarminPilotChecklistItem_ItemType.TYPE_GROUND_CTAF_FREQUENCY:
        case GarminPilotChecklistItem_ItemType.TYPE_TOWER_CTAF_FREQUENCY:
        case GarminPilotChecklistItem_ItemType.TYPE_APPROACH_FREQUENCY:
        case GarminPilotChecklistItem_ItemType.TYPE_CENTER_FREQUENCY:
          // Live data
          resultMap.set(checklistItemGarmin.uuid, [
            ChecklistItem.create({
              type: ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE,
              prompt: checklistItemGarmin.title,
              expectation: GarminPilotLiveData.getLiveDataFieldSlug(checklistItemGarmin.itemType),
            }),
          ]);
          break;
      }
    });

    return resultMap;
  }
}
