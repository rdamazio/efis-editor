import { ChecklistGroup_Category } from '../../../gen/ts/checklist';
import {
  GarminPilotChecklist_CompletionItem,
  GarminPilotChecklist_SubType,
  GarminPilotChecklist_Type,
  GarminPilotChecklistContainer,
  GarminPilotChecklistItem_ItemType,
} from '../../../gen/ts/garmin_pilot';
import { CryptoUtils } from './crypto-utils';
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

  private static readonly CIPHER_KEY = Buffer.from('00000000000000000000000000000000', 'ascii');
  private static readonly CIPHER_IV = Buffer.from('0'.repeat(CryptoUtils.CIPHER_BLOCK_SIZE));

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

  private static readonly LIVE_DATA_FIELD_TO_EFIS = new Map([
    [GarminPilotChecklistItem_ItemType.TYPE_LOCAL_ALTIMETER, ['%LOCAL_ALTIMETER%', '1025.0HPA ETNG (14NM, 0+12 ago)']],
    [GarminPilotChecklistItem_ItemType.TYPE_OPEN_NEAREST, ['%OPEN_NEAREST%', 'NRST']],
    [GarminPilotChecklistItem_ItemType.TYPE_OPEN_ATIS_SCRATCHPAD, ['%OPEN_ATIS_SCRATCHPAD%', 'ScratchPad ATIS']],
    [GarminPilotChecklistItem_ItemType.TYPE_OPEN_CRAFT_SCRATCHPAD, ['%OPEN_CRAFT_SCRATCHPAD%', 'ScratchPad CRAFT']],
    [GarminPilotChecklistItem_ItemType.TYPE_WEATHER_FREQUENCY, ['%WEATHER_FREQUENCY%', '123.45 ETNG (14NM)']],
    [GarminPilotChecklistItem_ItemType.TYPE_CLEARANCE_FREQUENCY, ['%CLEARANCE_FREQUENCY%', '121.83 EHBK (24NM)']],
    [
      GarminPilotChecklistItem_ItemType.TYPE_GROUND_CTAF_FREQUENCY,
      ['%GROUND_CTAF_FREQUENCY%', '123.525/129.875 EDKA (10NM)'],
    ],
    [
      GarminPilotChecklistItem_ItemType.TYPE_TOWER_CTAF_FREQUENCY,
      ['%TOWER_CTAF_FREQUENCY%', '129.875/123.525 EDKA (10NM)'],
    ],
    [
      GarminPilotChecklistItem_ItemType.TYPE_APPROACH_FREQUENCY,
      ['%APPROACH_FREQUENCY%', '120.205/123.875 EHBK (24NM)'],
    ],
    [
      GarminPilotChecklistItem_ItemType.TYPE_CENTER_FREQUENCY,
      ['%CENTER_FREQUENCY%', '122.835/125.98/126.115 BRUSSELS (24NM)'],
    ],
  ]);

  private static readonly LIVE_DATA_FIELD_TO_GARMIN = new Map<string, [GarminPilotChecklistItem_ItemType, string]>(
    [...GarminPilotUtils.LIVE_DATA_FIELD_TO_EFIS.entries()].map(([garminType, [efisSlug, efisExample]]) => [
      efisSlug,
      [garminType, efisExample],
    ]),
  );

  public static getLiveDataFieldSlug(itemType: GarminPilotChecklistItem_ItemType): string {
    const [slug = undefined, ..._] = GarminPilotUtils.LIVE_DATA_FIELD_TO_EFIS.get(itemType) ?? [];
    if (!slug) {
      throw new GarminPilotFormatError(`unsupported item type: ${itemType}`);
    }
    return slug;
  }

  public static getLiveDataFieldExample(field: string): string | undefined {
    const [_, example] = GarminPilotUtils.LIVE_DATA_FIELD_TO_GARMIN.get(field) ?? [];
    return example;
  }

  public static getGarminLiveDataTypeByExpectation(expectation: string): GarminPilotChecklistItem_ItemType | undefined {
    const [garminType, _] = GarminPilotUtils.LIVE_DATA_FIELD_TO_GARMIN.get(expectation) ?? [];
    return garminType;
  }

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

  private static _mixWithIv(stream: Uint8Array): Uint8Array {
    for (const index of Array(CryptoUtils.CIPHER_BLOCK_SIZE).keys()) {
      stream[index] ^= GarminPilotUtils.CIPHER_IV[index];
    }
    return stream;
  }

  public static async decrypt(stream: ArrayBuffer): Promise<Uint8Array> {
    return GarminPilotUtils._mixWithIv(
      await CryptoUtils.decrypt(GarminPilotUtils.CIPHER_KEY, GarminPilotUtils.CIPHER_IV, stream),
    );
  }

  public static async encrypt(stream: Uint8Array): Promise<Blob> {
    return CryptoUtils.toBlob([
      await CryptoUtils.encrypt(
        GarminPilotUtils.CIPHER_KEY,
        GarminPilotUtils.CIPHER_IV,
        GarminPilotUtils._mixWithIv(stream),
      ),
    ]);
  }
}
