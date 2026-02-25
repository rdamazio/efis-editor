import { inject, TestBed } from '@angular/core/testing';
import { DEFAULT_OPTIONS, PdfWriterOptions } from '../formats/pdf-writer';
import { LazyBrowserStorage } from './browser-storage';
import { PreferenceStorage } from './preference-storage';

const NON_DEFAULT_OPTS: PdfWriterOptions = {
  orientation: 'landscape',
  pageSize: 'a6',
  customPageWidth: 5,
  customPageHeight: 12,
  marginUnits: 'mm',
  marginLeft: 1,
  marginRight: 2,
  marginBottom: 3,
  marginTop: 4,
  marginOffsetsGroupTitle: true,
  outputCoverPage: false,
  outputGroupCoverPages: true,
  outputPageNumbers: false,
  outputCompletionActions: false,
};

describe('PreferenceStorage', () => {
  let store: PreferenceStorage;
  let browserStore: Storage;

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  beforeEach(inject(
    [PreferenceStorage, LazyBrowserStorage],
    async (s: PreferenceStorage, lazyBrowserStore: LazyBrowserStorage) => {
      lazyBrowserStore.forceBrowserStorage();
      browserStore = await lazyBrowserStore.storage;
      browserStore.clear();

      store = s;
    },
  ));

  afterEach(() => {
    browserStore.clear();
  });

  it('should retrieve default print options when none are stored', async () => {
    const opts = await store.getPrintOptions();
    expect(opts).toEqual(DEFAULT_OPTIONS);
  });

  it('should store and retrieve print options', async () => {
    await store.setPrintOptions(NON_DEFAULT_OPTS);

    const storedOpts = await store.getPrintOptions();
    expect(storedOpts).toEqual(NON_DEFAULT_OPTS);
  });

  it('should fill missing print option fields from default options', async () => {
    const opts: PdfWriterOptions = {
      orientation: NON_DEFAULT_OPTS.orientation,
      customPageWidth: NON_DEFAULT_OPTS.customPageWidth,
      marginUnits: NON_DEFAULT_OPTS.marginUnits,
      marginRight: NON_DEFAULT_OPTS.marginRight,
      outputGroupCoverPages: NON_DEFAULT_OPTS.outputGroupCoverPages,
    };

    await store.setPrintOptions(opts);

    const storedOpts = await store.getPrintOptions();
    expect(storedOpts).toEqual({
      ...DEFAULT_OPTIONS,
      ...opts,
    });
  });
});
