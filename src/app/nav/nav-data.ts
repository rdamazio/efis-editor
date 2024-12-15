import { WritableSignal } from '@angular/core';

export interface NavData {
  // Signal that, when written to, will be reflected on the displayed navigation title.
  routeTitle: WritableSignal<string | undefined>;

  // Signal that, when written to, will be reflected as a filename in navigation.
  fileName: WritableSignal<string | undefined>;
}
