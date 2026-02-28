import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { DeviceDetectorService } from 'ngx-device-detector';
import { BehaviorSubject } from 'rxjs';
import { DriveSyncState, GoogleDriveStorage } from '../../model/storage/gdrive';
import { WelcomeComponent } from './welcome.component';

describe('WelcomeComponent', () => {
  let component: WelcomeComponent;
  let fixture: ComponentFixture<WelcomeComponent>;
  let deviceService: DeviceDetectorService;
  let gdrive: jasmine.SpyObj<GoogleDriveStorage>;
  let state$: BehaviorSubject<DriveSyncState>;

  beforeEach(async () => {
    gdrive = jasmine.createSpyObj<GoogleDriveStorage>('GoogleDriveStorage', ['getState']);
    state$ = new BehaviorSubject<DriveSyncState>(DriveSyncState.DISCONNECTED);
    gdrive.getState.and.returnValue(state$);

    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      providers: [
        {
          provide: GoogleDriveStorage,
          useValue: gdrive,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomeComponent);
    component = fixture.componentInstance;
    deviceService = TestBed.inject(DeviceDetectorService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('showStorageWarning', () => {
    it('should show warning when Google Drive is disconnected', async () => {
      state$.next(DriveSyncState.DISCONNECTED);
      await fixture.whenStable();
      expect(component.showStorageWarning()).toBeTrue();
    });

    it('should not show warning when Google Drive is in sync', async () => {
      state$.next(DriveSyncState.IN_SYNC);
      await fixture.whenStable();
      expect(component.showStorageWarning()).toBeFalse();
    });

    it('should not show warning when Google Drive is syncing', async () => {
      state$.next(DriveSyncState.SYNCING);
      await fixture.whenStable();
      expect(component.showStorageWarning()).toBeFalse();
    });
  });

  describe('installUrl', () => {
    it('should return iPadOS link for iPad user agent', () => {
      deviceService.setDeviceInfo(
        'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
      );
      spyOnProperty(globalThis.navigator, 'maxTouchPoints').and.returnValue(5);
      spyOnProperty(globalThis.navigator, 'platform').and.returnValue('iPad');

      const url = component.installUrl();
      expect(url).toContain('support.apple.com');
      expect(url).toContain('ipados');
      expect(url).not.toContain('ios');
    });

    it('should return iOS link for iPhone user agent', () => {
      deviceService.setDeviceInfo(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
      );

      const url = component.installUrl();
      expect(url).toContain('support.apple.com');
      expect(url).toContain('ios');
      expect(url).not.toContain('ipados');
    });

    it('should return macOS link for Mac Safari', () => {
      deviceService.setDeviceInfo(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15',
      );

      const url = component.installUrl();
      expect(url).toContain('support.apple.com');
      expect(url).not.toContain('ios');
      expect(url).not.toContain('ipados');
    });

    it('should return Chrome link for Chrome on Mac', () => {
      deviceService.setDeviceInfo(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
      );
      expect(component.installUrl()).toContain('support.google.com');
    });

    it('should return Edge link for Edge on Mac', () => {
      deviceService.setDeviceInfo(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Edge/92.0.4515.159 Safari/537.36',
      );
      expect(component.installUrl()).toContain('learn.microsoft.com');
    });

    it('should return MDN link for Firefox on Linux', () => {
      deviceService.setDeviceInfo('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0');
      expect(component.installUrl()).toContain('developer.mozilla.org');
    });
  });
});
