import { isPlatformServer } from '@angular/common';
import { Inject, Injectable, InjectionToken, Optional, PLATFORM_ID } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Hotkey, HotkeysService } from '@ngneat/hotkeys';
import { Observable, Subject, takeUntil } from 'rxjs';
import { HelpComponent } from './help/help.component';

const HELP_KEYS = 'shift.?';

export const HOTKEY_DEBOUNCE_TIME = new InjectionToken<number>('Hotkey sequence debounce time in ms');

export interface HotkeyRegistree {
  registerHotkeys(service: HotkeyRegistar): void;
}

export class HotkeyRegistar {
  private readonly _keys: string[] = [];
  private readonly _destroy$ = new Subject<void>();

  constructor(private readonly _hotkeys: HotkeysService) {}

  addShortcut(options: Hotkey): Observable<KeyboardEvent> {
    this._keys.push(options.keys);
    return this._hotkeys.addShortcut(options).pipe(takeUntil(this._destroy$));
  }

  addSequenceShortcut(options: Hotkey): Observable<Hotkey> {
    this._keys.push(options.keys);
    return this._hotkeys.addSequenceShortcut(options).pipe(takeUntil(this._destroy$));
  }

  onDestroy() {
    this._destroy$.next();
    this._destroy$.complete();

    this._hotkeys.removeShortcuts(this._keys);
  }
}

@Injectable({
  providedIn: 'root',
})
export class HotkeyRegistry {
  private readonly _hotkeyRegistrars = new Map<HotkeyRegistree, HotkeyRegistar>();
  private _helpRegistered = false;

  constructor(
    private readonly _dialog: MatDialog,
    private readonly _hotkeys: HotkeysService,
    @Inject(PLATFORM_ID) private readonly _platformId: object,
    @Inject(HOTKEY_DEBOUNCE_TIME) @Optional() readonly debounceTime?: number,
  ) {
    this._hotkeys.setSequenceDebounce(debounceTime ?? 500);
  }

  registerShortcuts(registree: HotkeyRegistree) {
    // Hotkey registration needs navigator.
    if (isPlatformServer(this._platformId)) return;

    if (this._hotkeyRegistrars.has(registree)) {
      console.warn('Duplicate hotkey registration for ', registree);
      return;
    }

    const registar = new HotkeyRegistar(this._hotkeys);
    this._hotkeyRegistrars.set(registree, registar);

    // Shortcut registration affects global state which then changes the parent NavComponent, so do it off-cycle.
    setTimeout(() => {
      if (!this._helpRegistered) {
        this._hotkeys.registerHelpModal(() => {
          HelpComponent.toggleHelp(this._dialog);
        }, HELP_KEYS);
        this._helpRegistered = true;
      }

      registree.registerHotkeys(registar);
    });
  }

  unregisterShortcuts(registree: HotkeyRegistree) {
    if (isPlatformServer(this._platformId)) return;

    const registrar = this._hotkeyRegistrars.get(registree);
    if (!registrar) {
      console.warn('Attempted to unregister shortcuts for unknown registree: ', registree);
      return;
    }

    registrar.onDestroy();
    this._hotkeyRegistrars.delete(registree);

    // If only the help screen shortcut is left, remove that too.
    const allHotkeys = this._hotkeys.getHotkeys();
    if (allHotkeys.length === 1 && allHotkeys[0].keys === HELP_KEYS) {
      this._hotkeys.removeShortcuts(HELP_KEYS);
      this._helpRegistered = false;
    }
  }
}
