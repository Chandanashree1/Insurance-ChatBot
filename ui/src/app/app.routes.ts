import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'policy-success/:policyNumber',
    title: 'Policy Confirmation',
    loadComponent: () =>
      import('./payment/payment.component')
        .then(m => m.PaymentComponent)
  },
  {
    path: 'underwriter',
    title: 'Underwriter Dashboard',
    loadComponent: () =>
      import('./underwriter/underwriter.component')
        .then(m => m.UnderwriterComponent)
  },
  {
    path: 'customer-service',
    title: 'Customer Service Dashboard',
    loadComponent: () =>
      import('./customer-service/customer-service.component')
        .then(m => m.CustomerServiceComponent)
  },
  {
    path: 'surveyor',
    title: 'Surveyor Dashboard',
    loadComponent: () =>
      import('./surveyor/surveyor.component')
        .then(m => m.SurveyorComponent)
  }
];