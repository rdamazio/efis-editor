import { v4 as uuidV4 } from 'uuid';
import { ChecklistItem_Type } from '../../../gen/ts/checklist';
import { CryptoUtils } from './crypto-utils';
import { ForeFlightFormatError } from './foreflight-format';

interface PartialChecklistItem {
  type: ChecklistItem_Type;
  prompt: string;
}

function swap<T1, T2>([a, b]: [T1, T2]): [T2, T1] {
  return [b, a];
}

export class ForeFlightUtils {
  public static readonly CONTAINER_TYPE = 'checklist';
  public static readonly SCHEMA_VERSION = '1.0';

  public static readonly ITEM_HEADER = 'comment';
  public static readonly NOTE_INDENT = 1;

  private static readonly CIPHER_KEY = Buffer.from('81e06e41a93f3848', 'ascii');

  public static readonly CHECKLIST_ITEM_PREFIXES = new Map([
    [ChecklistItem_Type.ITEM_PLAINTEXT, ''],
    [ChecklistItem_Type.ITEM_NOTE, 'NOTE: '],
    [ChecklistItem_Type.ITEM_CAUTION, 'CAUTION: '],
    [ChecklistItem_Type.ITEM_WARNING, 'WARNING: '],
  ]);

  public static readonly CHECKLIST_ITEM_TYPES = new Map(
    Array.from(ForeFlightUtils.CHECKLIST_ITEM_PREFIXES.entries()).map((item) => swap(item)),
  );

  public static getChecklistItemPrefix(type: ChecklistItem_Type): string {
    const prefix = ForeFlightUtils.CHECKLIST_ITEM_PREFIXES.get(type);
    if (prefix === undefined) {
      throw new ForeFlightFormatError(`unsupported prefix type: ${type}`);
    }
    return prefix;
  }

  public static splitLines(text: string): string[] {
    return text.split(/\r?\n/);
  }
  public static splitByColon(text: string): [string, string] {
    const matches = /^([^:]+: )?(.*)$/.exec(text); // eslint-disable-line prefer-named-capture-group
    return matches !== null ? [matches[1] || '', matches[2]] : ['', text];
  }

  public static promptToPartialChecklistItem(prompt: string): PartialChecklistItem {
    const [prefix, rest] = ForeFlightUtils.splitByColon(prompt);
    const itemType = ForeFlightUtils.CHECKLIST_ITEM_TYPES.get(prefix);
    return itemType !== undefined
      ? { type: itemType, prompt: rest }
      : { type: ChecklistItem_Type.ITEM_PLAINTEXT, prompt: prompt };
  }

  public static async decrypt(stream: ArrayBuffer): Promise<string> {
    const iv = new Uint8Array(stream.slice(0, CryptoUtils.CIPHER_BLOCK_SIZE));
    const data = stream.slice(CryptoUtils.CIPHER_BLOCK_SIZE);
    return await CryptoUtils.decryptText(ForeFlightUtils.CIPHER_KEY, iv, data);
  }

  public static async encrypt(text: string): Promise<Blob> {
    const iv = window.crypto.getRandomValues(new Uint8Array(CryptoUtils.CIPHER_BLOCK_SIZE));
    return CryptoUtils.toBlob([iv, await CryptoUtils.encryptText(ForeFlightUtils.CIPHER_KEY, iv, text)]);
  }

  /**
   * Object IDs appear to be UUID V4 without dashes, and are presumably used for checklist synchronization
   */
  public static getObjectId(): string {
    return uuidV4().replaceAll('-', '');
  }
}
