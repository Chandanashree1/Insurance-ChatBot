import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Bot } from './bot/bot'; 

@Component({
  selector: 'app-root',
  imports: [Bot],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('ui');
}
