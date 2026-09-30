import { Component, ElementRef, ViewChild, AfterViewChecked, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { QuoteService, QuoteOption, CreateQuoteResponse } from '../services/quote.service';
import { Router } from '@angular/router';
// import { KycService } from '../services/kyc.service';


interface SelectOptionResponse {
  success: boolean;
  message: string;
  data: any;
}

interface PaymentResponse {
  success: boolean;
  message: string;
  data: {
    success: boolean;
    paymentStatus: string;
    quote: any;
    selectedOption?: any;
  };
}

interface PolicyResponse {
  success: boolean;
  message: string;
  data: {
    policy: { policyId: number; policyNumber: string; [key: string]: any };
    quote: any;
  };
}

/** Single shared shape for both the Mulkiya-only form and the full Buy-Policy form. */
interface ChatFormData {
  mobileNumber?: string;
  mulkiyaMethod?: 'upload' | 'scan' | 'enter';
  plateNumber: string;
  plateCode: string;
  otherPlateCode: string;
  plateType: string;
  licenseMethod?: 'upload' | 'scan' | 'enter';
  civilIdLicenseNo?: string;
  fullName?: string;
  productId?: string;
  vehicleValue?: number;
}

interface FlowData {
  mobileNumber?: string;
  plateNumber?: string;
  plateCode?: string;
  civilIdLicenseNo?: string;
  fullName?: string;
  productId?: string;
  vehicleValue?: number;
}

type Stage =
  | 'ASK_MOBILE'
  | 'ASK_VEHICLE_DETAILS'
  | 'ASK_CIVIL_ID'
  | 'ASK_FULL_NAME'
  | 'ASK_PRODUCT'
  | 'ASK_VEHICLE_VALUE'
  | 'ASK_INSURANCE_TYPE'
  | 'ASK_FORM'
  | 'GENERATING'
  | 'PLAN_SELECTION'
  | 'PAYMENT'
  | 'DONE';

interface ChatMessage {
  from: 'bot' | 'user';
  type: 'text' | 'typing' | 'quick-replies' | 'plans' | 'summary' | 'success' | 'mulkiya-form' | 'policy-form';
  text?: string;
  options?: { label: string; value: string }[];
  vehicle?: any;
  plans?: QuoteOption[];
  policyNumber?: string;
  formData?: ChatFormData;
  quoteNumber?: string;
  coverFrom?: string;
  coverTo?: string;
  submitted: boolean;
  step?: 1 | 2 | 3;
  quoteId?: number;
  needsAdditionalInfo?: boolean;
  additionalInfoText?: string;
  underwritingPending?: boolean;
  proposalId?: number;
  proposalNumber?: string;
  proposalStatus?: string;
  counterOfferPremium?: number;
  underwriterNote?: string;
  checkingStatus?: boolean;
  selectedOption?: QuoteOption;
}
@Component({
  selector: 'app-buy-policy-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './buy_policy.component.html',
  styleUrls: ['./buy_policy.component.scss']
})
export class BuyPolicyChatComponent implements AfterViewChecked, OnInit {

  @Input() embedded: boolean = false;

  @ViewChild('chatBody') chatBodyRef!: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [];
  inputValue = '';
  stage: Stage = 'ASK_MOBILE';
  data: FlowData = {};

  quoteId: number | null = null;
  selectedOption: QuoteOption | null = null;
  formNotice = '';
  disabledQuickReplyGroups = new Set<ChatMessage>();
  disabledPlanGroups = new Set<ChatMessage>();

kycVerifying = false;
kycVerified = false;
kycFailedReason: string | null = null;

  constructor(
    private quoteService: QuoteService,
    private router: Router,
    private cdr: ChangeDetectorRef
    // private kycService: KycService
  ) {}

  goToPolicyPage(policyNumber?: string): void {
  if (!policyNumber) return;
  this.saveChatHistory();
  this.router.navigate(['/policy-success', policyNumber]);
}

  // ==================================================
  // CHAT HISTORY SAVE / RESTORE
  // ==================================================
  //
  // Restoring only happens when payment.component.ts's
  // goHome() explicitly sets 'restoreChatOnLoad' right
  // before redirecting. Any other load (typing "buy
  // policy" again, embedded widget boot, etc.) is always
  // a fresh start, even if stale history happens to be
  // sitting in sessionStorage.
  // ==================================================

  private saveChatHistory(): void {
    try {
      sessionStorage.setItem('chatHistory', JSON.stringify(this.messages));
      sessionStorage.setItem('chatStage', this.stage);
    } catch { /* storage unavailable, ignore */ }
  }
  
private loadChatHistory(): { messages: ChatMessage[]; stage: Stage } | null {
  try {
    const shouldRestore = sessionStorage.getItem('restoreChatOnLoad') === 'true';
    const setAt = Number(sessionStorage.getItem('restoreChatOnLoadTime') || 0);
    const isFresh = shouldRestore && (Date.now() - setAt) < 30000; // valid for 30s only

    if (!isFresh) {
      // stale, expired, or never set — wipe everything so it can never resurrect later
      sessionStorage.removeItem('chatHistory');
      sessionStorage.removeItem('chatStage');
      sessionStorage.removeItem('restoreChatOnLoad');
      sessionStorage.removeItem('restoreChatOnLoadTime');
      return null;
    }

    const raw = sessionStorage.getItem('chatHistory');
    const stage = sessionStorage.getItem('chatStage') as Stage | null;
    if (!raw || !stage) return null;
    return { messages: JSON.parse(raw), stage };
  } catch {
    return null;
  }
}

  ngOnInit(): void {
    const saved = this.loadChatHistory();
    if (saved) {
      this.messages = saved.messages;
      this.stage = saved.stage;
      this.cdr.detectChanges();
      sessionStorage.removeItem('chatHistory');
      sessionStorage.removeItem('chatStage');
      sessionStorage.removeItem('restoreChatOnLoad');
      return;
    }

    // No restore flag → always a genuinely fresh start.
    // Clear any stale leftovers so they can never silently resurrect later.
    sessionStorage.removeItem('chatHistory');
    sessionStorage.removeItem('chatStage');
    sessionStorage.removeItem('restoreChatOnLoad');

    if (this.embedded) {
      // Already routed here by the main chatbot — skip our own
      // greeting/"type buy policy" onboarding and show the form directly.
      this.startBuyPolicyFlow();
    } else {
      this.pushBot('text', {
        text: '👋 Hello! I\'m your Insurance Assistant. Type "I want to buy policy" whenever you\'re ready to get started.'
      });
    }
  }

  private emptyPolicyForm(): ChatFormData {
    return {
      mobileNumber: '',
      mulkiyaMethod: 'enter',
      plateNumber: '',
      plateCode: '',
      otherPlateCode: '',
      plateType: 'Oman',
      licenseMethod: 'enter',
      civilIdLicenseNo: '',
      fullName: '',
      productId: '',
      vehicleValue: 0
    };
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      const el = this.chatBodyRef.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch { /* noop */ }
  }

  private pushBot(type: ChatMessage['type'], msg: Partial<ChatMessage>): ChatMessage {
    const full: ChatMessage = {
      from: 'bot',
      type,
      submitted: false,
      ...msg
    };

    this.messages.push(full);
    this.cdr.detectChanges();
    return full;
  }

  private pushUser(text: string): void {
    this.messages.push({
      from: 'user',
      type: 'text',
      text,
      submitted: false
    });
    this.cdr.detectChanges();
  }

  private async typing(ms = 600): Promise<void> {
    const t = this.pushBot('typing', {});
    await this.wait(ms);
    const idx = this.messages.indexOf(t);
    if (idx > -1) this.messages.splice(idx, 1);
    this.cdr.detectChanges();
  }

  private wait(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  onQuickReply(msg: ChatMessage, value: string, label: string): void {
    if (this.disabledQuickReplyGroups.has(msg)) return;
    this.disabledQuickReplyGroups.add(msg);
    this.pushUser(label);
    this.handlePicked(value);
  }

  onSend(): void {
    const val = this.inputValue.trim();
    if (!val) return;
    this.pushUser(val);
    this.inputValue = '';

    if (val.toLowerCase().includes('buy policy')) {
      this.askInsuranceType();
      return;
    }

    this.handleTyped(val);
  }

  private async handleTyped(text: string): Promise<void> {
    switch (this.stage) {

      case 'ASK_MOBILE': {
        if (!/^\d{7,9}$/.test(text.replace(/\s/g, ''))) {
          await this.typing(400);
          this.pushBot('text', { text: "That doesn't look like a valid mobile number. Could you re-enter it? (e.g. 96222222)" });
          return;
        }
        this.data.mobileNumber = text.trim();
        this.stage = 'ASK_VEHICLE_DETAILS';
        await this.typing(500);
        this.pushBot('text', { text: "Got it. Now let's pull up your vehicle from the Mulkiya (vehicle registration)." });
        this.pushBot('mulkiya-form', {
          formData: { plateNumber: '', plateCode: 'M', otherPlateCode: '', plateType: 'Oman' }
        });
        break;
      }

      case 'ASK_VEHICLE_DETAILS': {
        this.pushBot('text', { text: 'Please fill in the vehicle details above and tap Continue 👆' });
        break;
      }

      case 'ASK_CIVIL_ID': {
        this.data.civilIdLicenseNo = text.trim();
        this.stage = 'ASK_FULL_NAME';
        await this.typing(400);
        this.pushBot('text', { text: "Thanks. What's your full name as it appears on your license?" });
        break;
      }

      case 'ASK_FULL_NAME': {
        this.data.fullName = text.trim();
        this.stage = 'ASK_PRODUCT';
        await this.typing(400);
        this.pushBot('text', { text: 'Perfect. What kind of coverage would you like?' });
        this.pushBot('quick-replies', {
          options: [
            { label: 'Comprehensive Insurance', value: 'COMPREHENSIVE' },
            { label: 'Third Party Insurance', value: 'THIRD_PARTY' }
          ]
        });
        break;
      }

      case 'ASK_VEHICLE_VALUE': {
        const val = Number(text.replace(/[^\d.]/g, ''));
        if (!val || val <= 0) {
          await this.typing(300);
          this.pushBot('text', { text: 'Please enter a valid vehicle value in OMR, e.g. 4500' });
          return;
        }
        this.data.vehicleValue = val;
        await this.generateQuote();
        break;
      }

      case 'ASK_FORM': {
        this.pushBot('text', { text: 'Please fill in the form above and tap Get Quote 👆' });
        break;
      }

      default:
        this.pushBot('text', { text: "I'm still working on your previous step above 👆" });
    }
  }

  onSubmitMulkiya(msg: ChatMessage): void {
    if (msg.submitted) return;
    const form = msg.formData!;
    const plateNumber = form.plateNumber.trim();
    const plateCode = form.plateCode === 'OTHER' ? form.otherPlateCode.trim() : form.plateCode;

    if (!plateNumber) {
      this.pushBot('text', { text: 'Please enter a plate number before continuing.' });
      return;
    }
    if (!plateCode) {
      this.pushBot('text', { text: 'Please enter a plate code before continuing.' });
      return;
    }
    

    msg.submitted = true;
    this.data.plateNumber = plateNumber;
    this.data.plateCode = plateCode;

    this.pushUser(`Plate: ${plateNumber} (${plateCode}) — ${form.plateType}`);
    this.afterPlateCode();
  }

  private async handlePicked(value: string): Promise<void> {
    if (this.stage === 'ASK_INSURANCE_TYPE') {
      if (value === 'MOTOR') {
        this.startBuyPolicyFlow();
      } else {
        await this.typing(400);
        this.pushBot('text', { text: `${value.charAt(0) + value.slice(1).toLowerCase()} insurance isn't available yet — only Car Insurance can be purchased right now.` });
      }
      return;
    }

    if (this.stage === 'ASK_PRODUCT') {
      this.data.productId = value;
      if (value === 'COMPREHENSIVE') {
        this.stage = 'ASK_VEHICLE_VALUE';
        await this.typing(400);
        this.pushBot('text', { text: "What's the current market value of your vehicle (in OMR)?" });
      } else {
        await this.generateQuote();
      }
      return;
    }

    if (this.stage === 'PLAN_SELECTION' && value === '__pay') {
      await this.handlePayNow();
    }
  }

  private async afterPlateCode(): Promise<void> {
    this.stage = 'ASK_CIVIL_ID';
    await this.typing(400);
    this.pushBot('text', { text: 'Now for your driving license — what\'s your Civil ID / License number?' });
  }

  startBuyPolicyFlow(): void {
    this.stage = 'ASK_FORM';
    this.pushBot('policy-form', { formData: this.emptyPolicyForm(), step: 1 });
  }

  private async askInsuranceType(): Promise<void> {
    this.stage = 'ASK_INSURANCE_TYPE';
    await this.typing(400);
    this.pushBot('text', { text: 'Sure! What type of insurance would you like?' });
    this.pushBot('quick-replies', {
      options: [
        { label: 'Car Insurance', value: 'MOTOR' },
        { label: 'Health Insurance', value: 'HEALTH' },
        { label: 'Travel Insurance', value: 'TRAVEL' },
        { label: 'Life Insurance', value: 'LIFE' }
      ]
    });
  }

  /** Upload/Scan are UI-only placeholders until the backend for document parsing is wired in. */
  setMulkiyaMethod(msg: ChatMessage, method: 'upload' | 'scan' | 'enter'): void {
    if (msg.submitted) return;
    if (method !== 'enter') {
      this.pushBot('text', {
        text: `${method === 'upload' ? 'Uploading' : 'Scanning'} your Mulkiya will be available soon — please use "Enter Details" for now.`
      });
      return;
    }
    msg.formData!.mulkiyaMethod = method;
  }

  setLicenseMethod(msg: ChatMessage, method: 'upload' | 'scan' | 'enter'): void {
    if (msg.submitted) return;
    if (method !== 'enter') {
      this.pushBot('text', {
        text: `${method === 'upload' ? 'Uploading' : 'Scanning'} your license will be available soon — please use "Enter Details" for now.`
      });
      return;
    }
    msg.formData!.licenseMethod = method;
  }

  selectProduct(msg: ChatMessage, productId: string): void {
    if (msg.submitted) return;
    msg.formData!.productId = productId;
  }

selectPlanForForm(msg: ChatMessage, plan: QuoteOption): void {
    if (!msg.quoteId || !plan.optionId || msg.submitted) {
      return;
    }

    this.formNotice = '';

    this.quoteService.selectOption(msg.quoteId, plan.optionId).subscribe({
      next: (res: any) => {

        if (res.data.needsAdditionalInfo) {
          msg.selectedOption = plan;
          msg.needsAdditionalInfo = true;
          msg.additionalInfoText = '';
          this.cdr.detectChanges();
          return;
        }

        msg.selectedOption = res.data.selectedOption || plan;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.formNotice = err?.error?.message || 'Could not select this plan. Please try again.';
        this.cdr.detectChanges();
      }
    });
}

submitAdditionalInfo(msg: ChatMessage): void {
    if (!msg.quoteId || !msg.selectedOption?.optionId) return;
    if (!msg.additionalInfoText?.trim()) {
      this.formNotice = 'Please provide the requested information before submitting.';
      return;
    }

    msg.submitted = true;
    this.formNotice = '';

    this.quoteService.submitProposal(
      msg.quoteId,
      msg.selectedOption.optionId,
      msg.additionalInfoText.trim()
    ).subscribe({
      next: (res: any) => {
        msg.needsAdditionalInfo = false;
        msg.underwritingPending = true;
        msg.proposalId = res.data.proposalId;
        msg.proposalNumber = res.data.proposalNumber;
        msg.proposalStatus = 'PENDING';
        msg.submitted = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        msg.submitted = false;
        this.formNotice = err?.error?.message || 'Could not submit your proposal. Please try again.';
        this.cdr.detectChanges();
      }
    });
}

checkProposalStatus(msg: ChatMessage): void {
    if (!msg.quoteId) return;

    msg.checkingStatus = true;

    this.quoteService.getProposalStatus(msg.quoteId).subscribe({
      next: (res: any) => {
        msg.proposalStatus = res.data.status;
        msg.counterOfferPremium = res.data.counterOfferPremium;
        msg.underwriterNote = res.data.note;

        // Populate selectedOption so payNowForForm() has what it needs
        if (res.data.optionId && !msg.selectedOption) {
          msg.selectedOption = {
            optionId: res.data.optionId,
            optionNumber: 0,
            planName: res.data.planName,
            premium: res.data.premium,
            coverageDetails: ''
          };
        }

        msg.checkingStatus = false;
        this.cdr.detectChanges();
      },
      error: () => {
        msg.checkingStatus = false;
        this.cdr.detectChanges();
      }
    });
}

respondToCounterOffer(msg: ChatMessage, response: 'ACCEPTED' | 'REJECTED'): void {
    if (!msg.proposalId) return;

    this.quoteService.respondToCounterOffer(msg.proposalId, response).subscribe({
      next: () => {
        if (response === 'ACCEPTED') {
          if (msg.selectedOption) {
            msg.selectedOption.premium = msg.counterOfferPremium!;
          }
          msg.underwritingPending = false;
          msg.proposalStatus = 'ACCEPTED_PROCEED';
        } else {
          msg.proposalStatus = 'REJECTED_BY_CUSTOMER';
        }
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.formNotice = err?.error?.message || 'Could not submit your response.';
        this.cdr.detectChanges();
      }
    });
}
  payNowForForm(msg: ChatMessage): void {
    if (!msg.quoteId || !msg.selectedOption || msg.submitted) {
      return;
    }

    msg.submitted = true;
    this.formNotice = '';

    this.quoteService.processPayment(msg.quoteId).subscribe({
      next: (paymentRes: PaymentResponse) => {
        if (!paymentRes?.data?.success && (paymentRes as any)?.success !== true) {
          msg.submitted = false;
          this.formNotice = 'Payment failed. Please try again.';
          this.cdr.detectChanges();
          return;
        }

        this.quoteService.createPolicy(msg.quoteId!).subscribe({
          next: (policyRes: PolicyResponse) => {
            msg.policyNumber = policyRes?.data?.policy?.policyNumber;
            msg.step = 3;
            msg.submitted = false;

            this.saveChatHistory();
            this.cdr.detectChanges();

            // setTimeout(() => {
            //   this.goToPolicyPage(msg.policyNumber);
            // }, 1500);
          },
          error: (err: HttpErrorResponse) => {
            msg.submitted = false;
            this.formNotice = err?.error?.message || 'Payment succeeded but policy creation failed. Please contact support.';
            this.cdr.detectChanges();
          }
        });
      },
      error: (err: HttpErrorResponse) => {
        msg.submitted = false;
        this.formNotice = err?.error?.message || 'Payment could not be processed.';
        this.cdr.detectChanges();
      }
    });
  }

  cancelPolicyForm(msg: ChatMessage): void {
    msg.step = undefined;
    msg.submitted = false;
  }
submitPolicyForm(msg: ChatMessage): void {
    if (msg.submitted) return;
    const form = msg.formData!;

    if (!form.mobileNumber?.trim() || !/^\d{7,9}$/.test(form.mobileNumber.replace(/\s/g, ''))) {
      this.formNotice = 'Please enter a valid mobile number.';
      return;
    }
    const plateNumber = form.plateNumber.trim();
    const plateCode = form.plateCode === 'OTHER' ? form.otherPlateCode.trim() : form.plateCode;
    if (!plateNumber) {
      this.formNotice = 'Please enter a plate number.';
      return;
    }
    if (!plateCode) {
      this.formNotice = 'Please select a plate code.';
      return;
    }
    if (!form.civilIdLicenseNo?.trim()) {
      this.formNotice = 'Please enter your Civil ID / License number.';
      return;
    }
    if (!form.fullName?.trim()) {
      this.formNotice = 'Please enter your full name.';
      return;
    }
    if (!form.productId) {
      this.formNotice = 'Please select a coverage type.';
      return;
    }
    if (form.productId === 'COMPREHENSIVE' && (!form.vehicleValue || form.vehicleValue <= 0)) {
      this.formNotice = 'Please enter a valid vehicle value.';
      return;
    }

    // ==================================================
    // KYC VERIFICATION (DB-BACKED)
    // ==================================================

    msg.submitted = true;
    this.formNotice = '';
    this.kycVerifying = true;
    this.kycVerified = false;
    this.kycFailedReason = null;
    this.cdr.detectChanges();

    this.quoteService.verifyKyc(form.civilIdLicenseNo!.trim()).subscribe({
      next: (kycRes: any) => {

        this.kycVerifying = false;

        if (!kycRes.verified) {

          this.kycFailedReason = kycRes.reason;
          this.cdr.detectChanges();

          this.quoteService.escalateKycFailure({
            mobileNumber: form.mobileNumber!.trim(),
            fullName: form.fullName!.trim(),
            civilIdLicenseNo: form.civilIdLicenseNo!.trim(),
            plateNumber,
            plateCode,
            productId: form.productId!,
            vehicleValue: form.productId === 'COMPREHENSIVE' ? form.vehicleValue : undefined
          }).subscribe({
            next: (res: any) => {
              msg.quoteId = res.data.quoteId;
              msg.quoteNumber = res.data.quoteNumber;
              msg.proposalNumber = res.data.proposal?.proposalNumber;
              msg.underwritingPending = true;
              msg.proposalStatus = 'PENDING';
              msg.step = 2;
              msg.submitted = false;
              this.cdr.detectChanges();
            },
            error: (err: HttpErrorResponse) => {
              msg.submitted = false;
              this.formNotice = 'Verification failed and could not be submitted for review. Please try again.';
              this.cdr.detectChanges();
            }
          });

          return;
        }

        // KYC passed — show success badge briefly, then proceed
        this.kycVerified = true;
        this.cdr.detectChanges();

        setTimeout(() => {

          this.kycVerified = false; // clear before moving on

          this.quoteService.createMotorQuote({
            mobileNumber: form.mobileNumber!.trim(),
            fullName: form.fullName!.trim(),
            civilIdLicenseNo: form.civilIdLicenseNo!.trim(),
            plateNumber,
            plateCode,
            productId: form.productId!,
            vehicleValue: form.productId === 'COMPREHENSIVE' ? form.vehicleValue : undefined
          }).subscribe({
            next: (res: CreateQuoteResponse) => {
              msg.quoteId = res.data.quote.quoteId;
              msg.quoteNumber = res.data.quote.quoteNumber;
              msg.coverFrom = res.data.quote.coverFrom;
              msg.coverTo = res.data.quote.coverTo;
              msg.vehicle = res.data.vehicle;
              msg.plans = res.data.options;
              msg.step = 2;
              msg.submitted = false;
              this.cdr.detectChanges();
            },
            error: (err: HttpErrorResponse) => {
              msg.submitted = false;
              this.formNotice = err?.error?.message || 'Something went wrong generating your quote. Please check your details.';
              this.cdr.detectChanges();
            }
          });

        }, 600);
      },
      error: () => {
        this.kycVerifying = false;
        msg.submitted = false;
        this.formNotice = 'Could not verify your identity right now. Please try again.';
        this.cdr.detectChanges();
      }
    });
}
private async generateQuote(): Promise<void> {

    // ==================================================
    // KYC VERIFICATION (DB-BACKED)
    // ==================================================

    this.kycVerifying = true;

    this.quoteService.verifyKyc(this.data.civilIdLicenseNo!).subscribe({
      next: async (kycRes: any) => {

        this.kycVerifying = false;

        if (!kycRes.verified) {
          await this.typing(400);
          this.pushBot('text', { text: `Sorry — ${kycRes.reason}. Please re-check your details.` });
          this.stage = 'ASK_CIVIL_ID';
          this.cdr.detectChanges();
          return;
        }

        this.stage = 'GENERATING';
        await this.typing(900);
        this.pushBot('text', { text: 'Give me a moment while I generate your quote...' });

        this.quoteService.createMotorQuote({
          mobileNumber: this.data.mobileNumber!,
          fullName: this.data.fullName!,
          civilIdLicenseNo: this.data.civilIdLicenseNo!,
          plateNumber: this.data.plateNumber!,
          plateCode: this.data.plateCode!,
          productId: this.data.productId!,
          vehicleValue: this.data.vehicleValue
        }).subscribe({
          next: async (res: CreateQuoteResponse) => {
            this.quoteId = res.data.quote.quoteId;
            await this.typing(500);
            this.pushBot('summary', { vehicle: res.data.vehicle });
            await this.wait(300);
            this.pushBot('text', { text: 'Here are your available plans — pick the one that suits you best:' });
            this.stage = 'PLAN_SELECTION';
            this.pushBot('plans', { plans: res.data.options });
          },
          error: async (err: HttpErrorResponse) => {
            await this.typing(400);
            const msg = err?.error?.message || 'Something went wrong generating your quote.';
            this.pushBot('text', { text: `Sorry — ${msg}. Could you double check the plate number and code below?` });
            this.stage = 'ASK_VEHICLE_DETAILS';
            this.pushBot('mulkiya-form', {
              formData: { plateNumber: this.data.plateNumber || '', plateCode: 'M', otherPlateCode: '', plateType: 'Oman' }
            });
            this.cdr.detectChanges();
          }
        });
      },
      error: async () => {
        this.kycVerifying = false;
        await this.typing(400);
        this.pushBot('text', { text: 'Could not verify your identity right now. Please try again.' });
        this.stage = 'ASK_CIVIL_ID';
        this.cdr.detectChanges();
      }
    });
}
onSelectPlan(msg: ChatMessage, plan: QuoteOption): void {
    if (this.disabledPlanGroups.has(msg)) return;
    this.disabledPlanGroups.add(msg);
    this.selectedOption = plan;
    this.pushUser(`Selected: ${plan.planName} — OMR ${plan.premium.toFixed(3)}`);

    this.quoteService.selectOption(this.quoteId!, plan.optionId).subscribe({
      next: async (res: any) => {

        if (res.data.needsAdditionalInfo) {
          await this.typing(500);
          this.pushBot('text', {
            text: `Your vehicle value requires manual underwriting review. This flow needs the wizard form (Buy Policy card) to collect additional details — please use "I want to buy policy" instead.`
          });
          this.stage = 'DONE';
          this.cdr.detectChanges();
          return;
        }

        await this.typing(400);
        this.pushBot('text', { text: `Great choice! Your total premium is OMR ${plan.premium.toFixed(3)}. Ready to pay?` });
        this.pushBot('quick-replies', { options: [{ label: 'Pay Now', value: '__pay' }] });
        this.cdr.detectChanges();
      },
      error: async (err: HttpErrorResponse) => {
        await this.typing(400);
        this.pushBot('text', { text: err?.error?.message || 'Could not select this plan. Please try again.' });
        this.cdr.detectChanges();
      }
    });
}
  private async handlePayNow(): Promise<void> {
    this.stage = 'PAYMENT';
    await this.typing(1000);
    this.pushBot('text', { text: 'Processing your payment...' });

    this.quoteService.processPayment(this.quoteId!).subscribe({
      next: (paymentRes: PaymentResponse) => {
        if (!paymentRes?.data?.success && (paymentRes as any)?.success !== true) {
          this.pushBot('text', { text: 'Payment failed. Please try again.' });
          return;
        }
        this.quoteService.createPolicy(this.quoteId!).subscribe({
          next: async (policyRes: PolicyResponse) => {
            await this.typing(700);
            const policyNumber = policyRes?.data?.policy?.policyNumber;
            this.pushBot('success', { policyNumber });
            this.stage = 'DONE';
            await this.wait(300);
            this.pushBot('text', { text: 'Your policy documents will be sent via WhatsApp and email. Redirecting you to your policy page now...' });
            this.saveChatHistory();
            this.cdr.detectChanges();
            // await this.wait(1200);
            // this.goToPolicyPage(policyNumber);
          },
          error: async (err: HttpErrorResponse) => {
            await this.typing(400);
            this.pushBot('text', { text: err?.error?.message || 'Payment succeeded but policy creation failed. Please contact support.' });
            this.cdr.detectChanges();
          }
        });
      },
      error: async (err: HttpErrorResponse) => {
        await this.typing(400);
        this.pushBot('text', { text: err?.error?.message || 'Payment could not be processed.' });
        this.cdr.detectChanges();
      }
    });
  }
}