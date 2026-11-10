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
  downloading = false;

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

  downloadPolicy(): void {
    if (!this.policy?.policyNumber) return;
    this.downloading = true;
    this.http.get(`http://localhost:5000/api/policies/${this.policy.policyNumber}/document`, {
      responseType: 'blob'
    }).subscribe({
     next: (blob) => {
  const pdf = new Blob([blob], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(pdf);

  const a = document.createElement('a');
  a.href = url;
  a.download = `Policy-${this.policy.policyNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Give the browser time to start reading the blob
  setTimeout(() => window.URL.revokeObjectURL(url), 10000);

  this.downloading = false;    
  this.cdr.detectChanges(); 

},
      error: () => {
        this.downloading = false;
        this.cdr.detectChanges();
      }
    });
  }

  goHome(): void {
    sessionStorage.setItem('restoreChatOnLoad', 'true');
    sessionStorage.setItem('restoreChatOnLoadTime', Date.now().toString());
    window.location.href = '/';
  }
}