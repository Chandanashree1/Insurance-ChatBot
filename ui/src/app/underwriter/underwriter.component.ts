import { Component, OnInit,ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

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
  // LOGIN STATE
  // ==================================================
  isLoggedIn = false;
  username = '';
  password = '';
  loginError = '';



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

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}


ngOnInit(): void {
    this.isLoggedIn = sessionStorage.getItem('underwriterAuth') === 'true';
    if (this.isLoggedIn) {
      this.loadProposals();
    }
}


loadProposals(): void {
    this.http.get<any>('http://localhost:5000/api/proposals').subscribe({
      next: (res) => {
        console.log('Proposals received:', res.data);
        this.proposals = res.data || [];
        this.cdr.detectChanges();   // ← force Angular to re-render now
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
        this.decisionSentLog.unshift({
          proposalNumber: this.selectedProposal!.proposalNumber,
          decision,
          time: new Date().toLocaleTimeString()
        });

        // Remove from pending list and clear selection
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
      this.loginError = '';
      this.loadProposals();   // ← fixed
    } else {
      this.loginError = 'Invalid username or password';
    }
}

logout(): void {
    sessionStorage.removeItem('underwriterAuth');
    this.isLoggedIn = false;
    this.username = '';
    this.password = '';
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
}