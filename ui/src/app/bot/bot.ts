import { Component, ViewChild, ElementRef, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DoCheck } from '@angular/core';
import { BuyPolicyChatComponent } from '../buy_policy/buy_policy.ts.component';

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
  imports: [CommonModule, FormsModule, BuyPolicyChatComponent],
  templateUrl: './bot.html',
  styleUrls: ['./bot.scss']
})
export class Bot implements DoCheck, OnInit {
  userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  email = '';
  password = '';
  isLogginIn: boolean = false;
  isLoggingIn: boolean = false;
  customerId: number | null = null;
  pendingQuestion = '';
  showLoginPopup = false;
  showSignupPopup = false;

  // ----- Auth mode -----
  authMode: 'login' | 'signup' = 'login';

  signupName = '';
  signupEmail = '';
  signupPassword = '';
  signupConfirmPassword = '';
  isSigningUp = false;

  switchToSignup(): void {
    this.authMode = 'signup';
    this.signupEmail = this.email;
    this.signupName = '';
    this.signupPassword = '';
    this.signupConfirmPassword = '';
  }

  ngOnInit(): void {
    this.restoreLoginState();
    const shouldRestore = sessionStorage.getItem('restoreChatOnLoad') === 'true';
    const setAt = Number(sessionStorage.getItem('restoreChatOnLoadTime') || 0);
    const isFresh = shouldRestore && (Date.now() - setAt) < 30000; // only trust a flag set in the last 30s

    if (isFresh) {
      this.isOpen = true;   // auto-open the widget instead of showing the collapsed launcher
      this.hasUserMessaged = true;

      this.messages.push({
        sender: 'bot',
        text: '',
        uiType: 'BUY_POLICY_FORM',
        time: new Date()
      });
    }
  }

