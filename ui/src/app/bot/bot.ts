import { Component, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DoCheck } from '@angular/core';

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
export class Bot implements AfterViewChecked, DoCheck {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  isOpen: boolean = false;

  messages: ChatMessage[] = [{ ...WELCOME_MESSAGE }];

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

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) { }

  private previousLength = this.messages.length;

  ngDoCheck(): void {
    if (this.messages.length !== this.previousLength) {
      this.previousLength = this.messages.length;
      // console.log('Messages changed:', this.messages);
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  goHome(): void {
    if (this.isLoading) return;
    this.userMessage = '';
    this.messages = [{ ...WELCOME_MESSAGE }];
  }

  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  quickAction(action: QuickAction): void {
    if (this.isLoading) return;
    this.userMessage = this.quickPrompts[action];
    this.sendMessage();
  }
 translations = {
  en: {
    title: "Insurance Chatbot",
    buyPolicy: "Buy Policy",
    rop: "ROP Submission",
    renew: "Renew Your Policy",
    complaint: "Register a Complaint",
    placeholder: "Type here...",
    welcome:
      "Welcome to ABC Insurance! Your account connection is secure. Please feel free to ask any questions or share your concerns."
  },

  ar: {
    title: "دردشة التأمين",
    buyPolicy: "شراء وثيقة تأمين",
    rop: "تقديم طلب استرداد",
    renew: "تجديد وثيقتك",
    complaint: "تسجيل شكوى",
    placeholder: "اكتب هنا...",
    welcome:
      "مرحباً بك في شركة ABC للتأمين! حسابك متصل بشكل آمن. يمكنك الاستفسار عن وثيقتك أو الفواتير أو تفاصيل التأمين."
  }
};


selectedLanguage: 'en' | 'ar' = 'en';


setLanguage(lang: 'en' | 'ar') {
  this.selectedLanguage = lang;

  this.messages = [
    {
      sender: 'bot',
      text: this.translations[lang].welcome
    }
  ];
}

  sendMessage() {
    const textToSend = this.userMessage.trim();
    if (!textToSend || this.isLoading) return;

    this.messages.push({ sender: 'user', text: textToSend });
    this.userMessage = '';
    this.isLoading = true;

    const payload = {
      message: textToSend,
       language: this.selectedLanguage
      // customerId: Number(this.selectedCustomerId)
    };

    this.http.post<any>('http://localhost:5000/api/chat', payload).subscribe({
      next: (response) => {
        if (response && response.success) {
          this.messages.push({ sender: 'bot', text: response.reply });
          console.log("message", this.messages);
          this.isLoading = false;
          this.cdr.detectChanges();
        } else {
          this.messages.push({ sender: 'bot', text: ' Backend process succeeded, but returned an invalid data payload format.' });
          this.isLoading = false;
          this.cdr.detectChanges();
        }

      },
      error: (err) => {
        console.error('Frontend Connection Failure:', err);
        this.messages.push({
          sender: 'bot',
          text: ' Network Link Offline'
        });
        this.isLoading = false;
      }
    });
  }
}