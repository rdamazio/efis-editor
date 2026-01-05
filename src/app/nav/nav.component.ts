import { afterNextRender, Component, effect, EventEmitter, Injector, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterOutlet } from '@angular/router';
import { HotkeysService } from '@ngneat/hotkeys';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { MatIconButtonSizesModule } from 'mat-icon-button-sizes';
import { AboutComponent } from '../about/about.component';
import { EditableLabelComponent } from '../shared/editable-label/editable-label.component';
import { GoogleDriveComponent } from '../shared/gdrive/gdrive.component';
import { HelpComponent } from '../shared/hotkeys/help/help.component';
import { NavData } from './nav-data';
import { SearchComponent } from './search/search.component';

@UntilDestroy()
@Component({
  selector: 'app-nav',
  imports: [
    EditableLabelComponent,
    GoogleDriveComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconButtonSizesModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
    RouterLink,
    RouterOutlet,
    SearchComponent,
  ],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss',
})
export class NavComponent {
  readonly navData: NavData = {
    routeTitle: signal(undefined),
    fileName: signal(undefined),

    // Always trigger effect even when value doesn't change
    showSearch: signal(false, { equal: () => false }),
    searchQuery: signal(''),
    searchMatchTotal: signal(2),
    searchMatchCurrent: signal(0),

    searchNext: new EventEmitter<void>(),
    searchPrev: new EventEmitter<void>(),
  };

  readonly searchBox = viewChild<SearchComponent>('searchBox');

  constructor(
    protected _hotkeys: HotkeysService,
    private readonly _dialog: MatDialog,
    private readonly _injector: Injector,
  ) {
    effect(() => {
      if (this.navData.showSearch()) {
        // Wait for the search box to be created.
        afterNextRender(() => this.searchBox()?.focus(), { injector: this._injector });
      } else {
        this.clearSearch();
      }
    });
    this.navData.searchNext.pipe(untilDestroyed(this)).subscribe(() => {
      this.searchBox()?.next();
    });
    this.navData.searchPrev.pipe(untilDestroyed(this)).subscribe(() => {
      this.searchBox()?.prev();
    });
  }

  showAbout() {
    this._dialog.open(AboutComponent, { hasBackdrop: true, enterAnimationDuration: 200, exitAnimationDuration: 200 });
  }

  showKeyboardShortcuts() {
    HelpComponent.toggleHelp(this._dialog);
  }

  clearSearch() {
    this.navData.searchQuery.set('');
    this.navData.searchMatchCurrent.set(0);
    this.navData.searchMatchTotal.set(0);
  }
}
