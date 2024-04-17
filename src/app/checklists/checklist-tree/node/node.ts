import { Checklist, ChecklistGroup } from '../../../../../gen/ts/checklist';

export interface ChecklistTreeNode {
  isAddNew?: boolean;

  title: string;
  children?: ChecklistTreeNode[];

  group?: ChecklistGroup;
  checklist?: Checklist;
}
