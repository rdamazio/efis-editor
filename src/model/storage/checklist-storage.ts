import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ChecklistFile } from '../../../gen/ts/checklist';
import { FormatId } from '../formats/format-id';
import { FORMAT_REGISTRY } from '../formats/format-registry';
import { LazyBrowserStorage } from './browser-storage';

const CHECKLIST_PREFIX = 'checklists:';

@Injectable({ providedIn: 'root' })
export class ChecklistStorage {
  private readonly _jsonFormat = FORMAT_REGISTRY.getFormat(FormatId.JSON);

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
      return this._jsonFormat.toProto(new File([blob], id)).then(async (checklist: ChecklistFile) => {
        if (!checklist.metadata?.modifiedTime) {
          // If checklist didn't have mtime, save it to add it now.
          console.error('SAVER1');
          await this.saveChecklistFile(checklist);
        }
        return checklist;
      });
    }
    return null;
  }

  async saveChecklistFile(file: ChecklistFile, mtime?: Date) {
    console.error('SAVE1');
    const store = await this._browserStorage.storage;
    file = ChecklistFile.clone(file);
    if (!file.metadata?.name) {
      throw new Error('Must specify checklist file name in metadata.');
    }
    mtime ??= new Date();
    file.metadata.modifiedTime = Math.floor(mtime.valueOf() / 1000);

    console.error('SAVE2');
    const blob = await this._jsonFormat.fromProto(file);
    console.error('SAVE3');
    store.setItem(CHECKLIST_PREFIX + file.metadata.name, await blob.text());
    console.error('SAVE4');
    this._publishList(store);
    console.error('SAVE5');
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
