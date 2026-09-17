import { Component, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NgIf } from '@angular/common';
import { Bot } from './bot/bot';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [Bot, RouterOutlet, NgIf],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('ui');

  showWidget = true;

  constructor(private router: Router) {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.showWidget = !e.urlAfterRedirects.startsWith('/policy-success');
      });
  }
}