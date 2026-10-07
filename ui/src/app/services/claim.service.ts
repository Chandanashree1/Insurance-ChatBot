import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

/**
 * Display hint only. The backend (STP_CLAIM_THRESHOLD in claimService.js)
 * is the source of truth for whether a claim is auto-approved.
 */
export const STP_CLAIM_THRESHOLD = 500;

export interface ClaimPolicy {
  policyId: number | null;
  policyNumber: string;
  customerName: string;
  mobileNumber: string;
  productName: string;
  vehicle: string;
  plate: string;
  coverFrom: string | null;
  coverTo: string | null;
}

export interface PendingClaim {
  claimId: number;
  claimNumber: string;
  policyNumber: string;
  customerName: string;
  productName: string;
  incidentDate: string | null;
  description: string;
  claimAmount: number;
  imagePath: string | null;
  submittedAt: string | null;
}

export interface SubmitClaimResult {
  claimId: number;
  claimNumber: string;
  status: 'STP_APPROVED' | 'PENDING' | string;
  claimAmount: number;
  approvedAmount: number | null;
}

/** First defined, non-null value among the given keys (handles Oracle's UPPER_CASE columns or camelCase). */
const pick = (row: any, ...keys: string[]) => {
  for (const k of keys) {
    if (row && row[k] !== undefined && row[k] !== null) return row[k];
  }
  return null;
};

@Injectable({ providedIn: 'root' })
export class ClaimService {
  private origin = 'http://localhost:5000';
  private baseUrl = `${this.origin}/api`;

  constructor(private http: HttpClient) {}

  // ---------- underwriter: policy lookup ----------
  lookupPolicy(policyNumber: string): Observable<ClaimPolicy> {
    return this.http
      .get<any>(`${this.baseUrl}/claims/policy/${encodeURIComponent(policyNumber)}`)
      .pipe(map(res => {
        const r = res?.data ?? res?.policy ?? res;
        const policy = this.toPolicy(r);
        if (!policy.policyNumber) throw new Error(res?.message || 'Policy not found');
        return policy;
      }));
  }

  // ---------- underwriter: file claim (multipart) ----------
  submitClaim(form: FormData): Observable<SubmitClaimResult> {
    return this.http
      .post<any>(`${this.baseUrl}/claims`, form)
      .pipe(map(res => {
        const r = res?.data ?? res?.claim ?? res;
        return {
          claimId: pick(r, 'claimId', 'CLAIM_ID'),
          claimNumber: pick(r, 'claimNumber', 'CLAIM_NUMBER'),
          status: pick(r, 'status', 'claimStatus', 'CLAIM_STATUS'),
          claimAmount: Number(pick(r, 'claimAmount', 'CLAIM_AMOUNT')),
          approvedAmount: pick(r, 'approvedAmount', 'APPROVED_AMOUNT')
        } as SubmitClaimResult;
      }));
  }

  // ---------- underwriter: review queue ----------
  getPendingClaims(): Observable<PendingClaim[]> {
    return this.http
      .get<any>(`${this.baseUrl}/claims/pending`)
      .pipe(map(res => {
        const rows: any[] = res?.data ?? res?.claims ?? (Array.isArray(res) ? res : []);
        return rows.map(r => ({
          claimId: pick(r, 'claimId', 'CLAIM_ID'),
          claimNumber: pick(r, 'claimNumber', 'CLAIM_NUMBER'),
          policyNumber: pick(r, 'policyNumber', 'POLICY_NUMBER'),
          customerName: pick(r, 'customerName', 'CUSTOMER_NAME'),
          productName: pick(r, 'productName', 'PRODUCT_NAME'),
          incidentDate: pick(r, 'incidentDate', 'INCIDENT_DATE'),
          description: pick(r, 'description', 'DESCRIPTION') ?? '',
          claimAmount: Number(pick(r, 'claimAmount', 'CLAIM_AMOUNT')),
          imagePath: pick(r, 'imagePath', 'IMAGE_PATH'),
          submittedAt: pick(r, 'submittedAt', 'SUBMITTED_AT')
        } as PendingClaim));
      }));
  }

  decideClaim(
    claimId: number,
    decision: 'APPROVED' | 'DECLINED',
    note: string | null,
    approvedAmount: number | null
  ): Observable<any> {
    return this.http.patch(`${this.baseUrl}/claims/${claimId}/decision`, {
      decision,
      note,
      approvedAmount
    });
  }

  /** Turns the stored relative IMAGE_PATH into a URL served by express.static("/uploads"). */
  imageUrl(path: string | null): string | null {
    if (!path) return null;
    return `${this.origin}/${path.replace(/\\/g, '/').replace(/^\/+/, '')}`;
  }

  private toPolicy(r: any): ClaimPolicy {
    const vehicle = [pick(r, 'MAKE', 'make'), pick(r, 'MODEL', 'model'), pick(r, 'YEAR', 'year')]
      .filter(Boolean).join(' ');
    const plate = [pick(r, 'PLATE_CODE', 'plateCode'), pick(r, 'PLATE_NUMBER', 'plateNumber')]
      .filter(Boolean).join(' ');
    return {
      policyId: pick(r, 'POLICY_ID', 'policyId'),
      policyNumber: pick(r, 'POLICY_NUMBER', 'policyNumber') ?? '',
      customerName: pick(r, 'CUSTOMER_NAME', 'customerName') ?? '',
      mobileNumber: pick(r, 'MOBILE_NUMBER', 'mobileNumber') ?? '',
      productName: pick(r, 'PRODUCT_NAME', 'productName') ?? '',
      vehicle,
      plate,
      coverFrom: pick(r, 'COVER_FROM', 'coverFrom'),
      coverTo: pick(r, 'COVER_TO', 'coverTo')
    };
  }
}