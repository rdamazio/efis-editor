import { Routes } from '@angular/router';
import { WelcomeComponent } from './welcome/welcome.component';

export const routes: Routes = [
  { path: '', component: WelcomeComponent },
  {
    path: 'checklists',
    loadComponent: async () => import('./checklists/checklists.component').then((m) => m.ChecklistsComponent),
  },
];
