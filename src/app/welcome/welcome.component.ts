import { Component, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { BROWSERS, DeviceDetectorService, DeviceType, OS } from 'ngx-device-detector';
import { FORMAT_REGISTRY } from '../../model/formats/format-registry';

@Component({
  selector: 'app-welcome',
  imports: [MatButtonModule, MatCardModule, RouterLink],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
})
export class WelcomeComponent {
  protected readonly _formatRegistry = FORMAT_REGISTRY;

  public readonly installUrl = computed(() => this._getInstallUrl());

  constructor(private readonly _deviceService: DeviceDetectorService) {}

  private _getInstallUrl(): string {
    const device = this._deviceService.deviceInfo();

    // Detect iPad (including iPadOS desktop mode which acts like a Mac but has touch points)
    if (device.browser === BROWSERS.SAFARI) {
      if (device.os === OS.IOS) {
        if (device.deviceType === (DeviceType.Tablet as string)) {
          return 'https://support.apple.com/en-mide/guide/ipad/ipadc602b75b/ipados';
        } else {
          return 'https://support.apple.com/en-mide/guide/iphone/iph42ab2f3a7/ios';
        }
      } else {
        return 'https://support.apple.com/en-mide/104996';
      }
    } else if (device.browser === BROWSERS.CHROME) {
      return 'https://support.google.com/chrome/answer/9658361';
    } else if (device.browser === BROWSERS.MS_EDGE_CHROMIUM || device.browser === BROWSERS.MS_EDGE) {
      return 'https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux';
    } else {
      return 'https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing';
    }
  }
}
