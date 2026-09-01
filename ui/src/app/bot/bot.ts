import { Component, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DoCheck } from '@angular/core';

interface FormField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

interface InsuranceForm {
  name: string;
  fields: FormField[];
}

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  time: Date;
  uiType?: string;
  actions?: {
    label: string;
    action: string;
  }[];
  showLoginButton?: boolean;
  form?: InsuranceForm;
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
interface InsuranceApplication {
  policyType: string;
  plan: string;

  fullName: string;
  civilId: string;
  dateOfBirth: string;
  gender: string;
  mobileNumber: string;
  email: string;

  coverageAmount?: string;
  existingMedicalCondition?: string;
  nationality?: string;
  area?: string;

  vehicleRegistrationNumber?: string;
  vehicleMakeModel?: string;
  manufacturingYear?: string;
  vehicleType?: string;
  insuranceType?: string;
  previousInsurance?: string;
  policyExpiryDate?: string;

  destinationCountry?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  numberOfTravellers?: string;
  travelType?: string;
}

interface HistorySession {
  SESSION_ID: string;
  STARTED_AT: string;
  LAST_MESSAGE_AT: string;
  PREVIEW: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  sender: 'bot',
  text: 'Welcome to ABC Insurance ! 😊. You can get help for these functions as mentioned below.',
  time: new Date()
};

@Component({
  selector: 'app-bot', // Matches your component selector tag
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bot.html',
  styleUrls: ['./bot.scss']
})
export class Bot implements DoCheck {
  userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  email = '';
  password = '';
  isLogginIn: boolean = false;
  customerId: number | null = null;
  pendingQuestion = '';
  showLoginPopup = false;

  // ----- Session / history state -----
  sessionId: string = this.generateSessionId();
  isHistoryOpen: boolean = false;
  historySessions: HistorySession[] = [];
  isLoadingHistory: boolean = false;
  historyError: boolean = false;

  historySearchQuery: string = '';
historyTab: 'all' | 'today' = 'all';

  // ----- Complaint form state -----
  activeForm: 'complaint' | 'agentConnect' | null = null;
  isSubmittingComplaint: boolean = false;
  applicationFormData: any = {};
showRatingModal = false;

selectedRating = 0;

ratingFeedback = "";

isSubmittingRating = false;
hasUserMessaged: boolean = false;

selectRating(rating: number): void {
  this.selectedRating = rating;
}

submitRating(): void {

  if (this.isSubmittingRating) {
    return;
  }

  // Already rated this session — don't hit the API again, just close
  if (this.hasRatedSession) {
    this.showRatingModal = false;
    this.isOpen = false;
    this.selectedRating = 0;
    this.ratingFeedback = '';
    return;
  }

  if (this.selectedRating === 0) {
    alert(
      this.selectedLanguage === 'ar'
        ? 'يرجى اختيار تقييم.'
        : 'Please select a rating.'
    );
    return;
  }

  this.isSubmittingRating = true;

  const payload = {
    customerId: this.customerId ?? null,
    sessionId: this.sessionId,
    rating: Number(this.selectedRating),
    feedback: this.ratingFeedback?.trim() || null,
    language: this.selectedLanguage || 'en'
  };

  this.http.post<any>('http://localhost:5000/api/rating', payload).subscribe({
   next: (response) => {
  console.log('Rating response:', response);
  this.isSubmittingRating = false;

  if (response?.success) {
    this.hasRatedSession = true;
    this.showRatingModal = false;
    // this.isOpen = false;   
    this.selectedRating = 0;
    this.ratingFeedback = '';
    this.cdr.detectChanges();
  }
},
    error: (err) => {
      console.error('Rating submission error:', err);
      this.isSubmittingRating = false;
      const backendMessage =
        err?.error?.message || err?.error?.error || 'Unable to submit rating. Please try again.';
      alert(backendMessage);
      this.cdr.detectChanges();
    }
  });
}

skipRating(): void {
  this.showRatingModal = false;
  this.selectedRating = 0;
  this.ratingFeedback = "";
  // this.isOpen = false;   // REMOVED — keep chat open
}

