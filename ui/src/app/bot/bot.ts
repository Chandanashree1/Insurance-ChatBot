import { Component, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

type QuickAction = 'buyPolicy' | 'rop' | 'renew' | 'complaint';

const WELCOME_MESSAGE: ChatMessage = {
  sender: 'bot',
  text: 'Welcome to ABC Insurance! Your account connection is fully secured. Please feel free to ask about your policy layout, billing statements, or premium parameters.'
};

@Component({
  selector: 'app-bot', // Matches your component selector tag
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bot.html',
  styleUrls: ['./bot.scss']
})
export class Bot implements AfterViewChecked {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  isOpen: boolean = false;

  messages: ChatMessage[] = [ { ...WELCOME_MESSAGE } ];
  userMessage: string = '';
  selectedCustomerId: number = 1;
  isLoading: boolean = false;

  // Preset prompts behind each quick-action tile
  private readonly quickPrompts: Record<QuickAction, string> = {
    buyPolicy: 'I want to buy a new policy',
    rop: 'I want to submit ROP',
    renew: 'I want to renew my policy',
    complaint: 'I want to register a complaint'
  };

  constructor(private http: HttpClient) {}

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  goHome(): void {
    if (this.isLoading) return;
    this.userMessage = '';
    this.messages = [ { ...WELCOME_MESSAGE } ];
  }

  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  quickAction(action: QuickAction): void {
    if (this.isLoading) return;
    this.userMessage = this.quickPrompts[action];
    this.sendMessage();
  }

  sendMessage() {
    const textToSend = this.userMessage.trim();
    if (!textToSend || this.isLoading) return;

    this.messages.push({ sender: 'user', text: textToSend });
    this.userMessage = '';
    this.isLoading = true;

    const payload = {
      message: textToSend,
      customerId: Number(this.selectedCustomerId)
    };

    this.http.post<any>('http://localhost:5000/api/chat', payload).subscribe({
      next: (response) => {
        if (response && response.success) {
          this.messages.push({ sender: 'bot', text: response.reply });
        } else {
          this.messages.push({ sender: 'bot', text: ' Backend process succeeded, but returned an invalid data payload format.' });
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Frontend Connection Failure:', err);
        this.messages.push({
          sender: 'bot',
          text: ' Network Link Offline: The Angular UI cannot access port 5000. Ensure "node server.js" is running in your backend terminal.'
        });
        this.isLoading = false;
      }
    });
  }
}