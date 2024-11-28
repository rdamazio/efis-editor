import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { ForeFlightUtils } from '../../model/formats/foreflight-utils';

@Component({
  selector: 'app-welcome',
  imports: [MatButtonModule, MatCardModule, RouterLink],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
})
export class WelcomeComponent {
  readonly ffUtils = ForeFlightUtils;
}