  switchToLogin(): void {
    this.authMode = 'login';
  }
  signup(): void {
    if (!this.signupName || !this.signupEmail || !this.signupPassword || !this.signupConfirmPassword) {
      alert(this.selectedLanguage === 'ar' ? 'يرجى تعبئة جميع الحقول.' : 'Please fill all fields.');
      return;
    }

    if (this.signupPassword !== this.signupConfirmPassword) {
      alert(this.selectedLanguage === 'ar' ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      return;
    }

    this.isSigningUp = true;

    const body = {
      name: this.signupName,
      email: this.signupEmail,
      password: this.signupPassword
    };

    this.http.post<any>('http://localhost:5000/api/signup', body).subscribe({
      next: (res) => {
        this.isSigningUp = false;

        if (res.success) {
          this.isLogginIn = true;
          this.customerId = res.customerId;
          this.saveLoginState();
          this.showSignupPopup = false;

          this.messages.push({
            sender: 'bot',
            text: this.translations[this.selectedLanguage].loginSuccess,
            time: new Date()
          });

          if (this.pendingQuestion) {
            this.userMessage = this.pendingQuestion;
            this.pendingQuestion = '';
            setTimeout(() => this.sendMessage(), 500);
          }
        } else if (res.userExists) {
          alert(res.message || 'Account already exists. Please sign in.');
          this.email = this.signupEmail;
          this.openLogin(this.authReturnTo);
        } else {
          alert(res.message || 'Signup failed. Please try again.');
        }
      },
      error: (err) => {
        this.isSigningUp = false;
        console.error('Signup error:', err);
        alert('Something went wrong. Please try again.');
      }
    });
  }

  // ----- Session / history state -----
  sessionId: string = this.generateSessionId();
  isHistoryOpen: boolean = false;
  historySessions: HistorySession[] = [];
  isLoadingHistory: boolean = false;
  historyError: boolean = false;

  historySearchQuery: string = '';
  historyTab: 'all' | 'today' = 'all';

  // ----- Support Center -----
  isSupportCenterOpen: boolean = false;

isMyComplaintsOpen: boolean = false;

isCheckStatusOpen: boolean = false;
statusQuoteNumber: string = '';
statusResult: any = null;
statusLookupError: string = '';
isLookingUpStatus: boolean = false;

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


// ===============================
// CHECK STATUS
// ===============================

openCheckStatus(): void {
  this.isSupportCenterOpen = false;
  this.isHistoryOpen = false;
  this.isMyComplaintsOpen = false;
  this.isCheckStatusOpen = true;

  this.statusQuoteNumber = '';
  this.statusResult = null;
  this.statusLookupError = '';
}

goBackFromCheckStatus(): void {
  this.isCheckStatusOpen = false;
  this.isSupportCenterOpen = true;
}

lookupProposalStatus(): void {
  const quoteNumber = this.statusQuoteNumber.trim();

  if (!quoteNumber) {
    this.statusLookupError = 'Please enter your quote number.';
    return;
  }

  this.isLookingUpStatus = true;
  this.statusLookupError = '';
  this.statusResult = null;

  this.http.get<any>(`http://localhost:5000/api/proposals/quote-number/${quoteNumber}`).subscribe({
    next: (res) => {
      this.isLookingUpStatus = false;

      if (res.success) {
        this.statusResult = res.data;
      } else {
        this.statusLookupError = res.message || 'Could not find a proposal for this quote number.';
      }

      this.cdr.detectChanges();   // ← MUST be here
    },
    error: (err) => {
      this.isLookingUpStatus = false;
      this.statusLookupError = err?.error?.message || 'No proposal found for this quote number.';
      this.cdr.detectChanges();   // ← MUST be here too
    }
  });
}

resetStatusLookup(): void {
  this.statusQuoteNumber = '';
  this.statusResult = null;
  this.statusLookupError = '';
}


  submitRating(): void {

    if (this.isSubmittingRating) {
      return;
    }

    if (this.hasRatedSession) {
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

    const rating = Number(this.selectedRating);
    const feedback = this.ratingFeedback?.trim() || '';

    const payload = {
      customerId: this.customerId ?? null,
      sessionId: this.sessionId,
      rating,
      feedback: feedback || null,
      language: this.selectedLanguage || 'en'
    };

    this.http.post<any>(
      'http://localhost:5000/api/rating',
      payload
    ).subscribe({

      next: (response) => {

        console.log('Rating response:', response);

        this.isSubmittingRating = false;

        if (!response?.success) {
          alert(
            this.selectedLanguage === 'ar'
              ? 'تعذر إرسال التقييم.'
              : 'Unable to submit rating.'
          );
          return;
        }

        // ------------------------------------
        // Mark current session as rated
        // ------------------------------------
        this.hasRatedSession = true;

        // ------------------------------------
        // Close rating modal
        // ------------------------------------
        this.showRatingModal = false;

        // ------------------------------------
        // Show feedback inside chat
        // ------------------------------------
        const stars = '⭐'.repeat(rating);

        this.messages.push({
          sender: 'user',
          text: feedback
            ? `${stars} ${rating}/5\n${feedback}`
            : `${stars} ${rating}/5`,
          time: new Date()
        });

        // ------------------------------------
        // Bot thank-you message
        // ------------------------------------
        const followUpMessage =
          this.selectedLanguage === 'ar'
            ? 'نأسف لأن تجربتك لم تكن مرضية. سيقوم أحد وكلائنا بمتابعة ملاحظاتك ومساعدتك قريبًا.'
            : 'Sorry to hear that. An agent will follow up with you soon.';

        const thankYouMessage =
          this.selectedLanguage === 'ar'
            ? 'شكرًا لك على ملاحظاتك وتقييمك. نحن نقدر ملاحظاتك.'
            : 'Thank you for your feedback and rating.';

        const messageToShow =
          response.followUpRequired === true
            ? followUpMessage
            : thankYouMessage;

        this.messages.push({
          sender: 'bot',
          text: messageToShow,
          time: new Date()
        });

        // ------------------------------------
        // Reset rating fields
        // ------------------------------------
        this.selectedRating = 0;
        this.ratingFeedback = '';

        this.cdr.detectChanges();

        // ------------------------------------
        // Wait so user can see thank-you
        // Then start a fresh chat
        // ------------------------------------
        setTimeout(() => {
          this.startFreshChat();
        }, 2500);
      },

      error: (err) => {

        console.error(
          'Rating submission error:',
          err
        );

        this.isSubmittingRating = false;

        const backendMessage =
          err?.error?.message ||
          err?.error?.error ||
          (
            this.selectedLanguage === 'ar'
              ? 'تعذر إرسال التقييم. يرجى المحاولة مرة أخرى.'
              : 'Unable to submit rating. Please try again.'
          );

        alert(backendMessage);

        this.cdr.detectChanges();
      }
    });
  }

  // ===============================
  // SUPPORT CENTER
  // ===============================

  toggleSupportCenter(): void {
    this.isSupportCenterOpen = !this.isSupportCenterOpen;

    if (this.isSupportCenterOpen) {
      this.isHistoryOpen = false;
      this.isMyComplaintsOpen = false;
    }
  }

  openSignup(returnTo: 'supportCenter' | 'history' | 'complaints' | 'chat' = 'chat'): void {
    this.authReturnTo = returnTo;
    this.showSignupPopup = true;
    this.showLoginPopup = false;
    this.signupEmail = this.email;
    this.signupName = '';
    this.signupPassword = '';
    this.signupConfirmPassword = '';
  }



  closeSupportCenter(): void {
    this.isSupportCenterOpen = false;
  }


  // ===============================
  // NEW CHAT
  // ===============================

  startNewChat(): void {

    if (this.isLoading) {
      return;
    }

    this.userMessage = '';
    this.activeForm = null;
    this.isHistoryOpen = false;
    this.isMyComplaintsOpen = false;
    this.isSupportCenterOpen = false;

    this.messages = [
      { ...WELCOME_MESSAGE }
    ];

    this.sessionId = this.generateSessionId();

    this.hasRatedSession = false;
    this.hasUserMessaged = false;

    this.cdr.detectChanges();
  }


  // ===============================
  // CHAT HISTORY
  // ===============================

  openChatHistory(): void {

    this.isSupportCenterOpen = false;

    this.isHistoryOpen = true;

    if (this.isLogginIn && this.customerId) {

      this.historySearchQuery = '';
      this.historyTab = 'all';

      this.fetchHistorySessions();
    }
  }


  // ===============================
  // MY COMPLAINTS
  // ===============================

  openMyComplaints(): void {

    this.isSupportCenterOpen = false;

    this.isHistoryOpen = false;

    this.isMyComplaintsOpen = true;
  }

  openComplaintFromCenter(): void {

    this.isMyComplaintsOpen = false;

    this.openComplaintForm();
  }


  openLoginFromComplaints(): void {
    this.isMyComplaintsOpen = false;
    this.openLogin('complaints');
  }


  // ===============================
  // LOGIN FROM SUPPORT CENTER
  // ===============================

  openLoginFromSupport(): void {
    this.isSupportCenterOpen = false;
    this.isHistoryOpen = false;
    this.showLoginPopup = true;
    this.openLogin('supportCenter');
  }
  private startFreshChat(): void {
    this.isOpen = false;
    if (this.isLoading) {
      return;
    }

    // ------------------------------------
    // Generate completely new session
    // ------------------------------------
    this.sessionId = this.generateSessionId();

    // ------------------------------------
    // Clear current conversation
    // ------------------------------------
    this.messages = [
      {
        sender: 'bot',
        text: this.translations[this.selectedLanguage].welcome,
        time: new Date()
      }
    ];

    // ------------------------------------
    // Reset chat state
    // ------------------------------------
    this.userMessage = '';
    this.pendingQuestion = '';

    this.activeForm = null;
    this.isHistoryOpen = false;

    this.hasRatedSession = false;
    this.hasUserMessaged = false;

    this.selectedRating = 0;
    this.ratingFeedback = '';

    this.applicationFormData = {};
    this.selectedDocuments = [];

    this.cdr.detectChanges();

    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
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

  authReturnTo: 'supportCenter' | 'history' | 'complaints' | 'chat' = 'chat';

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

  goBackFromLogin(): void {
    this.showLoginPopup = false;

    switch (this.authReturnTo) {
      case 'supportCenter':
        this.isSupportCenterOpen = true;
        break;
      case 'history':
        this.isHistoryOpen = true;
        break;
      case 'complaints':
        this.isMyComplaintsOpen = true;
        break;
      case 'chat':
      default:
        break;
    }
  }

  goBackFromSignup(): void {
    this.showSignupPopup = false;
    this.showLoginPopup = true; // keeps authReturnTo as-is, so Login's own back arrow still works correctly
  }

  goBackFromHistory(): void {
    this.isHistoryOpen = false;
    this.isSupportCenterOpen = true;
  }

  goBackFromComplaints(): void {
    this.isMyComplaintsOpen = false;
    this.isSupportCenterOpen = true;
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
  // ----- Login -----
  login() {
    if (this.isLoggingIn) return;   // block a second call while one is already in flight

    const body = {
      email: this.email,
      password: this.password
    };

    this.isLoggingIn = true;

    this.http.post<any>("http://localhost:5000/api/login", body)
      .subscribe({
        next: (res) => {
          this.isLoggingIn = false;

          if (res.success) {
            this.isLogginIn = true;
            this.customerId = res.customerId;
            this.saveLoginState();
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
            if (res.userNotFound) {
              alert(res.message || 'No account found with this email.');
              this.signupEmail = this.email;
              this.openSignup(this.authReturnTo);
            } else {
              alert(res.message);
            }
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isLoggingIn = false;
          console.error('Login error:', err);
          alert('Something went wrong. Please try again.');
          this.cdr.detectChanges();
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

  get tr() {
  return this.translations[this.selectedLanguage];
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

  // Validate required fields
  if (
    !f.subject ||
    !f.fullName ||
    !f.email ||
    !f.mobile ||
    !f.product ||
    !f.message
  ) {
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

  this.http
    .post<any>(
      'http://localhost:5000/api/complaint',
      payload
    )
    .subscribe({

      next: (response) => {

        this.isSubmittingComplaint = false;
        this.activeForm = null;

        // -----------------------------------------
        // Complaint submitted successfully
        // -----------------------------------------

        if (response?.success) {

          let botMessage = '';

          // ---------------------------------------
          // Complaint found in RAG
          // ---------------------------------------

          if (response.complaintFound === true) {

            botMessage =
              response.message ||
              (
                this.selectedLanguage === 'ar'
                  ? 'تم العثور على حل لهذه الشكوى.'
                  : 'We found a solution for your complaint.'
              );

          }

          // ---------------------------------------
          // Complaint NOT found in RAG
          // ---------------------------------------

          else {

            botMessage =
              response.message ||
              (
                this.selectedLanguage === 'ar'
                  ? 'شكراً لتسجيل شكواك. سيتصل بك أحد وكلائنا للمساعدة.'
                  : 'Thank you for registering your complaint. Our support agent will call you back to assist you.'
              );

          }

          // ---------------------------------------
          // Show bot response
          // ---------------------------------------

          this.messages.push({
            sender: 'bot',
            text: botMessage,
            time: new Date()
          });

        }

        // -----------------------------------------
        // Backend returned success=false
        // -----------------------------------------

        else {

          this.messages.push({
            sender: 'bot',
            text:
              response?.message ||
              this.translations[this.selectedLanguage].complaintError,
            time: new Date()
          });

        }

        // Reset form
        this.resetComplaintForm();

        this.cdr.detectChanges();
      },

      // -------------------------------------------
      // API error
      // -------------------------------------------

      error: (err) => {

        console.error(
          'Complaint Submission Failure:',
          err
        );

        this.isSubmittingComplaint = false;

        this.messages.push({
          sender: 'bot',
          text:
            this.selectedLanguage === 'ar'
              ? 'تعذر تسجيل الشكوى حالياً. سيتصل بك أحد وكلائنا للمساعدة.'
              : 'We are unable to process your complaint right now. Our support agent will call you back to assist you.',
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
      historyError: 'Could not load history. Please try again.',

            // Support center
      supportCenterTitle: 'Support Center',
      supportCenterSubtitle: 'How can we help you?',
      newChat: 'New Chat',
      newChatDesc: 'Start a new conversation',
      historyDesc: 'View your past conversations',
      myComplaints: 'My Complaints',
      myComplaintsDesc: 'View and track your complaints',
      checkStatus: 'Check Status',
      checkStatusDesc: 'Track your proposal or application status',
      loginSignIn: 'Login / Sign In',
      loginSignInDesc: 'Access your account',
      signedIn: '✓ You are signed in',
      logout: 'Logout',
      goBack: 'Go back',

      // Complaints drawer
      trackComplaints: 'Track your complaints',
      noComplaintsTitle: 'No complaints yet',
      noComplaintsText: "You haven't registered any complaints with us yet.",
      registerComplaintBtn: '+ Register Complaint',
      signInToViewComplaints: 'Sign in to view complaints',
      signInToViewComplaintsText: 'Login to view and track your complaints.',

      // Check status
      trackProposalStatus: 'Track your proposal status',
      quoteNumber: 'Quote Number',
      quoteNumberPlaceholder: 'e.g. QT-2026-00112',
      checking: 'Checking...',
      checkAnother: 'Check Another',
      underReview: 'Under Review',
      proposalWord: 'Proposal',
      pendingText: 'is still being reviewed by our underwriting team.',
      approved: 'Approved',
      approvedDefault: 'Your proposal has been approved. Please return to the chat to complete payment.',
      counterReceived: 'Counter-Offer Received',
      revisedPremium: 'Revised premium:',
      alreadyAccepted: 'You have already accepted this offer.',
      alreadyRejected: 'You have already rejected this offer.',
      counterPending: 'Please return to the chat to accept or reject this offer.',
      declined: 'Declined',
      declinedDefault: 'Unfortunately, this proposal could not be approved.',
      errEnterQuote: 'Please enter your quote number.',
      errNotFound: 'No proposal found for this quote number.',

      // History
      searchChats: 'Search chats...',
      tabAll: 'All',
      tabToday: 'Today',

      // Login / signup
      signInTitle: 'Sign In',
      signInSubtitle: 'Access your insurance account',
      welcomeBack: 'Welcome back!',
      loginDesc: 'Sign in to view your chat history and manage your complaints.',
      email: 'Email',
      password: 'Password',
      enterEmail: 'Enter your email',
      enterPassword: 'Enter your password',
      signInBtn: 'Sign In',
      signingIn: 'Signing in...',
      newHere: 'New here?',
      createAccount: 'Create an account',
      signUpTitle: 'Sign Up',
      signUpSubtitle: 'Create your insurance account',
      signupDesc: 'Sign up to save your conversations and track complaints.',
      enterName: 'Enter your name',
      confirmPassword: 'Confirm Password',
      reenterPassword: 'Re-enter your password',
      signUpBtn: 'Sign Up',
      creatingAccount: 'Creating account...',
      haveAccount: 'Already have an account?',
      signInLink: 'Sign in',
      close: 'Close'
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
      historyError: 'تعذر تحميل السجل. يرجى المحاولة مرة أخرى.',
            // Support center
      supportCenterTitle: 'مركز الدعم',
      supportCenterSubtitle: 'كيف يمكننا مساعدتك؟',
      newChat: 'محادثة جديدة',
      newChatDesc: 'ابدأ محادثة جديدة',
      historyDesc: 'عرض محادثاتك السابقة',
      myComplaints: 'شكاواي',
      myComplaintsDesc: 'عرض وتتبع شكاواك',
      checkStatus: 'التحقق من الحالة',
      checkStatusDesc: 'تتبع حالة طلبك',
      loginSignIn: 'تسجيل الدخول',
      loginSignInDesc: 'الوصول إلى حسابك',
      signedIn: '✓ لقد سجلت الدخول',
      logout: 'تسجيل الخروج',
      goBack: 'رجوع',

      // Complaints drawer
      trackComplaints: 'تتبع شكاواك',
      noComplaintsTitle: 'لا توجد شكاوى بعد',
      noComplaintsText: 'لم تقم بتسجيل أي شكاوى لدينا حتى الآن.',
      registerComplaintBtn: '+ تسجيل شكوى',
      signInToViewComplaints: 'سجّل الدخول لعرض الشكاوى',
      signInToViewComplaintsText: 'سجّل الدخول لعرض شكاواك وتتبعها.',

      // Check status
      trackProposalStatus: 'تتبع حالة طلبك',
      quoteNumber: 'رقم عرض السعر',
      quoteNumberPlaceholder: 'مثال: QT-2026-00112',
      checking: 'جارٍ التحقق...',
      checkAnother: 'التحقق من طلب آخر',
      underReview: 'قيد المراجعة',
      proposalWord: 'الطلب',
      pendingText: 'قيد المراجعة من قبل فريق الاكتتاب لدينا.',
      approved: 'تمت الموافقة',
      approvedDefault: 'تمت الموافقة على طلبك. يرجى العودة إلى المحادثة لإتمام الدفع.',
      counterReceived: 'تم استلام عرض مضاد',
      revisedPremium: 'القسط المعدل:',
      alreadyAccepted: 'لقد قبلت هذا العرض مسبقًا.',
      alreadyRejected: 'لقد رفضت هذا العرض مسبقًا.',
      counterPending: 'يرجى العودة إلى المحادثة لقبول هذا العرض أو رفضه.',
      declined: 'مرفوض',
      declinedDefault: 'للأسف، لم تتم الموافقة على هذا الطلب.',
      errEnterQuote: 'يرجى إدخال رقم عرض السعر.',
      errNotFound: 'لم يتم العثور على طلب بهذا الرقم.',

      // History
      searchChats: 'ابحث في المحادثات...',
      tabAll: 'الكل',
      tabToday: 'اليوم',

      // Login / signup
      signInTitle: 'تسجيل الدخول',
      signInSubtitle: 'الوصول إلى حسابك التأميني',
      welcomeBack: 'مرحبًا بعودتك!',
      loginDesc: 'سجّل الدخول لعرض سجل محادثاتك وإدارة شكاواك.',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      enterEmail: 'أدخل بريدك الإلكتروني',
      enterPassword: 'أدخل كلمة المرور',
      signInBtn: 'تسجيل الدخول',
      signingIn: 'جارٍ تسجيل الدخول...',
      newHere: 'جديد هنا؟',
      createAccount: 'إنشاء حساب',
      signUpTitle: 'إنشاء حساب',
      signUpSubtitle: 'أنشئ حسابك التأميني',
      signupDesc: 'سجّل لحفظ محادثاتك وتتبع شكاواك.',
      enterName: 'أدخل اسمك',
      confirmPassword: 'تأكيد كلمة المرور',
      reenterPassword: 'أعد إدخال كلمة المرور',
      signUpBtn: 'إنشاء حساب',
      creatingAccount: 'جارٍ إنشاء الحساب...',
      haveAccount: 'لديك حساب بالفعل؟',
      signInLink: 'تسجيل الدخول',
      close: 'إغلاق'
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

  openLogin(returnTo: 'supportCenter' | 'history' | 'complaints' | 'chat' = 'chat') {
    this.authReturnTo = returnTo;
    this.showLoginPopup = true;
    this.showSignupPopup = false;
    this.isHistoryOpen = false;
  }

  // Add near your other session helpers in bot.ts

private saveLoginState(): void {
  try {
    if (this.isLogginIn && this.customerId) {
      sessionStorage.setItem('botCustomerId', String(this.customerId));
      sessionStorage.setItem('botIsLoggedIn', 'true');
    }
  } catch { /* ignore */ }
}

// ===============================
// LOGOUT
// ===============================

logout(): void {

  // Clear login state
  this.isLogginIn = false;
  this.customerId = null;

  try {
    sessionStorage.removeItem('botIsLoggedIn');
    sessionStorage.removeItem('botCustomerId');
  } catch { /* ignore */ }

  // Reset any user-specific UI state
  this.isHistoryOpen = false;
  this.isMyComplaintsOpen = false;
  this.isCheckStatusOpen = false;
  this.historySessions = [];

  // Start a fresh conversation, since the old one was tied to the logged-in user
  this.messages = [
    {
      sender: 'bot',
      text: this.translations[this.selectedLanguage].welcome,
      time: new Date()
    }
  ];
  this.sessionId = this.generateSessionId();
  this.hasUserMessaged = false;
  this.hasRatedSession = false;

  this.cdr.detectChanges();
}

  private restoreLoginState(): void {
    try {
      const loggedIn = sessionStorage.getItem('botIsLoggedIn') === 'true';
      const customerId = sessionStorage.getItem('botCustomerId');
      if (loggedIn && customerId) {
        this.isLogginIn = true;
        this.customerId = Number(customerId);
      }
    } catch { /* ignore */ }
  }

  onActionClick(action: string) {

    // Some actions have a friendlier written-out phrase to show
    // as if the user typed it (POLICY, CLAIM, etc). Anything else
    // - including action strings a backend flow generates on its
    // own, like SELECT_QUOTE_OPTION_2 or PAY_QUOTE - is sent to
    // the backend exactly as-is, since these are the same raw
    // action strings the backend itself expects back.
    const cannedMessage =
      this.actionMessages[this.selectedLanguage][
      action as keyof typeof this.actionMessages['en']
      ];

    this.userMessage = cannedMessage || action;
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