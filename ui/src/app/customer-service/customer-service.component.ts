import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { uwTranslations, UwKey, UwLang } from '../underwriter/underwriter.translations';
import { ComplaintFlwUp } from '../services/complaint-flw-up';

interface FeedbackItem {
  ratingId: number;
  customerId: number | null;
  sessionId: string;
  rating: number;
  feedback: string | null;
  language: string;
  followUpStatus: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'NOT_REQUIRED';
  createdAt: string;
}

export type CsSection = 'all' | 'complaints' | 'feedback';

@Component({
  selector: 'app-customer-service',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-service.component.html',
  styleUrls: ['../underwriter/underwriter.component.scss']
})
export class CustomerServiceComponent implements OnInit {

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private flwUp: ComplaintFlwUp
  ) { }

  // ================= LANGUAGE =================
  selectedLanguage: UwLang = 'en';

  t(key: UwKey): string {
    return uwTranslations[this.selectedLanguage]?.[key] ?? uwTranslations.en[key] ?? key;
  }

  tr(en: string, ar: string): string {
    return this.selectedLanguage === 'ar' ? ar : en;
  }

  switchLanguage(lang: UwLang): void {
    this.selectedLanguage = lang;
    try { localStorage.setItem('underwriterLang', lang); } catch { /* ignore */ }
    this.cdr.markForCheck();
  }

  // ================= SECTION TABS =================
  activeSection: CsSection = 'all';

  setSection(section: Exclude<CsSection, 'all'>): void {
    this.activeSection = this.activeSection === section ? 'all' : section;
  }

  showAll(): void {
    this.activeSection = 'all';
  }

  isVisible(section: Exclude<CsSection, 'all'>): boolean {
    return this.activeSection === 'all' || this.activeSection === section;
  }

  // ================= LOGIN (separate from underwriter) =================
  isLoggedIn = false;
  username = '';
  password = '';
  loginFailed = false;

  ngOnInit(): void {
    try {
      const saved = localStorage.getItem('underwriterLang');
      if (saved === 'en' || saved === 'ar') this.selectedLanguage = saved;
    } catch { /* ignore */ }

    this.isLoggedIn = sessionStorage.getItem('csAuth') === 'true';
    if (this.isLoggedIn) {
      this.loadComplaints();
      this.loadFeedback();
    }
  }

  onLogin(): void {
    if (this.username === 'customerservice' && this.password === 'demo123') {
      sessionStorage.setItem('csAuth', 'true');
      this.isLoggedIn = true;
      this.loginFailed = false;
      this.loadComplaints();
      this.loadFeedback();
    } else {
      this.loginFailed = true;
    }
  }

  logout(): void {
    sessionStorage.removeItem('csAuth');
    this.isLoggedIn = false;
    this.username = '';
    this.password = '';
    this.loginFailed = false;
  }

  // ================= SEARCH =================
  complaintSearch = '';
  feedbackSearch = '';

  private matches(term: string, ...values: unknown[]): boolean {
    const q = term.trim().toLowerCase();
    if (!q) return true;
    return values.some(v => String(v ?? '').toLowerCase().includes(q));
  }

  get filteredComplaints(): any[] {
    return this.complaints.filter(c =>
      this.matches(this.complaintSearch, c.COMPLAINT_ID, c.FULL_NAME, c.SUBJECT, c.PRODUCT));
  }

  // ================= COMPLAINTS =================
  complaints: any[] = [];
  selectedComplaint: any = null;
  complaintMessage = '';
  complaintLog: { complaintId: number; customer: string; time: string }[] = [];

  isCalling = false;
  callingCustomer: any = null;

  loadComplaints(): void {
    this.flwUp.getNonStpComplaints().subscribe({
      next: (response) => {
        this.complaints = response.complaints;
        this.cdr.detectChanges();
      },
      error: (error) => console.error('Error loading complaints:', error)
    });
  }

  selectComplaint(complaint: any): void {
    this.selectedComplaint = complaint;
    this.complaintMessage = '';
  }

  callCustomer(complaint: any): void {
    this.callingCustomer = complaint;
    this.isCalling = true;
  }

  endCall(): void {
    this.isCalling = false;
    this.callingCustomer = null;
  }

  sendComplaintMessage(): void {
    if (!this.selectedComplaint) return;

    const message = this.complaintMessage.trim();
    if (!message) return;

    const complaint = this.selectedComplaint;

    this.flwUp.updateComplaintFollowUp(complaint.COMPLAINT_ID, 'COMPLETED', message).subscribe({
      next: () => {
        this.complaintLog.unshift({
          complaintId: complaint.COMPLAINT_ID,
          customer: complaint.FULL_NAME,
          time: new Date().toLocaleTimeString()
        });
        this.complaints = this.complaints.filter(c => c.COMPLAINT_ID !== complaint.COMPLAINT_ID);
        this.selectedComplaint = null;
        this.complaintMessage = '';
        this.cdr.detectChanges();
      },
      error: (error) => console.error('Complaint message save error:', error)
    });
  }

  closeComplaintMessage(): void {
    this.selectedComplaint = null;
  }

  // ================= FEEDBACK =================
  feedbackGood: FeedbackItem[] = [];
  feedbackBad: FeedbackItem[] = [];
  selectedFeedback: FeedbackItem | null = null;
  feedbackView: 'bad' | 'resolved' | 'good' = 'bad';
  isLoadingFeedback = false;
  feedbackError = false;
  feedbackLog: { ratingId: number; status: string; time: string }[] = [];

  get feedbackOpen(): FeedbackItem[] {
    return this.feedbackBad.filter(f => f.followUpStatus !== 'RESOLVED');
  }

  get feedbackResolved(): FeedbackItem[] {
    return this.feedbackBad.filter(f => f.followUpStatus === 'RESOLVED');
  }

  get pendingFeedbackCount(): number {
    return this.feedbackOpen.length;
  }

  get filteredFeedback(): FeedbackItem[] {
    const list =
      this.feedbackView === 'bad' ? this.feedbackOpen :
        this.feedbackView === 'resolved' ? this.feedbackResolved :
          this.feedbackGood;

    return list.filter(f =>
      this.matches(this.feedbackSearch, f.ratingId, f.feedback, f.customerId, f.followUpStatus));
  }

  loadFeedback(): void {
    this.isLoadingFeedback = true;
    this.feedbackError = false;

    this.http.get<any>('http://localhost:5000/api/rating/feedback').subscribe({
      next: (res) => {
        this.feedbackGood = res?.good ?? [];
        this.feedbackBad = res?.bad ?? [];
        const all = [...this.feedbackGood, ...this.feedbackBad];
        if (this.selectedFeedback) {
          this.selectedFeedback =
            all.find(f => f.ratingId === this.selectedFeedback!.ratingId) ?? null;
        }
        this.isLoadingFeedback = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Feedback load failed:', err);
        this.feedbackError = true;
        this.isLoadingFeedback = false;
        this.cdr.detectChanges();
      }
    });
  }

  setFeedbackView(view: 'bad' | 'resolved' | 'good'): void {
    this.feedbackView = view;
    this.selectedFeedback = null;
  }

  selectFeedback(item: FeedbackItem): void {
    this.selectedFeedback = item;
  }

  updateFeedbackStatus(item: FeedbackItem, status: 'IN_PROGRESS' | 'RESOLVED'): void {
    this.http.patch<any>(
      `http://localhost:5000/api/rating/follow-ups/${item.ratingId}`,
      { status }
    ).subscribe({
      next: () => {
        item.followUpStatus = status;
        this.feedbackLog.unshift({
          ratingId: item.ratingId,
          status,
          time: new Date().toLocaleTimeString()
        });
        if (status === 'RESOLVED') this.selectedFeedback = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Follow-up update failed:', err);
        alert(this.tr('Could not update the follow-up status.', 'تعذر تحديث حالة المتابعة.'));
      }
    });
  }

  stars(n: number): string {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  feedbackStatusLabel(code: string): string {
    const map: Record<string, [string, string]> = {
      PENDING: ['Pending', 'قيد الانتظار'],
      IN_PROGRESS: ['In progress', 'قيد المتابعة'],
      RESOLVED: ['Resolved', 'تم الحل'],
      NOT_REQUIRED: ['No action needed', 'لا يلزم إجراء']
    };
    const m = map[code];
    return m ? this.tr(m[0], m[1]) : code;
  }
}