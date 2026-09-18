import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.scss']
})
export class PaymentComponent implements OnInit {
  policy: any;
  loading = true;
  error = '';

  documents = [
    { key: 'policy-document', label: 'Policy Document' },
    { key: 'policy-schedule', label: 'Policy Schedule' },
    { key: 'tax-invoice', label: 'Tax Invoice' },
    { key: 'table-of-benefits', label: 'Table of Benefits' },
    { key: 'receipt-voucher', label: 'Receipt Voucher' }
  ];

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const policyNumber = this.route.snapshot.paramMap.get('policyNumber');

    if (!policyNumber) {
      this.error = 'No policy number provided';
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    this.http.get<any>(`http://localhost:5000/api/policies/${policyNumber}`).subscribe({
      next: res => {
        this.policy = res.data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.error = err?.error?.message || 'Policy not found';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  preview(docKey: string): void { console.log('Preview requested:', docKey); }
  download(docKey: string): void { console.log('Download requested:', docKey); }
  goHome(): void {
  sessionStorage.setItem('restoreChatOnLoad', 'true');
  sessionStorage.setItem('restoreChatOnLoadTime', Date.now().toString());
  window.location.href = '/';
}
}