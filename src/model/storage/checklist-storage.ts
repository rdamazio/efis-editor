import { AfterRenderPhase, Injectable, afterNextRender } from "@angular/core";
import { ChecklistFile } from "../../../gen/ts/checklist";

const CHECKLIST_PREFIX = "checklists:";

@Injectable({
  providedIn: 'root'
})
export class ChecklistStorage {
  private _browserStorage: any;

  constructor() {
    afterNextRender(() => {
      this.onAfterRender();
    }, { phase: AfterRenderPhase.Read });
  }

  onAfterRender() {
    this._browserStorage = localStorage;
  }

  listChecklistFiles(): string[] {
    if (!this._browserStorage) {
      // TODO: NG0100 error caused by this
      return [];
    }

    let names: string[] = [];
    for (let i = 0; i < this._browserStorage.length; i++) {
      let k = this._browserStorage.key(i);
      if (k?.startsWith(CHECKLIST_PREFIX)) {
        names.push(k.slice(CHECKLIST_PREFIX.length));
      }
    }
    return names;
  }

  getChecklistFile(id: string): ChecklistFile | null {
    if (this._browserStorage) {
      let blob = this._browserStorage.getItem(CHECKLIST_PREFIX + id);
      if (blob) {
        return ChecklistFile.fromJsonString(blob);
      }

    }
    return null;
  }

  saveChecklistFile(file: ChecklistFile) {
    if (this._browserStorage) {
      let blob = ChecklistFile.toJsonString(file);
      this._browserStorage.setItem(CHECKLIST_PREFIX + file.name, blob);
    }
  }

  deleteChecklistFile(id: string) {
    if (this._browserStorage) {
      this._browserStorage.removeItem(CHECKLIST_PREFIX + id);
    }
  }

  clear() {
    // Clear only checklist items.
    let ids = this.listChecklistFiles();
    for (const id of ids) {
      this.deleteChecklistFile(id);
    }
  }
}