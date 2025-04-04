import { ChecklistFile } from '../../../gen/ts/checklist';
import { FormatId } from './format-id';

// https://github.com/microsoft/TypeScript/issues/44268
function toLowerCase<T extends string>(str: T) {
  return str.toLowerCase() as Lowercase<T>;
}

export type FileExtension = `.${Lowercase<string>}`;

export function getFileExtension(fileName: string): FileExtension {
  return `.${toLowerCase(fileName.slice(fileName.lastIndexOf('.') + 1))}`;
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
    return this._extension ?? `.${this._formatId}`;
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
