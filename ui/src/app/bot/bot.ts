import { Component, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DoCheck } from '@angular/core';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  uiType?: string;
  actions?: {
    label: string;
    action: string;
  }[];
  showLoginButton?: boolean;
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
  email = '';
  password = '';
  isLogginIn: boolean = false
  customerId: number | null = null;
  pendingQuestion = '';
  showLoginPopup = false;
  // login() {
  //   const body = {
  //     email: this.email,
  //     password: this.password
  //   };
  //   console.log(body);
  //   this.isLogginIn=true
  // }
  login() {

    const body = {
      email: this.email,
      password: this.password
    };

    this.http.post<any>("http://localhost:5000/api/login", body)
      .subscribe({
        next: (res) => {

          if (res.success) {
            this.isLogginIn = true;
            this.customerId = res.customerId;
            this.showLoginPopup = false;
            this.messages.push({
              sender: 'bot',
              text: this.translations.ar.loginSuccess
            });
            if (this.pendingQuestion) {
              this.userMessage = this.pendingQuestion;
              this.pendingQuestion = '';
              setTimeout(() => {
                this.sendMessage();
              }, 500);
            }
          } else {
            this.isLogginIn = false;
            alert(res.message);
          }

        }
      });

  }

  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  isOpen: boolean = false;

  messages: ChatMessage[] = [{ ...WELCOME_MESSAGE }];

  userMessage: string = '';
  // selectedCustomerId: number = 1;
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
      loginSuccess:' Login successful! Retrieving your previous request...',
      loginBtn:'login',
      loginHeader:'Customer Login',
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
      loginSuccess:' تم تسجيل الدخول بنجاح! جاري استرجاع طلبك السابق...',
      loginBtn:'تسجيل الدخول',
      loginHeader:'تسجيل دخول العميل',
      welcome:
        "مرحباً بك في شركة ABC للتأمين! حسابك متصل بشكل آمن. يمكنك الاستفسار عن وثيقتك أو الفواتير أو تفاصيل التأمين."
    }
  };
  private readonly actionMessages = {
    en: {
      POLICY: 'Show my policy',
      CLAIM: 'Show my claim status',
      RENEW_POLICY: 'Renew my policy',
      CLAIM_DOCUMENTS: 'What documents are required for a claim?'
    },

    ar: {
      POLICY: 'اعرض وثيقتي',
      CLAIM: 'اعرض حالة المطالبة',
      RENEW_POLICY: 'أرغب في تجديد وثيقتي',
      CLAIM_DOCUMENTS: 'ما هي المستندات المطلوبة للمطالبة؟'
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
      language: this.selectedLanguage,
      customerId: this.customerId,
      loggedIn: this.isLogginIn
      // customerId: Number(this.selectedCustomerId)
    };

    this.http.post<any>('http://localhost:5000/api/chat', payload).subscribe({
      next: (response) => {
        if (response && response.success) {
          if (response.requiresLogin) {
            this.pendingQuestion = textToSend;
          }
          this.messages.push({ sender: 'bot', text: response.reply, uiType: response.uiType, actions: response.actions, showLoginButton: response.requiresLogin || false });
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
  openLogin() {

    this.showLoginPopup = true;

  }
  onActionClick(action: string) {

    console.log("Button clicked:", action);

    // Flow answers
    if (["HEALTH", "MOTOR", "TRAVEL", "SURGERY", "HOSPITALIZATION", "ACCIDENT", "CONSULTATION", "YES", "NO","BUY_HEALTH","BUY_MOTOR","BUY_TRAVEL","PLAN_BASIC","PLAN_STANDARD","PLAN_PREMIUM"].includes(action)) {

      this.userMessage = action;
      this.sendMessage();
      return;
    }

    // Existing quick actions
    const message =
      this.actionMessages[this.selectedLanguage][
      action as keyof typeof this.actionMessages['en']
      ];

    if (!message) {
      return;
    }

    this.userMessage = message;
    this.sendMessage();
  }
}