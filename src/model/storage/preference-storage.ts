import { Injectable } from '@angular/core';
import { LazyBrowserStorage } from './browser-storage';
import { PdfWriterOptions } from '../formats/pdf-writer';

@Injectable({ providedIn: 'root' })
export class PreferenceStorage {
  private static readonly PREFERENCES_PREFIX = 'prefs:';
  private static readonly PRINT_OPTIONS_KEY = PreferenceStorage.PREFERENCES_PREFIX + 'print';

  private readonly _browserStorage: Promise<Storage>;

  constructor(lazyStorage: LazyBrowserStorage) {
    this._browserStorage = lazyStorage.storage;
  }

  public async getPrintOptions(): Promise<PdfWriterOptions | null> {
    const store = await this._browserStorage;

    const optsStr = store.getItem(PreferenceStorage.PRINT_OPTIONS_KEY);
    if (!optsStr) {
      return null;
    }

    return JSON.parse(optsStr) as PdfWriterOptions;
  }

  public async setPrintOptions(opts: PdfWriterOptions) {
    const store = await this._browserStorage;
    const optsStr = JSON.stringify(opts);
    store.setItem(PreferenceStorage.PRINT_OPTIONS_KEY, optsStr);
  }
}
