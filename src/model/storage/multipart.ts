const CRLF = '\r\n';
const DASHES = '--';

export interface PartOptions {
  mimeType: string;
  base64encode?: boolean;
}

/**
 * Encoder for multipart/mixed payloads.
 *
 * This encodes upload parts (metadata and contents) for gDrive uploads.
 * While FormData (multipart/form-data) can technically be used, it does not
 * seem that MIME types specified with that are respected by the servers,
 * plus there's no way to control content encoding with it - hence the need for
 * this implementation.
 */
export class MultipartEncoder {
  private readonly _boundary: string;
  private _output: string = CRLF;

  constructor(boundary?: string) {
    if (boundary) {
      this._boundary = boundary;
    } else {
      this._boundary = '';
      for (let i = 0; i < 40; i++) {
        this._boundary += Math.floor(Math.random() * 36).toString(36);
      }
    }
  }

  public addPart(contents: string, options?: Partial<PartOptions>) {
    this._addBoundary();
    this._output += CRLF;

    if (options?.mimeType) {
      this._addHeader('Content-Type', options.mimeType);
    }
    if (options?.base64encode) {
      contents = btoa(contents);
      this._addHeader('Content-Transfer-Encoding', 'base64');
    }

    this._output += CRLF;
    this._output += contents;
    this._output += CRLF;
  }

  public contentType(): string {
    return `multipart/mixed; boundary=${this._boundary}`;
  }

  public finish(): string {
    if (!this._output.endsWith(DASHES)) {
      this._addBoundary();
      this._output += DASHES;
    }

    return this._output;
  }

  private _addHeader(name: string, value?: string) {
    this._output += name;
    if (value) {
      this._output += ': ';
      this._output += value;
    }
    this._output += CRLF;
  }

  private _addBoundary() {
    this._output += DASHES;
    this._output += this._boundary;
  }
}
