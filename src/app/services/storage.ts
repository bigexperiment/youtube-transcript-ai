import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Storage {
  private readonly API_KEY_STORAGE_KEY = 'scrape_creators_api_key';
  private readonly GEMINI_API_KEY_STORAGE_KEY = 'gemini_api_key';
  private readonly CREDITS_STORAGE_KEY = 'scrape_creators_credits';
  private readonly SUMMARY_STYLE_KEY = 'summary_style';

  getApiKey(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(this.API_KEY_STORAGE_KEY);
    }
    return null;
  }

  setApiKey(key: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.API_KEY_STORAGE_KEY, key);
    }
  }

  getGeminiApiKey(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(this.GEMINI_API_KEY_STORAGE_KEY);
    }
    return null;
  }

  setGeminiApiKey(key: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.GEMINI_API_KEY_STORAGE_KEY, key);
    }
  }

  getCreditsRemaining(): number | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      const credits = localStorage.getItem(this.CREDITS_STORAGE_KEY);
      return credits ? parseInt(credits, 10) : null;
    }
    return null;
  }

  setCreditsRemaining(credits: number): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.CREDITS_STORAGE_KEY, credits.toString());
    }
  }

  hasApiKey(): boolean {
    return this.getApiKey() !== null;
  }

  hasGeminiApiKey(): boolean {
    return this.getGeminiApiKey() !== null;
  }

  hasAllApiKeys(): boolean {
    return this.hasApiKey() && this.hasGeminiApiKey();
  }

  getSummaryStyle(): string {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(this.SUMMARY_STYLE_KEY) || 'essay';
    }
    return 'essay';
  }

  setSummaryStyle(style: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.SUMMARY_STYLE_KEY, style);
    }
  }
}