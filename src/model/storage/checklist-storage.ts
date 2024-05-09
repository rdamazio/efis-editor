import { AfterRenderPhase, ApplicationRef, ChangeDetectorRef, Injectable, afterNextRender } from "@angular/core";
import { ChecklistFile } from "../../../gen/ts/checklist";

const CHECKLIST_PREFIX = "checklists:";

@Injectable({
  providedIn: 'root'
})
export class ChecklistStorage {
  private _browserStorage: any;

  constructor() {
    afterNextRender(() => {
      setTimeout(() => {
        this._browserStorage = localStorage;
      });
    }, { phase: AfterRenderPhase.Read });
  }

  listChecklistFiles(): string[] {
    if (!this._browserStorage) {
      return [];
    }

    const names: string[] = [];
    for (let i = 0; i < this._browserStorage.length; i++) {
      const k = this._browserStorage.key(i);
      if (k?.startsWith(CHECKLIST_PREFIX)) {
        names.push(k.slice(CHECKLIST_PREFIX.length));
      }
    }
    return names;
  }

  getChecklistFile(id: string): ChecklistFile | null {
    if (this._browserStorage) {
      const blob = this._browserStorage.getItem(CHECKLIST_PREFIX + id);
      if (blob) {
        return ChecklistFile.fromJsonString(blob);
      }

    }
    return null;
  }

  saveChecklistFile(file: ChecklistFile) {
    if (this._browserStorage) {
      if (!file.metadata?.name) {
        throw new Error('Must specify checklist file name in metadata.');
      }
      const blob = ChecklistFile.toJsonString(file);
      this._browserStorage.setItem(CHECKLIST_PREFIX + file.metadata.name, blob);
    }
  }

  deleteChecklistFile(id: string) {
    if (this._browserStorage) {
      this._browserStorage.removeItem(CHECKLIST_PREFIX + id);
    }
  }

  clear() {
    // Clear only checklist items.
    const ids = this.listChecklistFiles();
    for (const id of ids) {
      this.deleteChecklistFile(id);
    }
  }
}