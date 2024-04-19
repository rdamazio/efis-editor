import { Injectable } from "@angular/core";
import { ChecklistFile } from "../../../gen/ts/checklist";

const CHECKLIST_PREFIX = "checklists.";

@Injectable({
  providedIn: 'root'
})
export class ChecklistStorage {
    listChecklistFiles(): string[] {
      let names : string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        let k = localStorage.key(i);
        if (k?.startsWith(CHECKLIST_PREFIX)) {
          names.push(k.slice(CHECKLIST_PREFIX.length));
        }
      }
      return names;
    }

    getChecklistFile(id: string): ChecklistFile {
      let blob = localStorage.getItem(CHECKLIST_PREFIX + id);
      return ChecklistFile.fromJsonString(blob!);
    }

    saveChecklistFile(file: ChecklistFile) {
      let blob = ChecklistFile.toJsonString(file);
      localStorage.setItem(CHECKLIST_PREFIX + file.name, blob);
    }

    deleteChecklistFile(id: string) {
        localStorage.removeItem(CHECKLIST_PREFIX + id);
    }

    clear() {
      // Clear only checklist items.
      let ids = this.listChecklistFiles();
      for (const id of ids) {
        this.deleteChecklistFile(id);
      }
    }
}