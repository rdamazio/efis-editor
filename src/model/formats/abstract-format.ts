import { ChecklistFile } from '../../../gen/ts/checklist';
import { FormatId } from './format-id';

export type FileExtension = string;

export function getFileExtension(fileName: string): FileExtension {
  return fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
}

export interface FormatOptions {
  supportsImport?: boolean;
  extension?: FileExtension;
}

export type FormatConstructor<T extends FormatOptions> = new (
  formatId: FormatId,
  name: string,
  args?: FormatOptions,
) => AbstractChecklistFormat<T>;

export abstract class ExportOptions {}

export abstract class AbstractChecklistFormat<T extends FormatOptions = FormatOptions> {
  public readonly supportsImport: boolean;
  protected readonly _extension?: FileExtension;

  constructor(
    private readonly _formatId: FormatId,
    public readonly name: string,
    args?: T,
  ) {
    this.supportsImport = args?.supportsImport ?? true;
    this._extension = args?.extension;
  }

  public get extension(): FileExtension {
    return this._extension ?? this._formatId;
  }

  public abstract toProto(file: File): Promise<ChecklistFile>;

  public abstract fromProto(file: ChecklistFile, options?: ExportOptions): Promise<File>;
}

export interface OutputFormat {
  id: FormatId;
  name: string;
  supportsImport: boolean;
  extension: FileExtension;
}
