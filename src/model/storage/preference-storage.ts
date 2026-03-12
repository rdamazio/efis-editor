import { Injectable } from '@angular/core';
import { DEFAULT_OPTIONS, PdfWriterOptions } from '../formats/pdf-writer';
import { LazyBrowserStorage } from './browser-storage';

@Injectable({ providedIn: 'root' })
export class PreferenceStorage {
  private static readonly PREFERENCES_PREFIX = 'prefs:';
  private static readonly PRINT_OPTIONS_KEY = PreferenceStorage.PREFERENCES_PREFIX + 'print';

  private readonly _browserStorage: Promise<Storage>;

  constructor(lazyStorage: LazyBrowserStorage) {
    this._browserStorage = lazyStorage.storage;
  }

  public async getPrintOptions(): Promise<PdfWriterOptions> {
    const store = await this._browserStorage;

    const optsStr = store.getItem(PreferenceStorage.PRINT_OPTIONS_KEY);
    if (!optsStr) {
      return { ...DEFAULT_OPTIONS };
    }

    const opts = JSON.parse(optsStr) as PdfWriterOptions;

    // If any fields are missing (because they were added later), add them from the defaults.
    const finalOpts = {
      ...DEFAULT_OPTIONS,
      ...opts,
    };

    // Backward compatibility for checklistNewPage.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    if ((finalOpts as any).checklistNewPage !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      finalOpts.checklistStart = (finalOpts as any).checklistNewPage ? 'page' : 'below';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      delete (finalOpts as any).checklistNewPage;
    }

    return finalOpts;
  }

  public async setPrintOptions(opts: PdfWriterOptions) {
    const store = await this._browserStorage;
    const optsStr = JSON.stringify(opts);
    store.setItem(PreferenceStorage.PRINT_OPTIONS_KEY, optsStr);
  }
}
