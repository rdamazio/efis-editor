import { v4 as uuidV4 } from 'uuid';
import { CryptoUtils } from './crypto-utils';

export class ForeFlightUtils {
  public static readonly CONTAINER_TYPE = 'checklist';
  public static readonly SCHEMA_VERSION = '1.0';
  public static readonly ITEM_HEADER = 'comment';

  private static readonly CIPHER_KEY = Buffer.from('81e06e41a93f3848', 'ascii');

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
