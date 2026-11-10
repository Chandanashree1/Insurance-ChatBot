import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

type Method = 'mobile' | 'civil' | 'policy';

@Component({
  selector: 'app-renewal-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './renewal-form.component.html',
  styleUrls: ['./renewal-form.component.scss']
})
export class RenewalFormComponent {
  @Input() customerId!: number;
  @Output() quoteReady = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  private api = 'http://localhost:5000/api';

  // typed by the user (normal fields)
  method: Method = 'mobile';
  plateNumber = '';
  plateCode = '';
  mobileNumber = '';
  civilId = '';
  policyNumber = '';
  vehicleValues: Record<number, number | null> = {};

  // state that changes after a server response (signals redraw the screen by themselves)
  loading = signal(false);
  renewingId = signal<number | null>(null);
  error = signal('');
  searched = signal(false);
  policies = signal<any[]>([]);

  found = computed(() => this.searched() && this.policies().length > 0);
  locked = computed(() => this.loading() || this.renewingId() !== null || this.found());

  private reasonText: Record<string, string> = {
    TOO_EARLY: 'Renewal is not open yet. You can renew from 30 days before your policy ends.',
    LAPSED: 'This policy expired more than 15 days ago and can’t be renewed. Please buy a new policy.',
    ALREADY_RENEWED: 'This policy has already been renewed.',
    CANCELLED: 'This policy was cancelled and can’t be renewed.'
  };

  constructor(private http: HttpClient) {}

  setMethod(m: Method): void {
    if (this.locked()) return;
    this.method = m;
    this.error.set('');
  }

  get canSearch(): boolean {
    if (!this.plateNumber.trim() || !this.plateCode.trim()) return false;
    if (this.method === 'mobile') return !!this.mobileNumber.trim();
    if (this.method === 'civil') return !!this.civilId.trim();
    return !!this.policyNumber.trim();
  }

  reasonFor(p: any): string {
    return this.reasonText[p.reason] || 'This policy can’t be renewed right now.';
  }

  searchAgain(): void {
    this.policies.set([]);
    this.searched.set(false);
    this.error.set('');
  }

  findPolicy(): void {
    if (!this.canSearch || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.policies.set([]);

    this.http.post<any>(`${this.api}/renewals/lookup`, {
      customerId: this.customerId,
      method: this.method,
      plateNumber: this.plateNumber.trim(),
      plateCode: this.plateCode.trim(),
      mobileNumber: this.mobileNumber.trim(),
      civilId: this.civilId.trim(),
      policyNumber: this.policyNumber.trim()
    }).subscribe({
      next: res => {
        const list = res?.data?.policies || [];
        list.forEach((p: any) => this.vehicleValues[p.policyId] = p.lastVehicleValue ?? null);
        this.policies.set(list);
        this.searched.set(true);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.message || 'Something went wrong. Please try again.');
        this.searched.set(true);
        this.loading.set(false);
      }
    });
  }

  renew(p: any): void {
    if (this.renewingId() !== null) return;
    const value = this.vehicleValues[p.policyId];
    if (p.needsVehicleValue && (!value || value <= 0)) {
      this.error.set('Please enter the vehicle value to renew a Comprehensive policy.');
      return;
    }
    this.renewingId.set(p.policyId);
    this.error.set('');

    this.http.post<any>(`${this.api}/renewals/quote`, {
      customerId: this.customerId,
      policyId: p.policyId,
      mobileNumber: this.method === 'mobile' ? this.mobileNumber.trim() : undefined,
      vehicleValue: p.needsVehicleValue ? value : undefined
    }).subscribe({
      next: res => {
        this.renewingId.set(null);
        this.quoteReady.emit(res.data);
      },
      error: err => {
        this.renewingId.set(null);
        this.error.set(err?.error?.message || 'Could not create the renewal quote.');
      }
    });
  }
}