  complaintForm: ComplaintForm = {
    subject: '',
    fullName: '',
    email: '',
    mobile: '',
    product: '',
    message: ''
  };
  insuranceApplication: InsuranceApplication = {
    policyType: '',
    plan: '',

    fullName: '',
    civilId: '',
    dateOfBirth: '',
    gender: '',
    mobileNumber: '',
    email: '',

    coverageAmount: '',
    existingMedicalCondition: '',
    nationality: '',
    area: '',

    vehicleRegistrationNumber: '',
    vehicleMakeModel: '',
    manufacturingYear: '',
    vehicleType: '',
    insuranceType: '',
    previousInsurance: '',
    policyExpiryDate: ''
    ,
    destinationCountry: '',
    travelStartDate: '',
    travelEndDate: '',
    numberOfTravellers: '',
    travelType: ''
  };

  selectedDocuments: File[] = [];
  isSubmittingInsurance = false;

  complaintProducts: string[] = [
    'Health Insurance',
    'Life Insurance',
    'Motor Insurance',
    'Travel Insurance'
  ];

  // ----- Agent connect state -----
  isConnectingToAgent: boolean = false;
  agentForm = { name: '', email: '', phone: '' };

  openAgentConnectForm(): void {
    this.activeForm = 'agentConnect';
    this.agentForm = { name: '', email: '', phone: '' };
  }

  cancelAgentForm(): void {
    this.activeForm = null;
  }


  get filteredHistorySessions(): HistorySession[] {
  let list = this.historySessions;

  if (this.historyTab === 'today') {
    const today = new Date().toDateString();
    list = list.filter(s => new Date(s.LAST_MESSAGE_AT).toDateString() === today);
  }

  const q = this.historySearchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter(s => (s.PREVIEW || '').toLowerCase().includes(q));
  }

