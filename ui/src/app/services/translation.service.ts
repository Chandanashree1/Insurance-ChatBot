import { Injectable } from '@angular/core';
import { translations } from '../buy_policy/translations';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  lang: 'en' | 'ar' = 'en';

  t(key: keyof typeof translations.en): string {
    return translations[this.lang]?.[key] ?? translations.en[key] ?? key;
  }
}