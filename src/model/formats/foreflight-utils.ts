import { v4 as uuidV4 } from 'uuid';
import { ChecklistItem_Type } from '../../../gen/ts/checklist';

enum KeyUsage {
  ENCRYPT = 'encrypt',
  DECRYPT = 'decrypt',
}

interface PartialChecklistItem {
  type: ChecklistItem_Type;
  prompt: string;
}

function swap<T1, T2>([a, b]: [T1, T2]): [T2, T1] {
  return [b, a];
}

export class ForeFlightUtils {
  public static readonly FILE_EXTENSION = 'fmd';

  public static readonly CONTAINER_TYPE = 'checklist';
  public static readonly SCHEMA_VERSION = '1.0';

  public static readonly ITEM_HEADER = 'comment';
  public static readonly NOTE_INDENT = 1;

  private static readonly CIPHER_TYPE = 'AES-CBC';
  private static readonly CIPHER_BLOCK_SIZE = 16;
  private static readonly CIPHER_KEY = Buffer.from('81e06e41a93f3848', 'ascii');

  private static readonly ENCODER = new TextEncoder();
  private static readonly DECODER = new TextDecoder();

  public static readonly CHECKLIST_ITEM_PREFIXES = new Map([
    [ChecklistItem_Type.ITEM_PLAINTEXT, ''],
    [ChecklistItem_Type.ITEM_NOTE, 'NOTE: '],
    [ChecklistItem_Type.ITEM_CAUTION, 'CAUTION: '],
    [ChecklistItem_Type.ITEM_WARNING, 'WARNING: '],
  ]);

  public static readonly CHECKLIST_ITEM_TYPES = new Map(
    Array.from(ForeFlightUtils.CHECKLIST_ITEM_PREFIXES.entries()).map((item) => swap(item)),
  );

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
      ? {
          type: itemType,
          prompt: rest,
        }
      : {
          type: ChecklistItem_Type.ITEM_PLAINTEXT,
          prompt: prompt,
        };
  }

  private static async _getKey(keyUsage: KeyUsage): Promise<CryptoKey> {
    return window.crypto.subtle.importKey(
      'raw',
      ForeFlightUtils.CIPHER_KEY,
      { name: ForeFlightUtils.CIPHER_TYPE },
      false,
      [keyUsage],
    );
  }

  public static async decrypt(stream: ArrayBuffer): Promise<string> {
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: ForeFlightUtils.CIPHER_TYPE,
        iv: new Uint8Array(stream.slice(0, ForeFlightUtils.CIPHER_BLOCK_SIZE)),
      },
      await ForeFlightUtils._getKey(KeyUsage.DECRYPT),
      new Uint8Array(stream.slice(ForeFlightUtils.CIPHER_BLOCK_SIZE)),
    );
    return ForeFlightUtils.DECODER.decode(new Uint8Array(decrypted));
  }

  public static async encrypt(data: string): Promise<Blob> {
    const iv = window.crypto.getRandomValues(new Uint8Array(ForeFlightUtils.CIPHER_BLOCK_SIZE));
    return new Blob(
      [
        iv,
        await window.crypto.subtle.encrypt(
          { name: ForeFlightUtils.CIPHER_TYPE, iv: iv },
          await ForeFlightUtils._getKey(KeyUsage.ENCRYPT),
          ForeFlightUtils.ENCODER.encode(data),
        ),
      ],
      { type: 'application/octet-stream' },
    );
  }

  /**
   * Object IDs appear to be UUID V4 without dashes, and are presumably used for checklist synchronization
   */
  public static getObjectId(): string {
    return uuidV4().replaceAll('-', '');
  }
}
