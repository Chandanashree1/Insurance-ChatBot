import { Component, OnInit } from '@angular/core';
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

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

 ngOnInit(): void {

  const policyNumber =
    this.route.snapshot.paramMap.get('policyNumber');

  if (!policyNumber) {
    this.error = 'No policy number provided';
    this.loading = false;
    return;
  }

  console.log('Fetching policy:', policyNumber);

  this.http
    .get<any>(
      `http://localhost:5000/api/policies/${policyNumber}`
    )
    .subscribe({

      next: res => {

        console.log('Policy API response:', res);

        this.policy = res.data;
        this.loading = false;

      },

      error: err => {

        console.error('Policy API error:', err);

        this.error =
          err?.error?.message ||
          'Policy not found';

        this.loading = false;

      }

    });
}
  preview(docKey: string): void {
    // Placeholder until document-generation endpoints exist
    console.log('Preview requested:', docKey);
  }

  download(docKey: string): void {
    // Placeholder until document-generation endpoints exist
    console.log('Download requested:', docKey);
  }

  goHome(): void {
    window.location.href = '/';
  }
}