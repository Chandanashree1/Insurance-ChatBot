import { Component, ChangeDetectorRef, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ClaimService,
  ClaimPolicy,
  SubmitClaimResult,
  STP_CLAIM_THRESHOLD
} from '../services/claim.service';
import { uwTranslations, UwKey, UwLang } from '../underwriter/underwriter.translations';

type Step = 'lookup' | 'details' | 'result';

@Component({
  selector: 'app-claim-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './claim.html',
  styleUrls: ['./claim.scss']
})
export class ClaimFormComponent {

  /** Current UI language, passed in from the underwriter dashboard. */
  @Input() lang: UwLang = 'en';

  /** Fires after a claim is created so the dashboard can refresh its queue. */
  @Output() claimSubmitted = new EventEmitter<SubmitClaimResult>();

  readonly stpThreshold = STP_CLAIM_THRESHOLD;
  readonly maxImageBytes = 5 * 1024 * 1024;   // matches multer limit in claimRoutes.js
  readonly today = this.toLocalDate(new Date());

  step: Step = 'lookup';

  // Step 1
  policyNumber = '';
  lookingUp = false;
  lookupError = '';   // a translation key, or raw text from the server

  // Step 2
  policy: ClaimPolicy | null = null;
  incidentDate = '';
  claimAmount: number | null = null;
  description = '';
  imageFile: File | null = null;
  imagePreview: string | null = null;
  formError = '';     // a translation key, or raw text from the server
  submitting = false;

  // Step 3
  result: SubmitClaimResult | null = null;

  constructor(private claims: ClaimService, private cdr: ChangeDetectorRef) {}

  // ---------------------------------------------------------
  // TRANSLATION
  // ---------------------------------------------------------
  t(key: UwKey): string {
    return uwTranslations[this.lang]?.[key] ?? uwTranslations.en[key] ?? key;
  }

  /** Translates a stored key; anything else (e.g. a server message) is shown as is. */
  tm(text: string): string {
    return text in uwTranslations.en ? this.t(text as UwKey) : text;
  }

  // ---------------------------------------------------------
  // STEP 1: FIND POLICY
  // ---------------------------------------------------------
  lookupPolicy(): void {
    const number = this.policyNumber.trim().toUpperCase();

    if (!/^POL-\d{4}-\d+$/.test(number)) {
      this.lookupError = 'cfErrPolicyFormat';
      return;
    }

    this.lookingUp = true;
    this.lookupError = '';

    this.claims.lookupPolicy(number).subscribe({
      next: (policy) => {
        this.policy = policy;
        this.step = 'details';
        this.lookingUp = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.lookupError = err?.status === 404 || err?.message === 'Policy not found'
          ? 'cfErrNotFound'
          : (err?.error?.message || 'cfErrLookup');
        this.lookingUp = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ---------------------------------------------------------
  // STEP 2: CLAIM DETAILS
  // ---------------------------------------------------------

  /** Soft warning only: the cover-period rule is not decided yet, so this never blocks submit. */
  get coverWarning(): string {
    if (!this.policy || !this.incidentDate) return '';
    const from = this.policy.coverFrom ? String(this.policy.coverFrom).slice(0, 10) : null;
    const to = this.policy.coverTo ? String(this.policy.coverTo).slice(0, 10) : null;
    if ((from && this.incidentDate < from) || (to && this.incidentDate > to)) {
      return this.t('cfWarnOutside');
    }
    return '';
  }

  get routingHint(): string {
    if (!this.claimAmount || this.claimAmount <= 0) return '';
    const key: UwKey = this.claimAmount <= this.stpThreshold ? 'cfHintAuto' : 'cfHintReview';
    return this.t(key).replace('{n}', String(this.stpThreshold));
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.clearImage();
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.formError = 'cfErrImageType';
      input.value = '';
      return;
    }
    if (file.size > this.maxImageBytes) {
      this.formError = 'cfErrImageSize';
      input.value = '';
      return;
    }

    this.formError = '';
    this.imageFile = file;
    this.imagePreview = URL.createObjectURL(file);
  }

  clearImage(fileInput?: HTMLInputElement): void {
    if (this.imagePreview) URL.revokeObjectURL(this.imagePreview);
    this.imagePreview = null;
    this.imageFile = null;
    if (fileInput) fileInput.value = '';
  }

  submit(): void {
    if (!this.policy) return;

    if (!this.incidentDate) {
      this.formError = 'cfErrDate';
      return;
    }
    if (this.incidentDate > this.today) {
      this.formError = 'cfErrFuture';
      return;
    }
    if (!this.claimAmount || this.claimAmount <= 0) {
      this.formError = 'cfErrAmount';
      return;
    }
    if (!this.description.trim()) {
      this.formError = 'cfErrDesc';
      return;
    }

    this.formError = '';
    this.submitting = true;

    const body = new FormData();
    body.append('policyNumber', this.policy.policyNumber);
    body.append('incidentDate', this.incidentDate);
    body.append('claimAmount', String(this.claimAmount));
    body.append('description', this.description.trim());
    if (this.imageFile) body.append('image', this.imageFile);

    this.claims.submitClaim(body).subscribe({
      next: (result) => {
        this.result = result;
        this.step = 'result';
        this.submitting = false;
        this.claimSubmitted.emit(result);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.formError = err?.error?.message || 'cfErrSubmit';
        this.submitting = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ---------------------------------------------------------
  // NAVIGATION
  // ---------------------------------------------------------
  changePolicy(): void {
    this.clearImage();
    this.policy = null;
    this.formError = '';
    this.step = 'lookup';
  }

  startNew(): void {
    this.clearImage();
    this.policy = null;
    this.policyNumber = '';
    this.incidentDate = '';
    this.claimAmount = null;
    this.description = '';
    this.formError = '';
    this.lookupError = '';
    this.result = null;
    this.step = 'lookup';
  }

  private toLocalDate(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
}