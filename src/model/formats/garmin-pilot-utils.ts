import { ChecklistGroup_Category } from '../../../gen/ts/checklist';
import {
  GarminPilotChecklist_CompletionItem,
  GarminPilotChecklist_SubType,
  GarminPilotChecklist_Type,
  GarminPilotChecklistContainer,
} from '../../../gen/ts/garmin_pilot';
import { FormatError } from './error';

import { swap } from './format-utils';

export class GarminPilotFormatError extends FormatError {
  constructor(message: string, cause?: Error) {
    super(`Garmin Pilot: ${message}`);
    this.cause = cause;
    this.name = 'GarminPilotFormatError';
  }
}

export type GarminChecklistGroupKey = [GarminPilotChecklist_Type, GarminPilotChecklist_SubType];
export type EfisChecklistGroupKey = [ChecklistGroup_Category, string];

export class GarminPilotUtils {
  public static readonly CONTAINER_TYPE = 'checklistBinder';
  public static readonly DATA_MODEL_VERSION = 1;
  public static readonly PACKAGE_TYPE_VERSION = 1;

  public static readonly CONTENT_FILENAME = 'content.json';

  private static readonly DEFAULT_NORMAL_GROUP_KEY: GarminChecklistGroupKey = [
    GarminPilotChecklist_Type.NORMAL,
    GarminPilotChecklist_SubType.SUBTYPE_OTHER,
  ];

  private static readonly DEFAULT_ABNORMAL_GROUP_KEY: GarminChecklistGroupKey = [
    GarminPilotChecklist_Type.ABNORMAL,
    GarminPilotChecklist_SubType.SUBTYPE_EMERGENCY,
  ];

  private static readonly DEFAULT_EMERGENCY_GROUP_KEY: GarminChecklistGroupKey = [
    GarminPilotChecklist_Type.EMERGENCY,
    GarminPilotChecklist_SubType.SUBTYPE_EMERGENCY,
  ];

  private static readonly GARMIN_GROUP_MAPPING: [GarminChecklistGroupKey, EfisChecklistGroupKey][] = [
    [
      [GarminPilotChecklist_Type.NORMAL, GarminPilotChecklist_SubType.SUBTYPE_PREFLIGHT],
      [ChecklistGroup_Category.normal, 'Preflight'],
    ],
    [
      [GarminPilotChecklist_Type.NORMAL, GarminPilotChecklist_SubType.SUBTYPE_TAKEOFF_CRUISE],
      [ChecklistGroup_Category.normal, 'Takeoff/Cruise'],
    ],
    [
      [GarminPilotChecklist_Type.NORMAL, GarminPilotChecklist_SubType.SUBTYPE_LANDING],
      [ChecklistGroup_Category.normal, 'Landing'],
    ],
    [GarminPilotUtils.DEFAULT_NORMAL_GROUP_KEY, [ChecklistGroup_Category.normal, 'Other']],
    [GarminPilotUtils.DEFAULT_ABNORMAL_GROUP_KEY, [ChecklistGroup_Category.abnormal, 'Abnormal']],
    [GarminPilotUtils.DEFAULT_EMERGENCY_GROUP_KEY, [ChecklistGroup_Category.emergency, 'Emergency']],
  ];

  private static readonly GARMIN_GROUP_TO_EFIS = new Map(
    GarminPilotUtils.GARMIN_GROUP_MAPPING.map(([key, value]) => [JSON.stringify(key), value]),
  );

  private static readonly EFIS_GROUP_TO_GARMIN = new Map(
    GarminPilotUtils.GARMIN_GROUP_MAPPING.map(([key, value]) => [JSON.stringify(value), key]),
  );

  public static garminGroupKeyToEFIS(garminKey: GarminChecklistGroupKey): EfisChecklistGroupKey {
    const efisKey = GarminPilotUtils.GARMIN_GROUP_TO_EFIS.get(JSON.stringify(garminKey));
    if (!efisKey) {
      throw new GarminPilotFormatError(`unsupported checklist group type: ${garminKey}`);
    }
    return efisKey;
  }

  public static efisGroupKeyToGarmin([efisType, efisSubtype]: EfisChecklistGroupKey): GarminChecklistGroupKey {
    const garminKey = GarminPilotUtils.EFIS_GROUP_TO_GARMIN.get(JSON.stringify([efisType, efisSubtype]));
    if (garminKey === undefined) {
      switch (efisType) {
        case ChecklistGroup_Category.normal:
          return GarminPilotUtils.DEFAULT_NORMAL_GROUP_KEY;
        case ChecklistGroup_Category.abnormal:
          return GarminPilotUtils.DEFAULT_ABNORMAL_GROUP_KEY;
        case ChecklistGroup_Category.emergency:
          return GarminPilotUtils.DEFAULT_EMERGENCY_GROUP_KEY;
        case ChecklistGroup_Category.unknown:
          throw new GarminPilotFormatError(`group key '${efisType}' is not supported`);
      }
    }
    return garminKey;
  }

  public static readonly COMPLETION_ACTION_TO_EFIS = new Map([
    [GarminPilotChecklist_CompletionItem.ACTION_DO_NOTHING, 'On Completion: Do Nothing'],
    [GarminPilotChecklist_CompletionItem.ACTION_GO_TO_NEXT_CHECKLIST, 'On Completion: Go to Next Checklist'],
    [GarminPilotChecklist_CompletionItem.ACTION_OPEN_FLIGHT_PLAN, 'On Completion: Open Flight Plan'],
    [GarminPilotChecklist_CompletionItem.ACTION_CLOSE_FLIGHT_PLAN, 'On Completion: Close Flight Plan'],
    [GarminPilotChecklist_CompletionItem.ACTION_OPEN_SAFETAXI, 'On Completion: Open SafeTaxi'],
    [GarminPilotChecklist_CompletionItem.ACTION_OPEN_MAP, 'On Completion: Open Map'],
  ]);

  public static readonly COMPLETION_ACTION_TO_GARMIN = new Map(
    [...GarminPilotUtils.COMPLETION_ACTION_TO_EFIS.entries()].map((item) => swap(item)),
  );

  public static compareGarminChecklistGroupKeys(
    [type1, subtype1]: GarminChecklistGroupKey,
    [type2, subtype2]: GarminChecklistGroupKey,
  ): number {
    return type1 - type2 ? subtype1 - subtype2 : 0;
  }

  public static isSupportedContainerType(container: GarminPilotChecklistContainer): boolean {
    return (
      container.dataModelVersion === GarminPilotUtils.DATA_MODEL_VERSION &&
      container.packageTypeVersion === GarminPilotUtils.PACKAGE_TYPE_VERSION &&
      container.type === GarminPilotUtils.CONTAINER_TYPE &&
      container.objects.length === 1
    );
  }
}
