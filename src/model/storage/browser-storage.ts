import { Injectable, afterNextRender } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LazyBrowserStorage {
  public readonly storage: Promise<Storage>;
  private _storageResolveFunc?: () => void;

  constructor() {
    this.storage = new Promise<Storage>((resolve, reject) => {
      this._storageResolveFunc = () => {
        if (Object.prototype.hasOwnProperty.call(global, 'localStorage')) {
          console.log('Initialized local storage');
          resolve(localStorage);
        } else {
          console.log('No local storage!!');
          reject(new Error('No local storage found'));
        }
      };

      afterNextRender({
        read: () => {
          setTimeout(() => {
            this._storageResolveFunc!();
          });
        },
      });
    });
  }

  // For testing only.
  forceBrowserStorage() {
    this._storageResolveFunc!();
  }
}
