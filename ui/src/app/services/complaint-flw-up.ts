import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ComplaintFlwUp {

  private apiUrl = 'http://localhost:5000/api/complaint-followup';


  constructor(private http: HttpClient) {}


  getNonStpComplaints(): Observable<any> {
    return this.http.get(
      this.apiUrl
    );
  }

  updateComplaintFollowUp(
  complaintId: number,
  status: string,
  agentNote: string
): Observable<any> {

  return this.http.put(
    `${this.apiUrl}/${complaintId}`,
    {
      status,
      agentNote
    }
  );

}
}