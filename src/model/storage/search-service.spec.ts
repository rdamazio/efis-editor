import { TestBed } from '@angular/core/testing';

import { EXPECTED_CONTENTS } from '../formats/test-data';
import { SearchService } from './search-service';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SearchService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should search in file that will have a single match', () => {
    const results = service.searchInFile(EXPECTED_CONTENTS, 'Plain text item');

    expect(results).toEqual([
      {
        fileName: EXPECTED_CONTENTS.metadata!.name,
        groupIdx: 0,
        checklistIdx: 0,
        itemIdx: 2,
        matchLocation: 'prompt',
      },
    ]);
  });

  it('should search in a file that will have multiple matches', () => {
    const results = service.searchInFile(EXPECTED_CONTENTS, 'item 1');

    expect(results).toEqual([
      {
        fileName: EXPECTED_CONTENTS.metadata!.name,
        groupIdx: 1,
        checklistIdx: 0,
        itemIdx: 0,
        matchLocation: 'prompt',
      },
      {
        fileName: EXPECTED_CONTENTS.metadata!.name,
        groupIdx: 1,
        checklistIdx: 1,
        itemIdx: 0,
        matchLocation: 'prompt',
      },
      {
        fileName: EXPECTED_CONTENTS.metadata!.name,
        groupIdx: 1,
        checklistIdx: 2,
        itemIdx: 0,
        matchLocation: 'prompt',
      },
    ]);
  });

  it('should search in a file that will have no matches', () => {
    const results = service.searchInFile(EXPECTED_CONTENTS, 'Non-existent text');

    expect(results).toEqual([]);
  });

  it('should search in a file that will have group title matches', () => {
    const results = service.searchInFile(EXPECTED_CONTENTS, 'group 2 (default)');

    expect(results).toEqual([
      {
        fileName: EXPECTED_CONTENTS.metadata!.name,
        groupIdx: 1,
        matchLocation: 'title',
      },
    ]);
  });

  it('should search in a file that will have checklist title matches', () => {
    const results = service.searchInFile(EXPECTED_CONTENTS, 'Test group 1 checklist 1');

    expect(results).toEqual([
      {
        fileName: EXPECTED_CONTENTS.metadata!.name,
        groupIdx: 0,
        checklistIdx: 0,
        matchLocation: 'title',
      },
    ]);
  });

  it('should search in a file that will have both item and title matches', () => {
    const results = service.searchInFile(EXPECTED_CONTENTS, 'Test group 2');

    expect(results).toEqual([
      {
        fileName: EXPECTED_CONTENTS.metadata!.name,
        groupIdx: 1,
        matchLocation: 'title',
      },
      {
        fileName: EXPECTED_CONTENTS.metadata!.name,
        groupIdx: 1,
        checklistIdx: 0,
        matchLocation: 'title',
      },
      {
        fileName: EXPECTED_CONTENTS.metadata!.name,
        groupIdx: 1,
        checklistIdx: 0,
        itemIdx: 0,
        matchLocation: 'prompt',
      },
      {
        fileName: EXPECTED_CONTENTS.metadata!.name,
        groupIdx: 1,
        checklistIdx: 1,
        matchLocation: 'title',
      },
      {
        fileName: EXPECTED_CONTENTS.metadata!.name,
        groupIdx: 1,
        checklistIdx: 1,
        itemIdx: 0,
        matchLocation: 'prompt',
      },
      {
        fileName: EXPECTED_CONTENTS.metadata!.name,
        groupIdx: 1,
        checklistIdx: 2,
        matchLocation: 'title',
      },
      {
        fileName: EXPECTED_CONTENTS.metadata!.name,
        groupIdx: 1,
        checklistIdx: 2,
        itemIdx: 0,
        matchLocation: 'prompt',
      },
    ]);
  });
});
