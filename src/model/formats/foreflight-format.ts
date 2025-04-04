import { ChecklistFile } from '../../../gen/ts/checklist';

import { FormatError } from './error';
import { ForeFlightReader } from './foreflight-reader';
import { ForeFlightWriter } from './foreflight-writer';

import { AbstractChecklistFormat } from './abstract-format';

export class ForeFlightFormatError extends FormatError {
  constructor(message: string, cause?: Error) {
    super(`ForeFlight: ${message}`);
    this.cause = cause;
    this.name = 'ForeFlightFormatError';
  }
}

/**
 * Mapping strategy between EFIS and ForeFlight items:
 *
 *   - Challenge/response
 *     * "Check Item" w/ title and detail
 *   - Challenge
 *     * "Check Item" w/ title
 *   - Title
 *     * "Detail Item" w/ title and w/o detail
 *   - Blank row
 *     * "Detail Item" w/o any data
 *     * Better than "Check Item" because it does not need to be checked
 *
 *   - Text
 *   - Note
 *   - Warning
 *   - Caution
 *     * If unindented, then stand-alone "Detail Item" w/o title and w/ detail
 *     * If indented, then attached to the previous "Check/Detail Item" (note or detail)
 *
 *   Multiline ForeFlight notes are expanded as multiple indented text elements.
 */
export class ForeFlightFormat extends AbstractChecklistFormat {
  public async toProto(file: File): Promise<ChecklistFile> {
    return ForeFlightReader.read(file);
  }

  public async fromProto(file: ChecklistFile): Promise<File> {
    const blob = await ForeFlightWriter.write(file);
    return new File([blob], `${file.metadata!.name}${this.extension}`);
  }
}
