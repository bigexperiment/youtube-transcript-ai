import { Component, OnInit, OnDestroy, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api, TranscriptResponse } from './services/api';
import { Storage } from './services/storage';
import { Summary } from './services/summary';
import { Settings } from './components/settings/settings';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, RouterOutlet, Settings],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  youtubeUrl: string = '';
  summaryLength: number = 50;
  summaryStyle: string = 'essay';
  loading: boolean = false;
  fetchingTranscript: boolean = false;
  generatingSummary: boolean = false;
  transcriptData: TranscriptResponse | null = null;
  summary: string = '';
  headline: string = '';
  error: string = '';
  creditsRemaining: number | null = null;
  showSettings: boolean = false;
  showApiKeyPrompt: boolean = false;
  tempScrapeApiKey: string = '';
  tempGeminiApiKey: string = '';
  promptStep: number = 1; // 1 = Scrape Creators, 2 = Gemini
  isSpeaking: boolean = false;
  isPaused: boolean = false;
  private speechSynthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  showToast: boolean = false;
  toastMessage: string = '';

  constructor(
    private api: Api,
    private storage: Storage,
    private summaryService: Summary,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Check if all API keys exist
    if (!this.storage.hasAllApiKeys()) {
      this.showApiKeyPrompt = true;
      if (!this.storage.hasApiKey()) {
        this.promptStep = 1; // Scrape Creators first
      } else {
        this.promptStep = 2; // Then Gemini
      }
    } else {
      this.loadCredits();
    }
    
    // Load saved style preference
    this.summaryStyle = this.storage.getSummaryStyle();
    
    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
      this.speechSynthesis = window.speechSynthesis;
    }
  }

  ngOnDestroy(): void {
    // Stop any ongoing speech when component is destroyed
    this.stopSpeech();
  }

  loadCredits(): void {
    this.creditsRemaining = this.storage.getCreditsRemaining();
  }

  saveInitialApiKey(): void {
    if (this.promptStep === 1) {
      // Save Scrape Creators API key
      if (this.tempScrapeApiKey.trim()) {
        this.storage.setApiKey(this.tempScrapeApiKey.trim());
        this.promptStep = 2; // Move to Gemini key
        this.tempScrapeApiKey = '';
      }
    } else if (this.promptStep === 2) {
      // Save Gemini API key
      if (this.tempGeminiApiKey.trim()) {
        this.storage.setGeminiApiKey(this.tempGeminiApiKey.trim());
        this.showApiKeyPrompt = false;
        this.loadCredits();
        this.tempGeminiApiKey = '';
      }
    }
  }

  skipStep(): void {
    if (this.promptStep === 2) {
      this.promptStep = 1; // Go back to Scrape Creators API key step
    }
  }

  openSettings(): void {
    this.showSettings = true;
  }

  closeSettings(): void {
    this.showSettings = false;
    this.loadCredits();
  }

  onApiKeyUpdated(): void {
    this.loadCredits();
  }

  onStyleChange(): void {
    this.storage.setSummaryStyle(this.summaryStyle);
  }

  formatSummary(text: string): string {
    if (!text) return '';
    
    // For bullets, format bullet points
    if (this.summaryStyle === 'bullets') {
      return text.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
          return `<p class="bullet-point">${trimmed}</p>`;
        } else if (trimmed) {
          return `<p class="bullet-point">• ${trimmed}</p>`;
        }
        return '';
      }).join('');
    }
    
    // For timestamp, format with timestamps
    if (this.summaryStyle === 'timestamp') {
      return text.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed.match(/\[\d+:\d+\]/)) {
          return `<p class="timestamp-point"><span class="timestamp">${trimmed.match(/\[[\d:]+\]/)?.[0] || ''}</span>${trimmed.replace(/\[[\d:]+\]\s*/, '')}</p>`;
        } else if (trimmed) {
          return `<p>${trimmed}</p>`;
        }
        return '';
      }).join('');
    }
    
    // For essay, format paragraphs
    return text.split('\n\n').map(para => {
      const trimmed = para.trim();
      return trimmed ? `<p>${trimmed}</p>` : '';
    }).join('');
  }

  async getTranscript(): Promise<void> {
    // Check for API key
    if (!this.storage.hasApiKey()) {
      this.error = 'Please set your Scrape Creators API key in settings.';
      this.showSettings = true;
      return;
    }

    // Check credits
    const credits = this.storage.getCreditsRemaining();
    if (credits !== null && credits <= 0) {
      alert('You have no credits remaining. Please add credits to continue.');
      return;
    }

    if (!this.youtubeUrl.trim()) {
      this.error = 'Please enter a YouTube URL';
      return;
    }

    // Stop any ongoing speech
    this.stopSpeech();
    
    this.loading = true;
    this.fetchingTranscript = true;
    this.generatingSummary = false;
    this.error = '';
    this.transcriptData = null;
    this.summary = '';
    this.headline = '';

    try {
      const response = await firstValueFrom(this.api.getTranscript(this.youtubeUrl));
      
      if (response) {
        this.transcriptData = response;
        this.fetchingTranscript = false;
        
        // Update credits
        this.storage.setCreditsRemaining(response.credits_remaining);
        this.creditsRemaining = response.credits_remaining;

        // Generate summary using Gemini AI
        if (response.transcript && response.transcript.length > 0) {
          // Check for Gemini API key
          if (!this.storage.hasGeminiApiKey()) {
            this.error = 'Gemini API key not found. Please set your Gemini API key in settings.';
            this.showSettings = true;
            this.loading = false;
            return;
          }

          this.generatingSummary = true;
          console.log('Starting summary generation...');
          try {
            // Use streaming for better UX
            this.summaryService.generateSummaryStream(
              response.transcript,
              this.summaryLength,
              this.summaryStyle
            ).subscribe({
              next: (result: { summary: string; headline: string }) => {
                console.log('Received chunk in component, summary length:', result.summary.length);
                this.summary = result.summary;
                this.headline = result.headline;
                this.cdr.detectChanges(); // Force change detection
              },
              error: (err: any) => {
                console.error('Error generating summary in component:', err);
                // Fallback to non-streaming
                this.summaryService.generateSummary(
                  response.transcript,
                  this.summaryLength,
                  this.summaryStyle
                ).then(result => {
                  console.log('Fallback summary received:', result.summary.substring(0, 100));
                  this.summary = result.summary;
                  this.headline = result.headline;
                  this.generatingSummary = false;
                  this.cdr.detectChanges();
                }).catch(error => {
                  this.error = error?.message || 'Failed to generate summary. Please check your Gemini API key.';
                  this.generatingSummary = false;
                  this.cdr.detectChanges();
                });
              },
              complete: () => {
                console.log('Stream complete in component');
                this.generatingSummary = false;
                this.cdr.detectChanges();
              }
            });
          } catch (err: any) {
            // Fallback to non-streaming
            try {
              const result = await this.summaryService.generateSummary(
                response.transcript,
                this.summaryLength,
                this.summaryStyle
              );
              this.summary = result.summary;
              this.headline = result.headline;
            } catch (summaryError: any) {
              this.error = summaryError?.message || 'Failed to generate summary. Please check your Gemini API key.';
            }
            this.generatingSummary = false;
          }
        }

        // Check if credits are now 0
        if (response.credits_remaining <= 0) {
          setTimeout(() => {
            alert('You have no credits remaining. Please add credits to continue.');
          }, 500);
        }
      }
    } catch (err: any) {
      this.error = err?.message || 'Failed to fetch transcript. Please check your API key and try again.';
      console.error('Error fetching transcript:', err);
    } finally {
      this.loading = false;
    }
  }

  isButtonDisabled(): boolean {
    const credits = this.storage.getCreditsRemaining();
    return credits !== null && credits <= 0;
  }

  /**
   * Strips HTML tags from text for speech synthesis
   */
  stripHtml(html: string): string {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  /**
   * Play text-to-speech
   */
  playSpeech(): void {
    if (!this.summary || !this.speechSynthesis) {
      return;
    }

    // If already speaking, pause it
    if (this.isSpeaking && !this.isPaused) {
      this.pauseSpeech();
      return;
    }

    // If paused, resume
    if (this.isPaused) {
      this.resumeSpeech();
      return;
    }

    // Stop any current speech
    this.stopSpeech();

    // Get plain text from summary (strip HTML)
    const textToSpeak = this.stripHtml(this.summary);

    if (!textToSpeak.trim()) {
      return;
    }

    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Event handlers
    utterance.onstart = () => {
      this.isSpeaking = true;
      this.isPaused = false;
      this.currentUtterance = utterance;
      this.cdr.detectChanges();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
      this.cdr.detectChanges();
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
      this.cdr.detectChanges();
    };

    // Speak
    this.speechSynthesis.speak(utterance);
  }

  /**
   * Pause text-to-speech
   */
  pauseSpeech(): void {
    if (this.speechSynthesis && this.isSpeaking && !this.isPaused) {
      this.speechSynthesis.pause();
      this.isPaused = true;
      this.cdr.detectChanges();
    }
  }

  /**
   * Resume text-to-speech
   */
  resumeSpeech(): void {
    if (this.speechSynthesis && this.isPaused) {
      this.speechSynthesis.resume();
      this.isPaused = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Stop text-to-speech
   */
  stopSpeech(): void {
    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
      this.cdr.detectChanges();
    }
  }

  /**
   * Toggle text-to-speech (play/pause)
   */
  toggleSpeech(): void {
    if (this.isSpeaking && !this.isPaused) {
      this.pauseSpeech();
    } else if (this.isPaused) {
      this.resumeSpeech();
    } else {
      this.playSpeech();
    }
  }

  /**
   * Check if speech synthesis is available
   */
  isSpeechAvailable(): boolean {
    return 'speechSynthesis' in window && this.summary.length > 0;
  }

  /**
   * Copy summary to clipboard
   */
  async copySummary(): Promise<void> {
    if (!this.summary) return;

    try {
      const plainText = this.stripHtml(this.summary);
      await navigator.clipboard.writeText(plainText);
      this.displayToast('Summary copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy summary:', err);
      this.displayToast('Failed to copy summary');
    }
  }

  /**
   * Copy transcript to clipboard
   */
  async copyTranscript(): Promise<void> {
    if (!this.transcriptData?.transcript) return;

    try {
      const transcriptText = this.transcriptData.transcript
        .map(item => `[${item.startTimeText}] ${item.text}`)
        .join('\n');
      await navigator.clipboard.writeText(transcriptText);
      this.displayToast('Transcript copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy transcript:', err);
      this.displayToast('Failed to copy transcript');
    }
  }

  /**
   * Display toast notification
   */
  private displayToast(message: string): void {
    this.toastMessage = message;
    this.showToast = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.showToast = false;
      this.cdr.detectChanges();
    }, 3000);
  }
}