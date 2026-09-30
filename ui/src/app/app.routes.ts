// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'policy-success/:policyNumber',
    loadComponent: () =>
      import('./payment/payment.component')
        .then(m => m.PaymentComponent)
  },

{
  path: 'underwriter',
  loadComponent: () => import('./underwriter/underwriter.component')
    .then(m => m.UnderwriterComponent)
}


];