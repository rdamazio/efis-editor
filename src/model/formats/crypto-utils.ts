enum KeyUsage {
  ENCRYPT = 'encrypt',
  DECRYPT = 'decrypt',
}

export class CryptoUtils {
  public static readonly CIPHER_TYPE = 'AES-CBC';
  public static readonly CIPHER_BLOCK_SIZE = 16;

  private static readonly ENCODER = new TextEncoder();
  private static readonly DECODER = new TextDecoder();

  public static async getKey(
    cipherKey: ArrayBuffer,
    cipherIv: ArrayBuffer,
    keyUsage: KeyUsage,
  ): Promise<[AesCbcParams, CryptoKey]> {
    const cryptoKey = window.crypto.subtle.importKey('raw', cipherKey, { name: CryptoUtils.CIPHER_TYPE }, false, [
      keyUsage,
    ]);
    const algorithm = { name: CryptoUtils.CIPHER_TYPE, iv: cipherIv };
    return [algorithm, await cryptoKey];
  }

  public static async decrypt(cipherKey: ArrayBuffer, cipherIv: ArrayBuffer, data: ArrayBuffer): Promise<Uint8Array> {
    const [algorithm, key] = await CryptoUtils.getKey(cipherKey, cipherIv, KeyUsage.DECRYPT);
    return new Uint8Array(await window.crypto.subtle.decrypt(algorithm, key, data));
  }

  public static async encrypt(cipherKey: ArrayBuffer, cipherIv: ArrayBuffer, data: ArrayBuffer): Promise<ArrayBuffer> {
    const [algorithm, key] = await CryptoUtils.getKey(cipherKey, cipherIv, KeyUsage.ENCRYPT);
    return await window.crypto.subtle.encrypt(algorithm, key, data);
  }

  public static async decryptText(cipherKey: ArrayBuffer, cipherIv: ArrayBuffer, data: ArrayBuffer): Promise<string> {
    const decrypted = await CryptoUtils.decrypt(cipherKey, cipherIv, data);
    return CryptoUtils.DECODER.decode(decrypted);
  }

  public static async encryptText(cipherKey: ArrayBuffer, cipherIv: ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const encoded = CryptoUtils.ENCODER.encode(data);
    return CryptoUtils.encrypt(cipherKey, cipherIv, encoded);
  }

  public static toBlob(parts: ArrayBuffer[]): Blob {
    return new Blob(parts, { type: 'application/octet-stream' });
  }
}
