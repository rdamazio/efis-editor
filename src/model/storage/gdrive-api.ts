/// <reference types="@types/gapi.client.drive-v3" />
/// <reference types="@types/google.accounts"/>
import { afterNextRender, Injectable, Injector } from '@angular/core';
import { environment } from '../../environments/environment';
import { MultipartEncoder } from './multipart';

/**
 * High-level wrapper for the Google Drive API, with a consistent Promise interface.
 */
@Injectable({
  providedIn: 'root',
})
export class GoogleDriveApi {
  private static readonly UPLOAD_API_PATH = '/upload/drive/v3/files';
  private static readonly API_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

  private _loaded = false;

  constructor(private readonly _injector: Injector) {}

  public async load() {
    return new Promise<void>((resolve) => {
      afterNextRender(
        {
          write: () => {
            resolve(this._initApi());
          },
        },
        { injector: this._injector },
      );
    });
  }

  private async _initApi(): Promise<void> {
    return Promise.all([
      this._loadScript('https://accounts.google.com/gsi/client'),
      this._loadScript('https://apis.google.com/js/api.js'),
    ])
      .then(async () => {
        return new Promise<void>((resolve) => {
          gapi.load('client', () => {
            resolve();
          });
        });
      })
      .then(async () => {
        const authInit = new Promise<void>((resolve) => {
          gapi.auth.init(resolve);
        });
        const gDriveLoad = gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
        return Promise.all([authInit, gDriveLoad]);
      })
      .then(() => void 0);
  }

  private async _loadScript(src: string): Promise<void> {
    return new Promise<void>(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => {
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  public async authenticate(): Promise<string> {
    // Based on https://developers.google.com/identity/oauth2/web/guides/use-token-model
    // TODO: Do we need to switch to authorization code model so we don't get frequent refresh popups
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: environment.googleDriveClientId,
        scope: GoogleDriveApi.API_SCOPE,
        include_granted_scopes: true,
        prompt: '',
        callback: (resp: google.accounts.oauth2.TokenResponse) => {
          if (resp.access_token) {
            // google.accounts automatically sets the token in gapi.
            resolve(resp.access_token);
          } else {
            reject(new Error('Failed to get access token: ' + JSON.stringify(resp)));
          }
        },
        error_callback: reject,
      });
      client.requestAccessToken();
    });
  }

  public set accessToken(token: string | undefined) {
    if (token) {
      gapi.auth.setToken({
        access_token: token,
      } as gapi.auth.GoogleApiOAuth2TokenObject);
    } else {
      gapi.auth.setToken(null as unknown as gapi.auth.GoogleApiOAuth2TokenObject);
    }
  }

  public async revokeAccessToken() {
    const token = gapi.auth.getToken();
    if (!token.access_token) return;

    return new Promise<void>((resolve) => {
      google.accounts.oauth2.revoke(token.access_token, resolve);
    });
  }

  public async listFiles(req: {
    mimeType?: string;
    fields?: string;
    orderBy?: string;
  }): Promise<gapi.client.drive.File[]> {
    if (!req.fields) {
      req.fields = 'nextPageToken, files(id, name)';
    } else if (!req.fields.includes('nextPageToken')) {
      req.fields = 'nextPageToken, ' + req.fields;
    }

    const files: gapi.client.drive.File[] = [];
    let nextPageToken: string | undefined;
    do {
      // eslint-disable-next-line no-await-in-loop
      const fileList = await gapi.client.drive.files
        .list({
          spaces: 'appDataFolder',
          q: `mimeType = '${req.mimeType}'`,
          fields: req.fields,
          // This ensures that, if a name collision happens, we take the latest one into account.
          orderBy: req.orderBy,
          pageToken: nextPageToken,
        })
        .then((resp: gapi.client.Response<gapi.client.drive.FileList>) => {
          nextPageToken = resp.result.nextPageToken;
          return resp.result.files;
        });
      if (fileList) {
        files.push(...fileList);
      }
    } while (nextPageToken);

    return files;
  }

  public async downloadFile(fileId: string): Promise<string> {
    return gapi.client.drive.files
      .get({
        fileId: fileId,
        alt: 'media',
      })
      .then((response: gapi.client.Response<gapi.client.drive.File>) => {
        return response.body;
      });
  }

  public async uploadFile(
    name: string,
    existingId: string | undefined,
    mimeType: string,
    mtime: Date,
    contents: string,
  ): Promise<void> {
    if (!existingId) {
      existingId = await gapi.client.drive.files
        .create({
          resource: {
            name: name,
            mimeType: mimeType,
            // Set a modified time in the past so that, if the upload step fails, we try to upload
            // again (instead of keeping the create time which may be newer than the file's local
            // mtime, and would result in us downloading it).
            modifiedTime: '1970-01-01T00:00:00Z',
            parents: ['appDataFolder'],
          },
        })
        .then((resp: gapi.client.Response<gapi.client.drive.File>) => {
          console.debug('GDRIVE: Created file', resp);
          return resp.result.id;
        });
    }

    const metadata: gapi.client.drive.File = {
      modifiedTime: mtime.toISOString(),
      // If file was previously trashed and we're re-uploading it, take it out of the trash.
      trashed: false,
    };

    // We have to use multipart upload so the modified time is kept.
    const multipart = new MultipartEncoder();
    multipart.addPart(JSON.stringify(metadata), { mimeType: 'application/json' });
    multipart.addPart(contents, { mimeType: mimeType, base64encode: true });

    return gapi.client
      .request({
        path: GoogleDriveApi.UPLOAD_API_PATH + '/' + existingId,
        method: 'PATCH',
        headers: {
          'Content-Type': multipart.contentType(),
        },
        params: {
          // We don't need any result fields.
          fields: '',
          uploadType: 'multipart',
        },
        body: multipart.finish(),
      })
      .then((uploaded) => {
        console.debug('GDRIVE: UPLOAD', uploaded);
        return void 0;
      });
  }

  public async trashFile(fileId: string): Promise<void> {
    await gapi.client.drive.files.update({
      fileId: fileId,
      resource: {
        trashed: true,
      },
    });
  }
  public async deleteFile(fileId: string): Promise<void> {
    return gapi.client.drive.files.delete({ fileId: fileId }).then(() => void 0);
  }
}
