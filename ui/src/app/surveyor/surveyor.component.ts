import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { uwTranslations, UwKey, UwLang } from '../underwriter/underwriter.translations';
import { ClaimService, PendingClaim, SubmitClaimResult } from '../services/claim.service';
import { ClaimFormComponent } from '../claim/claim';

@Component({
  selector: 'app-surveyor',
  standalone: true,
  imports: [CommonModule, FormsModule, ClaimFormComponent],
  templateUrl: './surveyor.component.html',
  styleUrls: ['../underwriter/underwriter.component.scss']
})
export class SurveyorComponent implements OnInit {

  constructor(private cdr: ChangeDetectorRef, private claimSvc: ClaimService) { }

  // ================= LANGUAGE =================
  selectedLanguage: UwLang = 'en';

  private statusKeys: Record<string, UwKey> = {
    PENDING: 'statusPending',
    APPROVED: 'statusApproved',
    COUNTER_OFFER: 'statusCounterOffer',
    DECLINED: 'statusDeclined'
  };

  t(key: UwKey): string {
    return uwTranslations[this.selectedLanguage]?.[key] ?? uwTranslations.en[key] ?? key;
  }

  tr(en: string, ar: string): string {
    return this.selectedLanguage === 'ar' ? ar : en;
  }

  statusLabel(code: string): string {
    const key = this.statusKeys[code];
    return key ? this.t(key) : code;
  }

  switchLanguage(lang: UwLang): void {
    this.selectedLanguage = lang;
    try { localStorage.setItem('surveyorLang', lang); } catch { /* ignore */ }
    this.cdr.markForCheck();
  }

  // ================= LOGIN (separate from underwriter) =================
  isLoggedIn = false;
  username = '';
  password = '';
  loginFailed = false;

  ngOnInit(): void {
    try {
      const saved = localStorage.getItem('surveyorLang');
      if (saved === 'en' || saved === 'ar') this.selectedLanguage = saved;
    } catch { /* ignore */ }

    this.isLoggedIn = sessionStorage.getItem('surveyorAuth') === 'true';
    if (this.isLoggedIn) this.loadPendingClaims();
  }

  onLogin(): void {
    if (this.username === 'surveyor' && this.password === 'demo123') {
      sessionStorage.setItem('surveyorAuth', 'true');
      this.isLoggedIn = true;
      this.loginFailed = false;
      this.loadPendingClaims();
    } else {
      this.loginFailed = true;
    }
  }

  logout(): void {
    sessionStorage.removeItem('surveyorAuth');
    this.isLoggedIn = false;
    this.username = '';
    this.password = '';
    this.loginFailed = false;
  }

  // ================= SEARCH =================
  claimSearch = '';

  private matches(term: string, ...values: unknown[]): boolean {
    const q = term.trim().toLowerCase();
    if (!q) return true;
    return values.some(v => String(v ?? '').toLowerCase().includes(q));
  }

  get filteredClaims(): PendingClaim[] {
    return this.pendingClaims.filter(c =>
      this.matches(this.claimSearch, c.claimNumber, c.customerName, c.policyNumber, c.productName));
  }

  // ================= CLAIMS =================
  pendingClaims: PendingClaim[] = [];
  selectedClaim: PendingClaim | null = null;
  claimNote = '';
  claimApprovedAmount: number | null = null;
  claimError = '';
  decidingClaim = false;
  claimDecisionLog: { claimNumber: string; decision: string; time: string }[] = [];

  claimsView: 'review' | 'file' = 'review';

  loadPendingClaims(): void {
    this.claimSvc.getPendingClaims().subscribe({
      next: (claims) => {
        this.pendingClaims = claims;
        if (this.selectedClaim && !claims.some(c => c.claimId === this.selectedClaim!.claimId)) {
          this.selectedClaim = null;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Pending claims fetch failed:', err);
        this.pendingClaims = [];
        this.cdr.detectChanges();
      }
    });
  }

  onClaimSubmitted(_result: SubmitClaimResult): void {
    this.loadPendingClaims();
  }

  selectClaim(claim: PendingClaim): void {
    this.selectedClaim = claim;
    this.claimNote = '';
    this.claimApprovedAmount = null;
    this.claimError = '';
  }

  claimImageUrl(claim: PendingClaim): string | null {
    return this.claimSvc.imageUrl(claim.imagePath);
  }

  decideClaim(decision: 'APPROVED' | 'DECLINED'): void {
    const claim = this.selectedClaim;
    if (!claim) return;

    const note = this.claimNote.trim();

    if (decision === 'DECLINED' && !note) {
      this.claimError = 'Add a note explaining the decline. The customer will see it.';
      return;
    }

    let approvedAmount: number | null = null;
    if (decision === 'APPROVED') {
      approvedAmount = this.claimApprovedAmount ?? claim.claimAmount;
      if (!(approvedAmount > 0) || approvedAmount > claim.claimAmount) {
        this.claimError = `Approved amount must be between 0 and OMR ${claim.claimAmount}.`;
        return;
      }
    }

    this.claimError = '';
    this.decidingClaim = true;

    this.claimSvc.decideClaim(claim.claimId, decision, note || null, approvedAmount).subscribe({
      next: () => {
        this.claimDecisionLog.unshift({
          claimNumber: claim.claimNumber,
          decision,
          time: new Date().toLocaleTimeString()
        });
        this.pendingClaims = this.pendingClaims.filter(c => c.claimId !== claim.claimId);
        this.selectedClaim = null;
        this.claimNote = '';
        this.claimApprovedAmount = null;
        this.decidingClaim = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.claimError = err?.error?.message || 'Could not save the decision. Please try again.';
        this.decidingClaim = false;
        this.loadPendingClaims();
      }
    });
  }
}