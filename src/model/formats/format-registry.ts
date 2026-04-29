import { ChecklistFile } from '../../../gen/ts/checklist';
import {
  AbstractChecklistFormat,
  ExportOptions,
  FileExtension,
  FormatConstructor,
  FormatOptions,
  getFileExtension,
  OutputFormat,
} from './abstract-format';
import { AceFormat } from './ace-format';
import { DynonFormat, DynonFormatOptions } from './dynon-format';
import { FormatError } from './error';
import { ForeFlightFormat } from './foreflight-format';
import { FormatId } from './format-id';
import { GarminPilotFormat } from './garmin-pilot-format';
import { GrtFormat } from './grt-format';
import { IflyEfbFormat } from './ifly-efb-format';
import { JsonFormat } from './json-format';
import { PdfFormat } from './pdf-format';
import { TXT_EXTENSION } from './text-format-options';
import { TxtFormat } from './txt-format';

class FormatRegistry {
  private readonly _outputFormats = new Map<FormatId, AbstractChecklistFormat>();
  private readonly _inputFormats = new Map<FileExtension, AbstractChecklistFormat[]>();

  public register<T extends FormatOptions>(
    constructor: FormatConstructor<T>,
    formatId: FormatId,
    name: string,
    args?: T,
  ): void {
    if (this._outputFormats.has(formatId)) {
      throw new Error(`Format "${formatId}" already registered`);
    }

    const format = new constructor(formatId, name, args);
    this._outputFormats.set(formatId, format);

    if (format.supportsImport) {
      const registeredFormats = this._inputFormats.get(format.extension);
      if (registeredFormats) {
        registeredFormats.push(format);
      } else {
        this._inputFormats.set(format.extension, [format]);
      }
    }
  }

  public getFormat(formatId: FormatId): AbstractChecklistFormat {
    const format = this._outputFormats.get(formatId);
    if (!format) {
      throw new Error(`Format '${formatId}' not registered`);
    }
    return format;
  }

  public getFormatsByExtension(extension: FileExtension): AbstractChecklistFormat[] {
    return this._inputFormats.get(extension) ?? [];
  }

  public getSupportedInputExtensions(): string {
    return [...this._inputFormats.keys()].sort().join(', ');
  }

  public getSupportedOutputFormats(): OutputFormat[] {
    return [...this._outputFormats.entries()].map(
      ([formatId, format]): OutputFormat => ({
        id: formatId,
        name: format.name,
        extension: format.extension,
        supportsImport: format.supportsImport,
      }),
    );
  }
}

export const FORMAT_REGISTRY = new FormatRegistry();

FORMAT_REGISTRY.register(AceFormat, FormatId.ACE, 'Garmin G3X™/GTN™');
FORMAT_REGISTRY.register<DynonFormatOptions>(DynonFormat, FormatId.AFD, 'Advanced Flight Systems', {
  extension: `.${FormatId.AFD}`,
  fileName: 'CHKLST.AFD',
  maxLineLength: 96,
  forbidCommas: true,
});
FORMAT_REGISTRY.register(DynonFormat, FormatId.DYNON, 'Dynon SkyView™ - no wrap');
FORMAT_REGISTRY.register<DynonFormatOptions>(DynonFormat, FormatId.DYNON31, 'Dynon SkyView™ - 40% / 31 cols.', {
  maxLineLength: 31,
});
FORMAT_REGISTRY.register<DynonFormatOptions>(DynonFormat, FormatId.DYNON40, 'Dynon SkyView™ - 50% / 40 cols.', {
  maxLineLength: 40,
});
FORMAT_REGISTRY.register(ForeFlightFormat, FormatId.FOREFLIGHT, 'Jeppesen ForeFlight');
FORMAT_REGISTRY.register(GarminPilotFormat, FormatId.GARMIN_PILOT, 'Garmin Pilot™');
FORMAT_REGISTRY.register(GrtFormat, FormatId.GRT, 'Grand Rapids Technologies', {
  supportsImport: true,
  extension: TXT_EXTENSION,
});
FORMAT_REGISTRY.register(IflyEfbFormat, FormatId.IFLY_EFB, 'iFly EFB');
FORMAT_REGISTRY.register(JsonFormat, FormatId.JSON, 'Raw data');
FORMAT_REGISTRY.register(PdfFormat, FormatId.PDF, 'Printable PDF', { supportsImport: false });
FORMAT_REGISTRY.register(TxtFormat, FormatId.TXT, 'Plain Text', {
  supportsImport: true,
  extension: TXT_EXTENSION,
});

export async function serializeChecklistFile(
  checklistFile: ChecklistFile,
  formatId: FormatId,
  options?: ExportOptions,
): Promise<File> {
  return FORMAT_REGISTRY.getFormat(formatId).fromProto(checklistFile, options);
}

export async function parseChecklistFile(file: File): Promise<ChecklistFile> {
  const extension = getFileExtension(file.name);
  const formats = FORMAT_REGISTRY.getFormatsByExtension(extension);

  if (!formats.length) {
    return Promise.reject(new FormatError(`Unknown file extension "${extension}".`));
  }

  const errors: Error[] = [];
  for (const format of formats) {
    try {
      return await format.toProto(file);
    } catch (e) {
      // Keep track of failures but proceed to check the next matching format
      errors.push(e as Error);
    }
  }

  throw new AggregateError(errors, `File could not be parsed by any supported format for extension ${extension}.`);
}
