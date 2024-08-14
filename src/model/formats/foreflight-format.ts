import { ChecklistFile } from '../../../gen/ts/checklist';

import { FormatError } from './error';
import { ForeFlightReader } from './foreflight-reader';
import { ForeFlightWriter } from './foreflight-writer';
import { ForeFlightUtils } from './foreflight-utils';

export class ForeFlightFormatError extends FormatError {
  constructor(message: string, cause?: Error) {
    super(`ForeFlight: ${message}`);
    this.cause = cause;
    this.name = 'ForeFlightFormatError';
  }
}

export class ForeFlightFormat {
  public static async toProto(file: File): Promise<ChecklistFile> {
    return ForeFlightReader.read(file);
  }

  public static async fromProto(file: ChecklistFile): Promise<File> {
    const blob = await ForeFlightWriter.write(file);
    return new File([blob], `${file.metadata!.name}.${ForeFlightUtils.FILE_EXTENSION}`);
  }
}
