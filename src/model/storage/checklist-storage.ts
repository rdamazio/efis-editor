import { Injectable, afterNextRender } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ChecklistFile } from '../../../gen/ts/checklist';
import { JsonFormat } from '../formats/json-format';

const CHECKLIST_PREFIX = 'checklists:';

@Injectable({
  providedIn: 'root',
})
export class ChecklistStorage {
  private _browserStorage: Promise<Storage>;
  private _storageResolveFunc?: () => void;

  constructor() {
    this._browserStorage = new Promise<Storage>((resolve, reject) => {
      this._storageResolveFunc = () => {
        if (Object.prototype.hasOwnProperty.call(global, 'localStorage')) {
          console.log('Initialized local storage');
          resolve(localStorage);
        } else {
          console.log('No local storage!!');
          reject(new Error('No local storage found'));
        }
      };

      afterNextRender({
        read: () => {
          setTimeout(() => {
            this._storageResolveFunc!();
          });
        },
      });
    });

    this._browserStorage
      .then((store) => {
        this._publishList(store);
        return void {};
      })
      .catch((error) => {
        console.error(error);
      });
  }

  // For testing only.
  forceBrowserStorage() {
    this._storageResolveFunc!();
  }

  private _filesSubject = new BehaviorSubject<string[]>([]);
  private _file$ = this._filesSubject.asObservable();
  listChecklistFiles(): Observable<string[]> {
    return this._file$;
  }

  private _publishList(store: Storage) {
    const names: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k?.startsWith(CHECKLIST_PREFIX)) {
        names.push(k.slice(CHECKLIST_PREFIX.length));
      }
    }
    this._filesSubject.next(names);
  }

  async getChecklistFile(id: string): Promise<ChecklistFile | null> {
    const store = await this._browserStorage;
    const blob = store.getItem(CHECKLIST_PREFIX + id);
    if (blob) {
      return JsonFormat.toProto(new File([blob], id));
    }
    return null;
  }

  async saveChecklistFile(file: ChecklistFile) {
    const store = await this._browserStorage;
    if (!file.metadata?.name) {
      throw new Error('Must specify checklist file name in metadata.');
    }
    const blob = await JsonFormat.fromProto(file);
    store.setItem(CHECKLIST_PREFIX + file.metadata.name, await blob.text());
    this._publishList(store);
  }

  async deleteChecklistFile(id: string) {
    const store = await this._browserStorage;
    store.removeItem(CHECKLIST_PREFIX + id);
    this._publishList(store);
  }

  async clear() {
    // Clear only checklist items.
    const ids = this._filesSubject.value;
    const allDeletes: Promise<void>[] = [];
    for (const id of ids) {
      allDeletes.push(this.deleteChecklistFile(id));
    }
    await Promise.all(allDeletes);

    const store = await this._browserStorage;
    this._publishList(store);
  }
}
