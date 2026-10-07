import { Component, ChangeDetectorRef, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ClaimService,
  ClaimPolicy,
  SubmitClaimResult,
  STP_CLAIM_THRESHOLD
} from '../services/claim.service';

type Step = 'lookup' | 'details' | 'result';

@Component({
  selector: 'app-claim-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './claim.html',
  styleUrls: ['./claim.scss']
})
export class ClaimFormComponent {

  /** Fires after a claim is created so the dashboard can refresh its queue. */
  @Output() claimSubmitted = new EventEmitter<SubmitClaimResult>();

  readonly stpThreshold = STP_CLAIM_THRESHOLD;
  readonly maxImageBytes = 5 * 1024 * 1024;   // matches multer limit in claimRoutes.js
  readonly today = this.toLocalDate(new Date());

  step: Step = 'lookup';

  // Step 1
  policyNumber = '';
  lookingUp = false;
  lookupError = '';

  // Step 2
  policy: ClaimPolicy | null = null;
  incidentDate = '';
  claimAmount: number | null = null;
  description = '';
  imageFile: File | null = null;
  imagePreview: string | null = null;
  formError = '';
  submitting = false;

  // Step 3
  result: SubmitClaimResult | null = null;

  constructor(private claims: ClaimService, private cdr: ChangeDetectorRef) {}

  // ---------------------------------------------------------
  // STEP 1: FIND POLICY
  // ---------------------------------------------------------
  lookupPolicy(): void {
    const number = this.policyNumber.trim().toUpperCase();

    if (!/^POL-\d{4}-\d+$/.test(number)) {
      this.lookupError = 'Enter a policy number like POL-2026-00006.';
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
          ? 'No policy found with that number.'
          : (err?.error?.message || 'Could not look up the policy. Please try again.');
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
      return 'This date is outside the policy cover period.';
    }
    return '';
  }

  get routingHint(): string {
    if (!this.claimAmount || this.claimAmount <= 0) return '';
    return this.claimAmount <= this.stpThreshold
      ? `Within OMR ${this.stpThreshold}: will be approved automatically.`
      : `Above OMR ${this.stpThreshold}: will go to underwriter review.`;
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.clearImage();
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.formError = 'Only image files are allowed.';
      input.value = '';
      return;
    }
    if (file.size > this.maxImageBytes) {
      this.formError = 'Image must be 5 MB or smaller.';
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
      this.formError = 'Please enter the incident date.';
      return;
    }
    if (this.incidentDate > this.today) {
      this.formError = 'The incident date cannot be in the future.';
      return;
    }
    if (!this.claimAmount || this.claimAmount <= 0) {
      this.formError = 'Please enter a claim amount greater than 0.';
      return;
    }
    if (!this.description.trim()) {
      this.formError = 'Please describe what happened.';
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
        this.formError = err?.error?.message || 'Could not submit the claim. Please try again.';
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