import { GarminPilotChecklistItem_ItemType } from '../../../gen/ts/garmin_pilot';
import { GarminPilotFormatError } from './garmin-pilot-utils';

export class GarminPilotLiveData {
  // Map from item type to a token and example string.
  private static readonly LIVE_DATA_FIELD_TO_EFIS = new Map([
    [GarminPilotChecklistItem_ItemType.TYPE_LOCAL_ALTIMETER, ['%LOCAL_ALTIMETER%', '1025.0HPA ETNG (14NM, 0+12 ago)']],
    [GarminPilotChecklistItem_ItemType.TYPE_OPEN_NEAREST, ['%OPEN_NEAREST%', '<Open NRST>']],
    [GarminPilotChecklistItem_ItemType.TYPE_OPEN_ATIS_SCRATCHPAD, ['%OPEN_ATIS_SCRATCHPAD%', '<ATIS ScratchPad>']],
    [GarminPilotChecklistItem_ItemType.TYPE_OPEN_CRAFT_SCRATCHPAD, ['%OPEN_CRAFT_SCRATCHPAD%', '<CRAFT ScratchPad>']],
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
    [...this.LIVE_DATA_FIELD_TO_EFIS.entries()].map(([garminType, [efisSlug, efisExample]]) => [
      efisSlug,
      [garminType, efisExample],
    ]),
  );

  public static getLiveDataFieldSlug(itemType: GarminPilotChecklistItem_ItemType): string {
    const [slug = undefined, ..._] = this.LIVE_DATA_FIELD_TO_EFIS.get(itemType) ?? [];
    if (!slug) {
      throw new GarminPilotFormatError(`unsupported item type: ${itemType}`);
    }
    return slug;
  }

  public static replaceLiveDataField(field: string): string {
    const [_, example] = this.LIVE_DATA_FIELD_TO_GARMIN.get(field) ?? [];
    return example ?? field;
  }

  public static getGarminLiveDataTypeByExpectation(expectation: string): GarminPilotChecklistItem_ItemType | undefined {
    const [garminType, _] = this.LIVE_DATA_FIELD_TO_GARMIN.get(expectation) ?? [];
    return garminType;
  }
}
