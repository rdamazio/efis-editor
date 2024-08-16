import { ChecklistGroup_Category } from '../../../gen/ts/checklist';
import { v4 as uuid } from 'uuid';
import { ForeFlightFormatError } from './foreflight-format';
import { ForeFlightChecklistContainer } from '../../../gen/ts/foreflight';

export enum ForeFlightCategory {
  Normal = 'normal',
  Abnormal = 'abnormal',
  Emergency = 'emergency',
}

enum KeyUsage {
  Encrypt = 'encrypt',
  Decrypt = 'decrypt',
}

export class ForeFlightUtils {
  public static readonly FILE_EXTENSION = 'fmd';

  public static readonly CONTAINER_TYPE = 'checklist';
  public static readonly SCHEMA_VERSION = '1.0';

  public static readonly ITEM_HEADER = 'comment';
  public static readonly NOTE_INDENT = 1;

  public static readonly OBJECT_ID_LENGTH = 32;

  static readonly CIPHER_TYPE = 'AES-CBC';
  static readonly CIPHER_BLOCK_SIZE = 16;
  static readonly CIPHER_KEY = Buffer.from('81e06e41a93f3848', 'ascii');

  static readonly encoder = new TextEncoder();
  static readonly decoder = new TextDecoder();

  private static getKey(keyUsage: KeyUsage): Promise<CryptoKey> {
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
      await ForeFlightUtils.getKey(KeyUsage.Decrypt),
      new Uint8Array(stream.slice(ForeFlightUtils.CIPHER_BLOCK_SIZE)),
    );
    return ForeFlightUtils.decoder.decode(new Uint8Array(decrypted));
  }

  public static async encrypt(data: string): Promise<Blob> {
    const iv = window.crypto.getRandomValues(new Uint8Array(ForeFlightUtils.CIPHER_BLOCK_SIZE));
    return new Blob(
      [
        iv,
        await window.crypto.subtle.encrypt(
          { name: ForeFlightUtils.CIPHER_TYPE, iv: iv },
          await ForeFlightUtils.getKey(KeyUsage.Encrypt),
          ForeFlightUtils.encoder.encode(data),
        ),
      ],
      { type: 'application/octet-stream' },
    );
  }

  public static categoryToEFIS(category: string): ChecklistGroup_Category {
    switch (category) {
      case ForeFlightCategory.Normal:
        return ChecklistGroup_Category.NORMAL;
      case ForeFlightCategory.Abnormal:
        return ChecklistGroup_Category.ABNORMAL;
      case ForeFlightCategory.Emergency:
        return ChecklistGroup_Category.EMERGENCY;
      default:
        throw new ForeFlightFormatError(`unknown category '${category}'`);
    }
  }

  public static async getObjectId(): Promise<string> {
    const hash = Array.from(
      new Uint8Array(await window.crypto.subtle.digest('SHA-256', ForeFlightUtils.encoder.encode(uuid()))),
    );
    return hash
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, ForeFlightUtils.OBJECT_ID_LENGTH);
  }

  public static getChecklistFileName(file: File, container: ForeFlightChecklistContainer): string {
    return container.payload?.metadata?.name || file.name.replace(`\\.${ForeFlightUtils.FILE_EXTENSION}$`, '');
  }
}
