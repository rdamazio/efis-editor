import { WritableSignal } from '@angular/core';

export interface NavData {
  // Signal that, when written to, will be reflected on the displayed navigation title.
  routeTitle: WritableSignal<string | undefined>;

  // Signal that, when written to, will be reflected as a filename in navigation.
  // Renaming can also happen from the navigation side, and the component is expected
  // to listen for that.
  fileName: WritableSignal<string | undefined>;
}
