import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture } from '@angular/core/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { render, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { BehaviorSubject, Subject } from 'rxjs';
import { DriveSyncState, GoogleDriveStorage } from '../../../model/storage/gdrive';
import { GoogleDriveComponent } from './gdrive.component';

describe('GoogleDriveComponent', () => {
  let user: UserEvent;
  let fixture: ComponentFixture<GoogleDriveComponent>;
  let syncButton: HTMLElement;
  let gdrive: jasmine.SpyObj<GoogleDriveStorage>;
  let state$: BehaviorSubject<DriveSyncState>;
  let downloads$: Subject<string>;
  let errors$: Subject<string>;

  beforeEach(async () => {
    user = userEvent.setup();

    gdrive = jasmine.createSpyObj<GoogleDriveStorage>('GoogleDriveStorage', [
      'init',
      'destroy',
      'deleteAllData',
      'getState',
      'synchronize',
      'disableSync',
      'onDownloads',
      'onErrors',
    ]);
    state$ = new BehaviorSubject<DriveSyncState>(DriveSyncState.DISCONNECTED);
    downloads$ = new Subject<string>();
    errors$ = new Subject<string>();
    gdrive.getState.and.returnValue(state$.asObservable());
    gdrive.onDownloads.and.returnValue(downloads$.asObservable());
    gdrive.onErrors.and.returnValue(errors$.asObservable());
    gdrive.init.and.resolveTo();
    gdrive.synchronize.and.resolveTo();

    ({ fixture } = await render(GoogleDriveComponent, {
      providers: [
        {
          provide: GoogleDriveStorage,
          useValue: gdrive,
        },
      ],
    }));

    syncButton = await screen.findByRole('button', { name: 'Synchronize with Google Drive' });
  });

  async function findConnectMenuItem(): Promise<HTMLElement> {
    return screen.findByRole('menuitem', { name: 'Synchronize to Google Drive' });
  }
  async function findDisconnectMenuItem(): Promise<HTMLElement> {
    return screen.findByRole('menuitem', { name: 'Disconnect from Google Drive' });
  }

  it('should start in disconnected state', async () => {
    expect(gdrive.init).toHaveBeenCalledOnceWith();
    expect(gdrive.synchronize).not.toHaveBeenCalled();
    expect(syncButton).toBeVisible();
    expect(syncButton).toBeEnabled();
    expect(screen.getByText('cloud_off')).toBeVisible();

    await user.click(syncButton);
    expect(await findConnectMenuItem()).toBeEnabled();
    expect(await findDisconnectMenuItem()).toBeDisabled();
  });

  it('should not start synchronizing if dialog is cancelled', async () => {
    await user.click(syncButton);
    const connect = await findConnectMenuItem();
    expect(connect).toBeEnabled();
    await user.click(connect);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(gdrive.synchronize).not.toHaveBeenCalled();
  });

  it('should connect when sync requested', async () => {
    await user.click(syncButton);
    const connect = await findConnectMenuItem();
    expect(connect).toBeEnabled();
    await user.click(connect);
    expect(gdrive.synchronize).not.toHaveBeenCalled();

    // Connection dialog should pop up - confirm it.
    expect(await screen.findByText('Google Drive synchronization')).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Synchronize' }));

    expect(gdrive.synchronize).toHaveBeenCalledOnceWith();
  });

  it('should force sync even when connected', async () => {
    state$.next(DriveSyncState.IN_SYNC);

    await user.click(syncButton);
    const connect = await findConnectMenuItem();
    expect(connect).toBeEnabled();
    await user.click(connect);

    expect(gdrive.synchronize).toHaveBeenCalledOnceWith();
  });

  it('should not disconnect if cancelled', async () => {
    state$.next(DriveSyncState.IN_SYNC);
    expect(await screen.findByText('cloud_done')).toBeVisible();

    await user.click(syncButton);
    const disconnect = await findDisconnectMenuItem();
    expect(disconnect).toBeEnabled();

    await user.click(disconnect);

    expect(await screen.findByText('Google Drive synchronization')).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(gdrive.deleteAllData).not.toHaveBeenCalled();
    expect(gdrive.disableSync).not.toHaveBeenCalled();
  });

  it('should disconnect without deleting data', async () => {
    state$.next(DriveSyncState.IN_SYNC);
    expect(await screen.findByText('cloud_done')).toBeVisible();

    await user.click(syncButton);
    const disconnect = await findDisconnectMenuItem();
    expect(disconnect).toBeEnabled();

    await user.click(disconnect);

    expect(await screen.findByText('Google Drive synchronization')).toBeVisible();

    const deleteAllDataCheckbox = await screen.findByRole('checkbox', {
      name: 'Delete all EFIS Editor data from Google Drive',
    });
    expect(deleteAllDataCheckbox).not.toBeChecked();
    await user.click(await screen.findByRole('button', { name: 'Stop synchronization' }));

    expect(gdrive.deleteAllData).not.toHaveBeenCalled();
    expect(gdrive.disableSync).toHaveBeenCalledOnceWith(true);
  });

  it('should disconnect and delete data', async () => {
    state$.next(DriveSyncState.IN_SYNC);
    expect(await screen.findByText('cloud_done')).toBeVisible();

    await user.click(syncButton);
    const disconnect = await findDisconnectMenuItem();
    expect(disconnect).toBeEnabled();

    await user.click(disconnect);

    expect(await screen.findByText('Google Drive synchronization')).toBeVisible();

    const deleteAllDataCheckbox = await screen.findByRole('checkbox', {
      name: 'Delete all EFIS Editor data from Google Drive',
    });
    await user.click(deleteAllDataCheckbox);
    expect(deleteAllDataCheckbox).toBeChecked();

    await user.click(await screen.findByRole('button', { name: 'Stop synchronization' }));

    expect(gdrive.deleteAllData).toHaveBeenCalledOnceWith();
    expect(gdrive.disableSync).toHaveBeenCalledOnceWith(true);
  });

  it('should render all states properly', async () => {
    expect(screen.getByText('cloud_off')).toBeVisible();
    expect(syncButton).toBeEnabled();
    await user.click(syncButton);
    expect(await findConnectMenuItem()).toBeEnabled();
    expect(await findDisconnectMenuItem()).toBeDisabled();
    await user.click(syncButton);

    state$.next(DriveSyncState.SYNCING);
    expect(await screen.findByText('cloud_sync')).toBeVisible();
    expect(syncButton).toBeDisabled();

    state$.next(DriveSyncState.NEEDS_SYNC);
    expect(await screen.findByText('cloud_upload')).toBeVisible();
    expect(syncButton).toBeEnabled();
    await user.click(syncButton);
    expect(await findConnectMenuItem()).toBeEnabled();
    expect(await findDisconnectMenuItem()).toBeEnabled();
    await user.click(syncButton);

    state$.next(DriveSyncState.IN_SYNC);
    expect(await screen.findByText('cloud_done')).toBeVisible();
    expect(syncButton).toBeEnabled();
    await user.click(syncButton);
    expect(await findConnectMenuItem()).toBeEnabled();
    expect(await findDisconnectMenuItem()).toBeEnabled();
    await user.click(syncButton);

    state$.next(DriveSyncState.FAILED);
    expect(await screen.findByText('cloud_alert')).toBeVisible();
    expect(syncButton).toBeEnabled();
    await user.click(syncButton);
    expect(await findConnectMenuItem()).toBeEnabled();
    expect(await findDisconnectMenuItem()).toBeEnabled();
    await user.click(syncButton);
  });

  it('should display sync errors', async () => {
    const loader = TestbedHarnessEnvironment.documentRootLoader(fixture);

    errors$.next('Oopsie');
    expect(await screen.findByText('Oopsie')).toBeVisible();

    const snackBars = await loader.getAllHarnesses(MatSnackBarHarness);
    expect(snackBars).toHaveSize(1);
    const snackBar = snackBars[0];
    expect(await snackBar.getMessage()).toEqual('Oopsie');
    expect(gdrive.synchronize).not.toHaveBeenCalled();

    await snackBar.dismissWithAction();
    expect(gdrive.synchronize).toHaveBeenCalledOnceWith();
  });
});
