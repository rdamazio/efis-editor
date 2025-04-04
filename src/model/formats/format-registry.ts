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
import { GrtFormat } from './grt-format';
import { JsonFormat } from './json-format';
import { PdfFormat } from './pdf-format';
import { TXT_EXTENSION } from './text-format-options';

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
  fileName: 'CHKLST.AFD',
});
FORMAT_REGISTRY.register(DynonFormat, FormatId.DYNON, 'Dynon SkyView™ - no wrap');
FORMAT_REGISTRY.register<DynonFormatOptions>(DynonFormat, FormatId.DYNON31, 'Dynon SkyView™ - 40% / 31 cols.', {
  maxLineLength: 31,
});
FORMAT_REGISTRY.register<DynonFormatOptions>(DynonFormat, FormatId.DYNON40, 'Dynon SkyView™ - 50% / 40 cols.', {
  maxLineLength: 40,
});
FORMAT_REGISTRY.register(ForeFlightFormat, FormatId.FOREFLIGHT, 'Boeing ForeFlight');
FORMAT_REGISTRY.register(GrtFormat, FormatId.GRT, 'Grand Rapids Technologies', {
  supportsImport: true,
  extension: TXT_EXTENSION,
});
FORMAT_REGISTRY.register(JsonFormat, FormatId.JSON, 'Raw data');
FORMAT_REGISTRY.register(PdfFormat, FormatId.PDF, 'Printable PDF', { supportsImport: false });

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

  return Promise.any(formats.map(async (format) => format.toProto(file)));
}
