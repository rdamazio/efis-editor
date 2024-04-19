import { Checklist, ChecklistFile } from "../../../gen/ts/checklist";

const CHECKLIST_PREFIX = "checklists.";

class ChecklistStorage {
    static listChecklistFiles():  string[] {
      let names : string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        let k = localStorage.key(i);
        if (k?.startsWith(CHECKLIST_PREFIX)) {
            names.push(k.slice(CHECKLIST_PREFIX.length));
        }
      }
      return names;
    }

    static getChecklistFile(id: string): ChecklistFile {
      let blob = localStorage.getItem(CHECKLIST_PREFIX + id);
      return ChecklistFile.fromJsonString(blob!);
    }

    static saveChecklistFile(file: ChecklistFile) {
      let blob = ChecklistFile.toJsonString(file);
      localStorage.setItem(CHECKLIST_PREFIX + file.name, blob);
    }

    static deleteChecklistFile(id: string) {
        localStorage.removeItem(CHECKLIST_PREFIX + id);
    }
}