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
  togetherApiKey: string = '';
  creditsRemaining: number | null = null;
  
  // Display values (masked)
  displayApiKey: string = '';
  displayGeminiApiKey: string = '';
  displayTogetherApiKey: string = '';
  
  // Track if user is editing
  editingApiKey: boolean = false;
  editingGeminiApiKey: boolean = false;
  editingTogetherApiKey: boolean = false;

  constructor(private storage: Storage) {
    this.loadSettings();
  }

  /**
   * Mask the middle 10 characters of an API key
   */
  maskApiKey(key: string): string {
    if (!key || key.length <= 10) {
      return '••••••••••';
    }
    
    const start = Math.max(0, Math.floor((key.length - 10) / 2));
    const end = start + 10;
    const masked = key.substring(0, start) + '••••••••••' + key.substring(end);
    return masked;
  }

  loadSettings(): void {
    const savedKey = this.storage.getApiKey();
    if (savedKey) {
      this.apiKey = savedKey;
      this.displayApiKey = this.maskApiKey(savedKey);
    }
    
    const savedGeminiKey = this.storage.getGeminiApiKey();
    if (savedGeminiKey) {
      this.geminiApiKey = savedGeminiKey;
      this.displayGeminiApiKey = this.maskApiKey(savedGeminiKey);
    }
    
    const savedTogetherKey = this.storage.getTogetherApiKey();
    if (savedTogetherKey) {
      this.togetherApiKey = savedTogetherKey;
      this.displayTogetherApiKey = this.maskApiKey(savedTogetherKey);
    }
    
    this.creditsRemaining = this.storage.getCreditsRemaining();
  }

  startEditing(keyType: 'apiKey' | 'geminiApiKey' | 'togetherApiKey'): void {
    if (keyType === 'apiKey') {
      this.editingApiKey = true;
      this.displayApiKey = this.apiKey;
      // Select all text after a short delay to ensure input is focused
      setTimeout(() => {
        const input = document.getElementById('apiKey') as HTMLInputElement;
        if (input) input.select();
      }, 10);
    } else if (keyType === 'geminiApiKey') {
      this.editingGeminiApiKey = true;
      this.displayGeminiApiKey = this.geminiApiKey;
      setTimeout(() => {
        const input = document.getElementById('geminiApiKey') as HTMLInputElement;
        if (input) input.select();
      }, 10);
    } else if (keyType === 'togetherApiKey') {
      this.editingTogetherApiKey = true;
      this.displayTogetherApiKey = this.togetherApiKey;
      setTimeout(() => {
        const input = document.getElementById('togetherApiKey') as HTMLInputElement;
        if (input) input.select();
      }, 10);
    }
  }

  cancelEditing(keyType: 'apiKey' | 'geminiApiKey' | 'togetherApiKey'): void {
    if (keyType === 'apiKey') {
      this.editingApiKey = false;
      this.displayApiKey = this.maskApiKey(this.apiKey);
    } else if (keyType === 'geminiApiKey') {
      this.editingGeminiApiKey = false;
      this.displayGeminiApiKey = this.maskApiKey(this.geminiApiKey);
    } else if (keyType === 'togetherApiKey') {
      this.editingTogetherApiKey = false;
      this.displayTogetherApiKey = this.maskApiKey(this.togetherApiKey);
    }
  }

  saveApiKey(): void {
    const newKey = this.displayApiKey.trim();
    if (newKey) {
      // Check if it's different from the masked version or the original
      const masked = this.maskApiKey(this.apiKey);
      if (newKey !== masked && newKey !== this.apiKey) {
        this.apiKey = newKey;
        this.storage.setApiKey(newKey);
        this.apiKeyUpdated.emit(newKey);
      }
    }
    this.editingApiKey = false;
    this.displayApiKey = this.maskApiKey(this.apiKey);
  }

  saveGeminiApiKey(): void {
    const newKey = this.displayGeminiApiKey.trim();
    if (newKey) {
      const masked = this.maskApiKey(this.geminiApiKey);
      if (newKey !== masked && newKey !== this.geminiApiKey) {
        this.geminiApiKey = newKey;
        this.storage.setGeminiApiKey(newKey);
        this.apiKeyUpdated.emit(newKey);
      }
    }
    this.editingGeminiApiKey = false;
    this.displayGeminiApiKey = this.maskApiKey(this.geminiApiKey);
  }

  saveTogetherApiKey(): void {
    const newKey = this.displayTogetherApiKey.trim();
    if (newKey) {
      const masked = this.maskApiKey(this.togetherApiKey);
      if (newKey !== masked && newKey !== this.togetherApiKey) {
        this.togetherApiKey = newKey;
        this.storage.setTogetherApiKey(newKey);
        this.apiKeyUpdated.emit(newKey);
      }
    }
    this.editingTogetherApiKey = false;
    this.displayTogetherApiKey = this.maskApiKey(this.togetherApiKey);
  }

  saveAllKeys(): void {
    this.saveApiKey();
    this.saveGeminiApiKey();
    this.saveTogetherApiKey();
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