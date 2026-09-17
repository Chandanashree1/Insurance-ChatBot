import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface QuoteOption {
  optionId: number;
  optionNumber: number;
  planName: string;
  premium: number;
  coverageDetails: string;
  details?: string;
}

export interface CreateQuotePayload {
  mobileNumber: string;
  fullName: string;
  civilIdLicenseNo: string;
  plateNumber: string;
  plateCode: string;
  productId: string;      // 'COMPREHENSIVE' | 'THIRD_PARTY'
  vehicleValue?: number;
}

export interface CreateQuoteResponse {
  success: boolean;
  message: string;
  data: {
    quote: any;
    vehicle: {
      vehicleId: number;
      plateNumber: string;
      plateCode: string;
      plateType: string;
      make: string;
      model: string;
      year: number;
      chassisNumber: string;
      bodyType: string;
      usageType: string;
    };
    options: QuoteOption[];
  };
}

@Injectable({ providedIn: 'root' })
export class QuoteService {

  // Adjust to your actual API base URL / environment config
   private baseUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient) {}

  createMotorQuote(payload: CreateQuotePayload): Observable<CreateQuoteResponse> {
    return this.http.post<CreateQuoteResponse>(`${this.baseUrl}/quotes`, payload);
  }

  selectOption(quoteId: number, optionId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/quotes/select-option`, { quoteId, optionId });
  }

  processPayment(quoteId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/payments`, { quoteId });
  }

  createPolicy(quoteId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/policies`, { quoteId });
  }
}