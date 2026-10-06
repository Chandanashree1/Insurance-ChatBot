import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { uwTranslations, UwKey, UwLang } from './underwriter.translations';
import {ComplaintFlwUp} from '../services/complaint-flw-up'

interface QuoteRow {
  quoteId: number;
  quoteNumber: string;
  customerName: string;
  planName: string;
  premium: number;
  status: string;
}

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

  /** Maps backend status / decision codes to translation keys. */
  private statusKeys: Record<string, UwKey> = {
    PENDING: 'statusPending',
    APPROVED: 'statusApproved',
    COUNTER_OFFER: 'statusCounterOffer',
    DECLINED: 'statusDeclined'
  };

  t(key: UwKey): string {
    return uwTranslations[this.selectedLanguage]?.[key] ?? uwTranslations.en[key] ?? key;
  }

  /** Translates a backend status/decision code; falls back to the raw value. */
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
  // DASHBOARD STATE
  // ==================================================
  quotes: QuoteRow[] = [];
  selectedQuoteId: number | null = null;
  followUpMessage = '';
  sentLog: { quoteId: number; message: string; time: string }[] = [];
  sending = false;

  proposals: ProposalRow[] = [];
  selectedProposal: ProposalRow | null = null;
  decisionNote = '';
  counterOfferPremium: number | null = null;
  deciding = false;
  decisionSentLog: { proposalNumber: string; decision: string; time: string }[] = [];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private flwUp:ComplaintFlwUp) { }

  ngOnInit(): void {
    // Restore the last chosen language
    try {
      const saved = localStorage.getItem('underwriterLang');
      if (saved === 'en' || saved === 'ar') this.selectedLanguage = saved;
    } catch { /* ignore */ }

    this.isLoggedIn = sessionStorage.getItem('underwriterAuth') === 'true';
    if (this.isLoggedIn) {
      this.loadProposals();
    }
    this.loadComplaints()
  }

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
      return; // require a valid counter premium
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
        // Store the raw code; it is translated at render time via statusLabel()
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
  // DASHBOARD
  // ==================================================
  loadQuotes(): void {
    this.http.get<any>('http://localhost:5000/api/quotes').subscribe({
      next: (res) => this.quotes = res.data || [],
      error: () => this.quotes = []
    });
  }

  selectQuote(quoteId: number): void {
    this.selectedQuoteId = quoteId;
  }

  sendFollowUp(): void {
    if (!this.selectedQuoteId || !this.followUpMessage.trim()) return;

    this.sending = true;

    this.http.post('http://localhost:5000/api/underwriter/send-message', {
      quoteId: this.selectedQuoteId,
      message: this.followUpMessage.trim()
    }).subscribe({
      next: () => {
        this.sentLog.unshift({
          quoteId: this.selectedQuoteId!,
          message: this.followUpMessage.trim(),
          time: new Date().toLocaleTimeString()
        });
        this.followUpMessage = '';
        this.sending = false;
      },
      error: () => { this.sending = false; }
    });
  }

  complaints: any[] = [];
  selectedComplaint: any = null;
  complaintMessage: string = '';

  loadComplaints() {
    this.flwUp.getNonStpComplaints()
      .subscribe({
        next: (response) => {
          this.complaints = response.complaints;
          console.log('complaints received:', this.complaints);

        },
        error: (error) => {
          console.error('Error loading complaints:', error);
        }
      });
  }
  selectComplaint(complaint: any): void {
    this.selectedComplaint = complaint;
    // Clear message box when opening another complaint
    this.complaintMessage = '';
    console.log(
      'Selected Complaint:',
      complaint
    );
  }

  callCustomer(complaint: any): void {
    if (!complaint) {
      return;
    }

    console.log(
      'Calling customer:',
      complaint.FULL_NAME
    );

    console.log(
      'Mobile:',
      complaint.MOBILE
    );
  }

  sendComplaintMessage(): void {

    if (!this.selectedComplaint) {
      return;
    }

    if (!this.complaintMessage.trim()) {
      return;
    }

    console.log(
      'Complaint ID:',
      this.selectedComplaint.COMPLAINT_ID
    );

    console.log(
      'Message:',
      this.complaintMessage
    );

    // API / DB connection will be added next

  }
}