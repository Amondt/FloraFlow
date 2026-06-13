import { Component } from '@angular/core';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher';

@Component({
  selector: 'app-auth-page-controls',
  standalone: true,
  imports: [ThemeToggleComponent, LanguageSwitcherComponent],
  templateUrl: './auth-page-controls.html',
})
export class AuthPageControlsComponent {}
