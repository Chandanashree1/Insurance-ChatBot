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

type QuickAction = 'buyPolicy' | 'rop' | 'renew' | 'complaint' | 'chatWithUs';

interface ComplaintForm {
  subject: string;
  fullName: string;
  email: string;
  mobile: string;
  product: string;
  message: string;
}

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
  isLogginIn: boolean = false;

  activeForm: 'complaint' | 'agentConnect' | null = null;
  isConnectingToAgent: boolean = false;
  agentForm = { name: '', email: '', phone: '' };

  openAgentConnectForm(): void {
    this.activeForm = 'agentConnect';
    this.agentForm = { name: '', email: '', phone: '' };
  }

  cancelAgentForm(): void {
    this.activeForm = null;
  }

  submitAgentConnect(): void {
    const f = this.agentForm;
    if (!f.name || !f.email || !f.phone) {
      alert('Please fill out all required fields.');
      return;
    }
    this.isConnectingToAgent = true;
    this.http.post<any>('http://localhost:5000/api/agent-connect', { ...f, phone: '+968' + f.phone, language: this.selectedLanguage }).subscribe({
      next: (res) => {
        this.isConnectingToAgent = false;
        this.activeForm = null;
        if (res && res.success) this.messages.push({ sender: 'bot', text: 'Connecting you to a live chat support agent...' });
        this.cdr.detectChanges();
      },
      error: () => {
        this.isConnectingToAgent = false;
        this.activeForm = null;
        this.cdr.detectChanges();
      }
    });
  }



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
            this.cdr.detectChanges();
            console.log("Customer Id :", res.customerId);

          } else {
            this.isLogginIn = false;
            alert(res.message);

          }

        }
      });

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

  // activeForm: 'complaint' | null = null;
  isSubmittingComplaint: boolean = false;

  complaintForm: ComplaintForm = {
    subject: '',
    fullName: '',
    email: '',
    mobile: '',
    product: '',
    message: ''
  };

  complaintProducts: string[] = [
    'Health Insurance',
    'Life Insurance',
    'Motor Insurance',
    'Travel Insurance'
  ];

  // Preset prompts behind each quick-action tile
  private readonly quickPrompts: Record<QuickAction, string> = {
    buyPolicy: 'quickBuyPolicy',
    rop: 'quickRop',
    renew: 'quickRenew',
    complaint: 'quickComplaint',
    chatWithUs: 'quickChat'

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
      setTimeout(() => {
        this.scrollToBottom();
      }, 50);
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
    this.activeForm = null;
    this.messages = [{ ...WELCOME_MESSAGE }];
  }

  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  openComplaintForm(): void {
    this.activeForm = 'complaint';
    this.resetComplaintForm();
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

    this.messages.push({
      sender: 'bot',
      text: this.translations[this.selectedLanguage].complaintIntro
    });
  }

  cancelComplaintForm(): void {
    this.activeForm = null;
    this.resetComplaintForm();
  }
  selectedLanguage: 'en' | 'ar' = 'en';

  private resetComplaintForm(): void {
    this.complaintForm = {
      subject: '',
      fullName: '',
      email: '',
      mobile: '',
      product: '',
      message: ''
    };
  }

  submitComplaint(): void {
    const f = this.complaintForm;

    if (!f.subject || !f.fullName || !f.email || !f.mobile || !f.product || !f.message) {
      alert(
        this.selectedLanguage === 'ar'
          ? 'يرجى تعبئة جميع الحقول المطلوبة.'
          : 'Please fill out all required fields.'
      );
      return;
    }

    this.isSubmittingComplaint = true;

    const payload = {
      subject: f.subject,
      fullName: f.fullName,
      email: f.email,
      mobile: f.mobile,
      product: f.product,
      message: f.message,
      language: this.selectedLanguage
    };

    this.http.post<any>('http://localhost:5000/api/complaint', payload).subscribe({
      next: (response) => {
        this.isSubmittingComplaint = false;
        this.activeForm = null;

        if (response && response.success) {
          this.messages.push({
            sender: 'bot',
            text: this.translations[this.selectedLanguage].complaintSuccess
          });
        } else {
          this.messages.push({
            sender: 'bot',
            text: this.translations[this.selectedLanguage].complaintError
          });
        }

        this.resetComplaintForm();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Complaint Submission Failure:', err);
        this.isSubmittingComplaint = false;
        this.messages.push({
          sender: 'bot',
          text: this.translations[this.selectedLanguage].complaintError
        });
        this.cdr.detectChanges();
      }
    });
  }

 quickAction(action: QuickAction): void {
  if (this.isLoading) return;

  if (action === 'complaint') {
    this.openComplaintForm();
    return;
  }

  if (action === 'chatWithUs') {
    this.openAgentConnectForm();
    return;
  }

  const key = this.quickPrompts[action] as keyof typeof this.translations['en'];
  this.userMessage = this.translations[this.selectedLanguage][key];
  this.sendMessage();
}

  translations = {
    en: {
      title: "Insurance Chatbot",
      buyPolicy: "Buy Policy",
      rop: "ROP Submission",
      renew: "Renew Your Policy",
      complaint: "Register a Complaint",
      chat: "Chat with Us",
      placeholder: "Type here...",
      welcome:
        "Welcome to ABC Insurance! Your account connection is secure. Please feel free to ask any questions or share your concerns.",
      complaintIntro: "Please fill out the form and submit your details.",
      complaintFormTitle: "Register a Complaint",
      subject: "Subject",
      fullName: "Full Name",
      emailId: "Email Id",
      mobileNumber: "Mobile Number",
      product: "Product",
      productPlaceholder: "Select one of the following",
      complaintMessage: "Complaint Message",
      cancel: "Cancel",
      submit: "Submit",
      complaintSuccess: "Your complaint has been submitted successfully. Our team will get back to you shortly.",
      complaintError: "Something went wrong while submitting your complaint. Please try again.",
      agentTitle: "Connect with Agent",
      agentSubtitle: "Please fill in these details to connect to our agent",
      namePlaceholder: "Enter your Name*",
      emailPlaceholder: "Enter Email-ID*",
      phonePlaceholder: "Enter Phone Number*",
      connecting: "Connecting you to a live chat support agent...",
      quickBuyPolicy: 'I want to buy a new policy',
      quickRop: 'I want to submit ROP',
      quickRenew: 'I want to renew my policy',
      quickComplaint: 'I want to register a complaint',
      quickChat: 'I want to Connect'
    },

    ar: {
      title: "دردشة التأمين",
      buyPolicy: "شراء وثيقة تأمين",
      rop: "تقديم طلب استرداد",
      renew: "تجديد وثيقتك",
      complaint: "تسجيل شكوى",
      chat: "تحدث معنا",
      placeholder: "اكتب هنا...",
      welcome:
        "مرحباً بك في شركة ABC للتأمين! حسابك متصل بشكل آمن. يمكنك الاستفسار عن وثيقتك أو الفواتير أو تفاصيل التأمين.",
      complaintIntro: "يرجى تعبئة النموذج وإرسال بياناتك.",
      complaintFormTitle: "تسجيل شكوى",
      subject: "الموضوع",
      fullName: "الاسم الكامل",
      emailId: "البريد الإلكتروني",
      mobileNumber: "رقم الجوال",
      product: "المنتج",
      productPlaceholder: "اختر أحد الخيارات التالية",
      complaintMessage: "تفاصيل الشكوى",
      cancel: "إلغاء",
      submit: "إرسال",
      complaintSuccess: "تم إرسال شكواك بنجاح. سيتواصل معك فريقنا قريباً.",
      complaintError: "حدث خطأ أثناء إرسال شكواك. يرجى المحاولة مرة أخرى.",
      agentTitle: "التواصل مع الوكيل",
      agentSubtitle: "يرجى تعبئة هذه البيانات للتواصل مع وكيلنا",
      namePlaceholder: "أدخل اسمك*",
      emailPlaceholder: "أدخل البريد الإلكتروني*",
      phonePlaceholder: "أدخل رقم الهاتف*",
      connecting: "جارٍ تحويلك إلى وكيل الدعم المباشر...",
      quickBuyPolicy: 'أريد شراء وثيقة تأمين جديدة',
      quickRop: 'أريد تقديم طلب استرداد',
      quickRenew: 'أريد تجديد وثيقتي',
      quickComplaint: 'أريد تسجيل شكوى',
      quickChat: 'أريد التواصل'

    }
  };

  selectedLanguage: 'en' | 'ar' = 'en';

  setLanguage(lang: 'en' | 'ar') {
    this.selectedLanguage = lang;

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