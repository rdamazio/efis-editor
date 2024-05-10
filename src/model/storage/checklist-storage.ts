import { AfterRenderPhase, Injectable, afterNextRender } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { ChecklistFile } from "../../../gen/ts/checklist";

const CHECKLIST_PREFIX = "checklists:";

@Injectable({
  providedIn: 'root'
})
export class ChecklistStorage {
  private _browserStorage: Promise<any>;
  private _storageResolveFunc: any;

  constructor() {
    this._browserStorage = new Promise<any>((resolve, reject) => {
      this._storageResolveFunc = () => {
        if (global.hasOwnProperty('localStorage')) {
          console.log('Initialized local storage');
          resolve(localStorage);
        } else {
          console.log('No local storage!!');
          reject('No local storage found');
        }
      };

      afterNextRender(() => {
        setTimeout(() => {
          this._storageResolveFunc();
        });
        
      }, { phase: AfterRenderPhase.Read });
    });

    this._browserStorage.then(store => {
      this._publishList(store);
    });
  }

  // For testing only.
  forceBrowserStorage() {
    this._storageResolveFunc();
  }

  private _filesSubject = new BehaviorSubject<string[]>([]);
  private _file$ = this._filesSubject.asObservable();
  listChecklistFiles(): Observable<string[]> {
    return this._file$;
  }

  private _publishList(store: any) {
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
      return ChecklistFile.fromJsonString(blob);
    }
    return null;
  }

  async saveChecklistFile(file: ChecklistFile) {
    const store = await this._browserStorage;
    if (!file.metadata?.name) {
      throw new Error('Must specify checklist file name in metadata.');
    }
    const blob = ChecklistFile.toJsonString(file);
    store.setItem(CHECKLIST_PREFIX + file.metadata.name, blob);
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
    for (const id of ids) {
      await this.deleteChecklistFile(id);
    }

    const store = await this._browserStorage;
    this._publishList(store);
  }
}