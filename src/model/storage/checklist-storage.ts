import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ChecklistFile } from '../../../gen/ts/checklist';
import { JsonFormat } from '../formats/json-format';
import { LazyBrowserStorage } from './browser-storage';

const CHECKLIST_PREFIX = 'checklists:';

@Injectable({ providedIn: 'root' })
export class ChecklistStorage {
  constructor(private readonly _browserStorage: LazyBrowserStorage) {
    _browserStorage.storage
      .then((store: Storage) => {
        this._publishList(store);
        return void {};
      })
      .catch((error: unknown) => {
        console.error(error);
      });
  }

  private readonly _filesSubject$ = new BehaviorSubject<string[]>([]);
  listChecklistFiles(): Observable<string[]> {
    return this._filesSubject$.asObservable();
  }

  private _publishList(store: Storage) {
    const names: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k?.startsWith(CHECKLIST_PREFIX)) {
        names.push(k.slice(CHECKLIST_PREFIX.length));
      }
    }
    this._filesSubject$.next(names);
  }

  async getChecklistFile(id: string): Promise<ChecklistFile | null> {
    const store = await this._browserStorage.storage;
    const blob = store.getItem(CHECKLIST_PREFIX + id);
    if (blob) {
      return JsonFormat.toProto(new File([blob], id)).then(async (checklist: ChecklistFile) => {
        if (!checklist.metadata?.modifiedTime) {
          // If checklist didn't have mtime, save it to add it now.
          await this.saveChecklistFile(checklist);
        }
        return checklist;
      });
    }
    return null;
  }

  async saveChecklistFile(file: ChecklistFile, mtime?: Date) {
    const store = await this._browserStorage.storage;
    file = ChecklistFile.clone(file);
    if (!file.metadata?.name) {
      throw new Error('Must specify checklist file name in metadata.');
    }
    mtime ??= new Date();
    file.metadata.modifiedTime = Math.floor(mtime.valueOf() / 1000);

    const blob = JsonFormat.fromProto(file);
    store.setItem(CHECKLIST_PREFIX + file.metadata.name, await blob.text());
    this._publishList(store);
  }

  async deleteChecklistFile(id: string) {
    const store = await this._browserStorage.storage;
    store.removeItem(CHECKLIST_PREFIX + id);
    this._publishList(store);
  }

  async clear() {
    // Clear only checklist items.
    const ids = this._filesSubject$.value;
    const allDeletes: Promise<void>[] = [];
    for (const id of ids) {
      allDeletes.push(this.deleteChecklistFile(id));
    }
    await Promise.all(allDeletes);

    const store = await this._browserStorage.storage;
    this._publishList(store);
  }
}