  return list;
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
        if (res && res.success) this.messages.push({ sender: 'bot', text: 'Connecting you to a live chat support agent...', time: new Date() });
        this.cdr.detectChanges();
      },
      error: () => {
        this.isConnectingToAgent = false;
        this.activeForm = null;
        this.cdr.detectChanges();
      }
    });
  }

  // ----- Session helpers -----
  private generateSessionId(): string {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

toggleHistory(): void {
  this.isHistoryOpen = !this.isHistoryOpen;
  if (this.isHistoryOpen && this.isLogginIn && this.customerId) {
    this.historySearchQuery = '';
    this.historyTab = 'all';
    this.fetchHistorySessions();
  }
}

  closeHistory(): void {
    this.isHistoryOpen = false;
  }

  fetchHistorySessions(): void {
    if (!this.customerId) return;
    this.isLoadingHistory = true;
    this.historyError = false;

    this.http.get<any>(`http://localhost:5000/api/history/${this.customerId}`).subscribe({
      next: (res) => {
        this.historySessions = res && res.success ? res.sessions : [];
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Fetch history sessions error:', err);
        this.historyError = true;
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadSession(sessionId: string): void {
    if (!this.customerId || this.isLoading) return;

    this.isLoadingHistory = true;
    this.historyError = false;

    this.http.get<any>(`http://localhost:5000/api/history/${this.customerId}/${sessionId}`).subscribe({
      next: (res) => {
        if (res && res.success) {
          this.messages = [
            { ...WELCOME_MESSAGE },
            ...res.messages.map((m: any) => ({
              sender: (m.ROLE === 'user' ? 'user' : 'bot') as 'user' | 'bot',
              text: m.CONTENT,
              time: new Date(m.CREATED_AT)
            }))
          ];
          this.sessionId = sessionId; // keep appending to this same session
        }
        this.isHistoryOpen = false;
        this.isLoadingHistory = false;
        this.activeForm = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Load session error:', err);
        this.historyError = true;
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ----- Login -----
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
              text: this.translations[this.selectedLanguage].loginSuccess,
              time: new Date()
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

  // Preset prompts behind each quick-action tile (keyed to translation entries)
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
      setTimeout(() => {
        this.scrollToBottom();
      }, 50);
    }
  }

hasRatedSession: boolean = false;

toggleOpen(): void {
  if (!this.isOpen) {
    this.isOpen = true;
    return;
  }

  // No messages sent this session — just close, nothing to rate
  if (!this.hasUserMessaged) {
    this.isOpen = false;
    return;
  }

  this.showRatingModal = true;
}
goHome(): void {
  if (this.isLoading) return;
  this.userMessage = '';
  this.activeForm = null;
  this.isHistoryOpen = false;
  this.messages = [{ ...WELCOME_MESSAGE }];
  this.sessionId = this.generateSessionId();
  this.hasRatedSession = false;
  this.hasUserMessaged = false;  
}

  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  // ----- Complaint form handling -----
  openComplaintForm(): void {
    this.activeForm = 'complaint';
    this.resetComplaintForm();

    this.messages.push({
      sender: 'bot',
      text: this.translations[this.selectedLanguage].complaintIntro,
      time: new Date()
    });
  }

  cancelComplaintForm(): void {
    this.activeForm = null;
    this.resetComplaintForm();
  }

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
            text: this.translations[this.selectedLanguage].complaintSuccess,
            time: new Date()

          });
        } else {
          this.messages.push({
            sender: 'bot',
            text: this.translations[this.selectedLanguage].complaintError,
            time: new Date()
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
          text: this.translations[this.selectedLanguage].complaintError,
          time: new Date()
        });
        this.cdr.detectChanges();
      }
    });
  }

  // ----- Quick action tiles -----
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
      loginSuccess: ' Login successful! Retrieving your previous request...',
      loginBtn: 'Login',
      loginHeader: 'Customer Login',
      welcome:
        "Welcome to ABC Insurance ! 😊. You can get help for these functions as mentioned below.",
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
      quickChat: 'I want to Connect',
      historyTitle: 'Chat History',
      historySignInPrompt: 'Sign in to view and save your chat history.',
      historyEmpty: 'No past conversations yet.',
      historyLoading: 'Loading...',
      historyError: 'Could not load history. Please try again.'
    },

    ar: {
      title: "دردشة التأمين",
      buyPolicy: "شراء وثيقة تأمين",
      rop: "تقديم طلب استرداد",
      renew: "تجديد وثيقتك",
      complaint: "تسجيل شكوى",
      chat: "تحدث معنا",
      placeholder: "اكتب هنا...",
      loginSuccess: ' تم تسجيل الدخول بنجاح! جاري استرجاع طلبك السابق...',
      loginBtn: 'تسجيل الدخول',
      loginHeader: 'تسجيل دخول العميل',
      welcome:
        "مرحباً بكم في شركة ABC للتأمين! 😊 يمكنكم الحصول على المساعدة بشأن الخدمات المدرجة أدناه.",
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
      quickChat: 'أريد التواصل',
      historyTitle: 'سجل المحادثات',
      historySignInPrompt: 'سجّل الدخول لعرض سجل محادثاتك وحفظه.',
      historyEmpty: 'لا توجد محادثات سابقة بعد.',
      historyLoading: 'جارٍ التحميل...',
      historyError: 'تعذر تحميل السجل. يرجى المحاولة مرة أخرى.'
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
        text: this.translations[lang].welcome,
        time: new Date()
      }
    ];
  }

  sendMessage() {
    const textToSend = this.userMessage.trim();
    if (!textToSend || this.isLoading) return;

    this.messages.push({ sender: 'user', text: textToSend, time: new Date() });
      this.hasUserMessaged = true; 
    this.userMessage = '';
    this.isLoading = true;

    const payload = {
      message: textToSend,
      language: this.selectedLanguage,
      customerId: this.customerId,
      loggedIn: this.isLogginIn,
      sessionId: this.sessionId
    };

    this.http.post<any>('http://localhost:5000/api/chat', payload).subscribe({
      next: (response) => {
        if (response && response.success) {
          if (response.requiresLogin) {
            this.pendingQuestion = textToSend;
          }
          this.messages.push({
            sender: 'bot',
            text: response.reply,
            uiType: response.uiType,
            actions: response.actions,
            form: response.form,
            showLoginButton: response.requiresLogin || false,
            time: new Date()

          });
          this.isLoading = false;
          this.cdr.detectChanges();
        } else {
          this.messages.push({ sender: 'bot', text: ' Backend process succeeded, but returned an invalid data payload format.', time: new Date() });
          this.isLoading = false;
          this.cdr.detectChanges();
        }

      },
      error: (err) => {
        console.error('Frontend Connection Failure:', err);
        this.messages.push({
          sender: 'bot',
          text: ' Network Link Offline',
          time: new Date()
        });
        this.isLoading = false;
      }
    });
  }

  openLogin() {
    this.showLoginPopup = true;
    this.isHistoryOpen = false;
  }

  onActionClick(action: string) {

    if (["HEALTH", "MOTOR", "TRAVEL", "SURGERY", "HOSPITALIZATION", "ACCIDENT", "CONSULTATION", "YES", "NO", "BUY_HEALTH", "BUY_MOTOR", "BUY_TRAVEL", "PLAN_BASIC", "PLAN_STANDARD", "PLAN_PREMIUM"].includes(action)) {

      this.userMessage = action;
      this.sendMessage();
      return;
    }

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
  onDocumentsSelected(event: any): void {
    const files: FileList = event.target.files;

    if (!files) {
      return;
    }

    this.selectedDocuments = Array.from(files);
  }
  submitInsuranceApplication(): void {

    this.insuranceApplication = {
      ...this.insuranceApplication,
      ...this.applicationFormData
    };

    if (
      !this.applicationFormData.fullName?.trim() ||
      !this.applicationFormData.civilId?.trim() ||
      !this.applicationFormData.mobileNumber?.trim() ||
      !this.applicationFormData.email?.trim()
    ) {
      alert('Please fill all required fields.');
      return;
    }

    this.isSubmittingInsurance = true;

    const formData = new FormData();

    formData.append(
      'application',
      JSON.stringify(this.insuranceApplication)
    );

    this.selectedDocuments.forEach(file => {
      formData.append('documents', file);
    });

    this.http.post<any>(
      'http://localhost:5000/api/insurance-application',
      formData
    ).subscribe({

      next: (response) => {

        this.isSubmittingInsurance = false;

        if (response.success) {

          this.messages.push({
            sender: 'bot',
            text: 'Your insurance application has been submitted successfully. Our team will review your application and contact you shortly.',
            time: new Date()
          });

          this.insuranceApplication = {
            policyType: '',
            plan: '',
            fullName: '',
            civilId: '',
            dateOfBirth: '',
            gender: '',
            mobileNumber: '',
            email: '',
            coverageAmount: '',
            existingMedicalCondition: '',
            nationality: '',
            area: '',

            vehicleRegistrationNumber: '',
            vehicleMakeModel: '',
            manufacturingYear: '',
            vehicleType: '',
            insuranceType: '',
            previousInsurance: '',
            policyExpiryDate: '',

            destinationCountry: '',
            travelStartDate: '',
            travelEndDate: '',
            numberOfTravellers: '',
            travelType: ''
          };

          this.applicationFormData = {};
          this.selectedDocuments = [];

          this.cdr.detectChanges();
        }

      },

      error: (err) => {

        console.error(
          'Insurance Application Error:',
          err
        );

        this.isSubmittingInsurance = false;

        this.messages.push({
          sender: 'bot',
          text: 'Unable to submit your application. Please try again.',
          time: new Date()
        });

        this.cdr.detectChanges();
      }

    });
  }
}