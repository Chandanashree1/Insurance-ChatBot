import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { uwTranslations, UwKey, UwLang } from './underwriter.translations';

interface ProposalRow {
  proposalId: number;
  proposalNumber: string;
  quoteId: number;
  quoteNumber: string;
  customerName: string;
  planName: string;
  premium: number;
  vehicleValue: number;
  triggerReason: string;
  status: string;
  submittedAt: string;
}

@Component({
  selector: 'app-underwriter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './underwriter.component.html',
  styleUrls: ['./underwriter.component.scss']
})
export class UnderwriterComponent implements OnInit {

  // ==================================================
  // LANGUAGE
  // ==================================================
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
    try { localStorage.setItem('underwriterLang', lang); } catch { /* ignore */ }
    this.cdr.markForCheck();
  }

  // ==================================================
  // LOGIN STATE
  // ==================================================
  isLoggedIn = false;
  username = '';
  password = '';
  loginFailed = false;

  // ==================================================
  // PROPOSALS STATE
  // ==================================================
  proposals: ProposalRow[] = [];
  selectedProposal: ProposalRow | null = null;
  decisionNote = '';
  counterOfferPremium: number | null = null;
  deciding = false;
  decisionSentLog: { proposalNumber: string; decision: string; time: string }[] = [];

  proposalSearch = '';

  get filteredProposals(): ProposalRow[] {
    const q = this.proposalSearch.trim().toLowerCase();
    if (!q) return this.proposals;
    return this.proposals.filter(p =>
      [p.proposalNumber, p.customerName, p.planName]
        .some(v => String(v ?? '').toLowerCase().includes(q)));
  }

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    try {
      const saved = localStorage.getItem('underwriterLang');
      if (saved === 'en' || saved === 'ar') this.selectedLanguage = saved;
    } catch { /* ignore */ }

    this.isLoggedIn = sessionStorage.getItem('underwriterAuth') === 'true';
    if (this.isLoggedIn) this.loadProposals();
  }

  // ==================================================
  // LOGIN
  // ==================================================
  onLogin(): void {
    if (this.username === 'underwriter' && this.password === 'demo123') {
      sessionStorage.setItem('underwriterAuth', 'true');
      this.isLoggedIn = true;
      this.loginFailed = false;
      this.loadProposals();
    } else {
      this.loginFailed = true;
    }
  }

  logout(): void {
    sessionStorage.removeItem('underwriterAuth');
    this.isLoggedIn = false;
    this.username = '';
    this.password = '';
    this.loginFailed = false;
  }

  // ==================================================
  // PROPOSALS
  // ==================================================
  loadProposals(): void {
    this.http.get<any>('http://localhost:5000/api/proposals').subscribe({
      next: (res) => {
        this.proposals = res.data || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Proposals fetch failed:', err);
        this.proposals = [];
        this.cdr.detectChanges();
      }
    });
  }

  selectProposal(proposal: ProposalRow): void {
    this.selectedProposal = proposal;
    this.decisionNote = '';
    this.counterOfferPremium = null;
  }

  decide(decision: 'APPROVED' | 'COUNTER_OFFER' | 'DECLINED'): void {
    if (!this.selectedProposal) return;

    if (decision === 'COUNTER_OFFER' && (!this.counterOfferPremium || this.counterOfferPremium <= 0)) {
      return;
    }

    this.deciding = true;

    this.http.post(
      `http://localhost:5000/api/proposals/${this.selectedProposal.proposalId}/decide`,
      {
        decision,
        note: this.decisionNote.trim() || null,
        counterOfferPremium: decision === 'COUNTER_OFFER' ? this.counterOfferPremium : null
      }
    ).subscribe({
      next: () => {
        this.decisionSentLog.unshift({
          proposalNumber: this.selectedProposal!.proposalNumber,
          decision,
          time: new Date().toLocaleTimeString()
        });

        this.proposals = this.proposals.filter(p => p.proposalId !== this.selectedProposal!.proposalId);
        this.selectedProposal = null;
        this.decisionNote = '';
        this.counterOfferPremium = null;
        this.deciding = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.deciding = false;
        this.cdr.detectChanges();
      }
    });
  }
}