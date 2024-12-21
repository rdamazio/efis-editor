import { isPlatformServer } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Hotkey, HotkeysService } from '@ngneat/hotkeys';
import { Observable, Subject, takeUntil } from 'rxjs';
import { HelpComponent } from './help/help.component';

export interface HotkeyRegistree {
  registerHotkeys(service: HotkeyRegistar): void;
}

export class HotkeyRegistar {
  private readonly _destroy$ = new Subject<void>();

  constructor(private readonly _hotkeys: HotkeysService) {}

  addShortcut(options: Hotkey): Observable<KeyboardEvent> {
    return this._hotkeys.addShortcut(options).pipe(takeUntil(this._destroy$));
  }

  addSequenceShortcut(options: Hotkey): Observable<Hotkey> {
    return this._hotkeys.addSequenceShortcut(options).pipe(takeUntil(this._destroy$));
  }

  onDestroy() {
    this._destroy$.next();
    this._destroy$.complete();
  }
}

@Injectable({
  providedIn: 'root',
})
export class HotkeyRegistry {
  private readonly _hotkeyRegistrars = new Map<HotkeyRegistree, HotkeyRegistar>();

  constructor(
    private readonly _dialog: MatDialog,
    private readonly _hotkeys: HotkeysService,
    @Inject(PLATFORM_ID) private readonly _platformId: object,
  ) {
    this._hotkeys.setSequenceDebounce(500);
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
      this._hotkeys.registerHelpModal(() => {
        HelpComponent.toggleHelp(this._dialog);
      });

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

    // TODO: unregister only the shortcuts registered by that specific registree (maybe move to annotating the
    // methods like @HostListener does?).
    this._hotkeys.removeShortcuts(this._hotkeys.getHotkeys().map((hk: Hotkey) => hk.keys));
  }
}
