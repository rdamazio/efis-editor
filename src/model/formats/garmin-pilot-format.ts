import { ChecklistFile } from '../../../gen/ts/checklist';
import { AbstractChecklistFormat } from './abstract-format';
import { GarminPilotReader } from './garmin-pilot-reader';
import { GarminPilotWriter } from './garmin-pilot-writer';

export class GarminPilotFormat extends AbstractChecklistFormat {
  public async toProto(file: File): Promise<ChecklistFile> {
    return await GarminPilotReader.read(file);
  }

  public async fromProto(file: ChecklistFile): Promise<File> {
    const blob = await new GarminPilotWriter().write(file);
    return new File([blob], `${file.metadata!.name} Checklists${this.extension}`);
  }
}
