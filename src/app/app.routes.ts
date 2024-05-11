import { Routes } from '@angular/router';
import { AboutComponent } from './about/about.component';
import { ChecklistsComponent } from './checklists/checklists.component';
import { WelcomeComponent } from './welcome/welcome.component';

export const routes: Routes = [
    { path: '', component: WelcomeComponent },
    { path: 'checklists', component: ChecklistsComponent },
];
