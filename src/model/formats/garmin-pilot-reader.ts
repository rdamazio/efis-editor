import { parseTarGzip } from 'nanotar';
import {
  Checklist,
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
  GarminPilotMetadata,
  GarminPilotObjectsContainer,
} from '../../../gen/ts/garmin_pilot';
import { FormatUtils } from './format-utils';
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

    const metadata = GarminPilotMetadata.create({
      sortOrder: container.objects[0].binders[0].sortOrder,
      sourceTemplateUUID: container.objects[0].binders[0].sourceTemplateUUID,
    });

    return {
      groups: GarminPilotReader._checklistGroupsToEFIS(container.objects[0]),
      metadata: ChecklistFileMetadata.create({
        name: container.name,
        copyrightInfo: GarminPilotMetadata.toJsonString(metadata),
      }),
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
    return [
      [checklistGarmin.type, checklistGarmin.subtype],
      {
        title: checklistGarmin.name,
        items: [
          ...[...checklistItemsEFIS]
            .filter(([itemKey, _checklistItems]) => checklistGarmin.checklistItems.includes(itemKey))
            .flatMap(([_itemKey, checklistItems]) => checklistItems),
          ChecklistItem.create({
            type: ChecklistItem_Type.ITEM_PLAINTEXT,
            prompt: GarminPilotUtils.COMPLETION_ACTION_TO_EFIS.get(checklistGarmin.completionItem),
          }),
        ],
      },
    ];
  }

  private static _checklistItemsToEFIS(checklistItems: GarminPilotChecklistItem[]): Map<string, ChecklistItem[]> {
    const resultMap = new Map<string, ChecklistItem[]>();

    checklistItems.forEach((checklistItemGarmin) => {
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
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

        // TODO: Live data fields.
      }
    });

    return resultMap;
  }
}
