import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Storage } from '../../services/storage';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, CommonModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() apiKeyUpdated = new EventEmitter<string>();

  apiKey: string = '';
  geminiApiKey: string = '';
  creditsRemaining: number | null = null;

  constructor(private storage: Storage) {
    this.loadSettings();
  }

  loadSettings(): void {
    const savedKey = this.storage.getApiKey();
    if (savedKey) {
      this.apiKey = savedKey;
    }
    const savedGeminiKey = this.storage.getGeminiApiKey();
    if (savedGeminiKey) {
      this.geminiApiKey = savedGeminiKey;
    }
    this.creditsRemaining = this.storage.getCreditsRemaining();
  }

  saveApiKey(): void {
    if (this.apiKey.trim()) {
      this.storage.setApiKey(this.apiKey.trim());
      this.apiKeyUpdated.emit(this.apiKey.trim());
    }
  }

  saveGeminiApiKey(): void {
    if (this.geminiApiKey.trim()) {
      this.storage.setGeminiApiKey(this.geminiApiKey.trim());
      this.apiKeyUpdated.emit(this.geminiApiKey.trim());
    }
  }

  saveAllKeys(): void {
    this.saveApiKey();
    this.saveGeminiApiKey();
    this.closeModal();
  }

  closeModal(): void {
    this.isOpen = false;
    this.close.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }
}