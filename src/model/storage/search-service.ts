import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChecklistFile } from '../../../gen/ts/checklist';
import { ChecklistStorage } from './checklist-storage';

export interface SearchResult {
  fileName: string;
  groupIdx: number;
  checklistIdx?: number;
  itemIdx?: number;
  matchLocation: 'title' | 'prompt' | 'expectation';
}

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  constructor(private readonly _storage: ChecklistStorage) {}

  searchInFile(checklistFile: ChecklistFile, query: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [groupIdx, group] of checklistFile.groups.entries()) {
      // Search in group titles.
      if (group.title.toLowerCase().includes(lowerQuery)) {
        results.push({
          fileName: checklistFile.metadata!.name,
          groupIdx,
          matchLocation: 'title',
        });
      }

      for (const [checklistIdx, checklist] of group.checklists.entries()) {
        // Search in checklist titles.
        if (checklist.title.toLowerCase().includes(lowerQuery)) {
          results.push({
            fileName: checklistFile.metadata!.name,
            groupIdx,
            checklistIdx,
            matchLocation: 'title',
          });
        }

        for (const [itemIdx, item] of checklist.items.entries()) {
          // Search in item prompts.
          if (item.prompt.toLowerCase().includes(lowerQuery)) {
            results.push({
              fileName: checklistFile.metadata!.name,
              groupIdx,
              checklistIdx,
              itemIdx,
              matchLocation: 'prompt',
            });
          }

          // Search in item expectations.
          if (item.expectation.toLowerCase().includes(lowerQuery)) {
            results.push({
              fileName: checklistFile.metadata!.name,
              groupIdx,
              checklistIdx,
              itemIdx,
              matchLocation: 'expectation',
            });
          }
        }
      }
    }
    return results;
  }

  async searchInAllFiles(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const fileNames = await firstValueFrom(this._storage.listChecklistFiles(), { defaultValue: [] });
    const filePromises = fileNames.map(async (fileName) => this._storage.getChecklistFile(fileName));
    const checklistFiles = await Promise.all(filePromises);
    for (const checklistFile of checklistFiles) {
      if (checklistFile) {
        results.push(...this.searchInFile(checklistFile, query));
      }
    }
    return results;
  }
}
