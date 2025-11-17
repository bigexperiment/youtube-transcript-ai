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
  tempTogetherApiKey: string = '';
  promptStep: number = 1; // 1 = Scrape Creators, 2 = Gemini, 3 = Together.ai
  isSpeaking: boolean = false;
  isPaused: boolean = false;
  generatingAudio: boolean = false;
  copyMessage: string = '';
  currentTime: number = 0;
  duration: number = 0;
  hasAudio: boolean = false; // Track if audio is available
  private currentAudio: HTMLAudioElement | null = null;
  private timeUpdateInterval: any = null;

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
      } else if (!this.storage.hasGeminiApiKey()) {
        this.promptStep = 2; // Then Gemini
      } else {
        this.promptStep = 3; // Finally Together.ai
      }
    } else {
      this.loadCredits();
    }
    
    // Load saved style preference
    this.summaryStyle = this.storage.getSummaryStyle();

    // Handle visibility change for background playback
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.currentAudio && this.isSpeaking && !this.isPaused) {
        // Audio should continue playing in background
        // No action needed, but we ensure it's not paused
      }
    });
  }

  ngOnDestroy(): void {
    // Stop any ongoing speech when component is destroyed
    this.stopSpeech();
    this.stopTimeUpdate();
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
        this.promptStep = 3; // Move to Together.ai key
        this.tempGeminiApiKey = '';
      }
    } else if (this.promptStep === 3) {
      // Save Together.ai API key
      if (this.tempTogetherApiKey.trim()) {
        this.storage.setTogetherApiKey(this.tempTogetherApiKey.trim());
        this.showApiKeyPrompt = false;
        this.loadCredits();
        this.tempTogetherApiKey = '';
      }
    }
  }

  skipStep(): void {
    if (this.promptStep === 2) {
      this.promptStep = 1; // Go back to Scrape Creators API key step
    } else if (this.promptStep === 3) {
      this.promptStep = 2; // Go back to Gemini API key step
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
   * Generate audio without playing
   */
  async generateAudio(): Promise<void> {
    if (!this.summary) {
      return;
    }

    // If audio already exists, don't regenerate
    if (this.hasAudio && this.currentAudio) {
      return;
    }

    // Get plain text from summary (strip HTML)
    const textToSpeak = this.stripHtml(this.summary);

    if (!textToSpeak.trim()) {
      return;
    }

    // Check if Together.ai API key exists
    if (!this.storage.hasTogetherApiKey()) {
      this.error = 'Together.ai API key not found. Please set your API key in settings.';
      return;
    }

    this.generatingAudio = true;
    this.cdr.detectChanges();

    try {
      // Generate audio using Together.ai API
      const audioBlob = await firstValueFrom(
        this.api.generateAudio(textToSpeak, 'af_heart')
      );

      // Create object URL from blob
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and configure audio element
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      // Ensure audio can play in background on mobile
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');

      // Wait for metadata to load
      await new Promise((resolve, reject) => {
        if (audio.readyState >= 1) {
          // Metadata already loaded
          this.duration = audio.duration;
          resolve(null);
        } else {
          audio.onloadedmetadata = () => {
            this.duration = audio.duration;
            resolve(null);
          };
          audio.onerror = reject;
          // Timeout fallback
          setTimeout(() => {
            if (audio.duration) {
              this.duration = audio.duration;
              resolve(null);
            } else {
              reject(new Error('Failed to load audio metadata'));
            }
          }, 5000);
        }
      });

      // Event handlers
      audio.onplay = () => {
        this.isSpeaking = true;
        this.isPaused = false;
        this.generatingAudio = false;
        this.startTimeUpdate();
        // Update Media Session
        if ('mediaSession' in navigator && navigator.mediaSession) {
          (navigator.mediaSession as any).playbackState = 'playing';
        }
        this.cdr.detectChanges();
      };

      audio.onpause = () => {
        this.isPaused = true;
        this.stopTimeUpdate();
        // Update Media Session
        if ('mediaSession' in navigator && navigator.mediaSession) {
          (navigator.mediaSession as any).playbackState = 'paused';
        }
        this.cdr.detectChanges();
      };

      audio.onended = () => {
        this.isSpeaking = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.stopTimeUpdate();
        this.currentAudio = null;
        this.hasAudio = false; // Mark audio as no longer available
        // Clear Media Session
        if ('mediaSession' in navigator && navigator.mediaSession) {
          (navigator.mediaSession as any).playbackState = 'none';
        }
        URL.revokeObjectURL(audioUrl); // Clean up
        this.cdr.detectChanges();
      };

      audio.onerror = (event) => {
        console.error('Audio playback error:', event);
        this.isSpeaking = false;
        this.isPaused = false;
        this.generatingAudio = false;
        this.stopTimeUpdate();
        this.currentAudio = null;
        this.hasAudio = false; // Mark audio as no longer available
        URL.revokeObjectURL(audioUrl);
        this.error = 'Failed to play audio. Please try again.';
        this.cdr.detectChanges();
      };

      // Update time on timeupdate event
      audio.ontimeupdate = () => {
        if (this.currentAudio) {
          this.currentTime = this.currentAudio.currentTime;
          this.cdr.detectChanges();
        }
      };

      this.currentAudio = audio;
      this.hasAudio = true; // Mark audio as available
      this.generatingAudio = false;
      
      // Set up Media Session API for better mobile background playback
      if ('mediaSession' in navigator && navigator.mediaSession) {
        const mediaSession = navigator.mediaSession as any;
        mediaSession.metadata = new (window as any).MediaMetadata({
          title: this.headline || 'Summary Audio',
          artist: 'YoutubeMagic',
        });
        
        mediaSession.setActionHandler('play', () => {
          this.resumeSpeech();
        });
        
        mediaSession.setActionHandler('pause', () => {
          this.pauseSpeech();
        });
        
        mediaSession.setActionHandler('stop', () => {
          this.stopSpeech();
        });
      }
      
      // Automatically play the audio after generation
      try {
        await audio.play();
      } catch (playErr: any) {
        console.error('Failed to auto-play audio:', playErr);
        // Audio will be available for manual play
      }
      
      this.cdr.detectChanges();
    } catch (err: any) {
      console.error('Failed to generate audio:', err);
      this.generatingAudio = false;
      this.error = err?.message || 'Failed to generate audio. Please try again.';
      this.cdr.detectChanges();
    }
  }

  /**
   * Play text-to-speech using Together.ai API
   */
  async playSpeech(): Promise<void> {
    if (!this.summary) {
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

    // If audio doesn't exist, generate it first
    if (!this.hasAudio || !this.currentAudio) {
      await this.generateAudio();
    }

    // Now play the audio if it exists
    if (this.currentAudio && this.hasAudio) {
      try {
        await this.currentAudio.play();
      } catch (err: any) {
        console.error('Failed to play audio:', err);
        this.error = 'Failed to play audio. Please try again.';
        this.cdr.detectChanges();
      }
    }
  }

  /**
   * Pause text-to-speech
   */
  pauseSpeech(): void {
    if (this.currentAudio && this.isSpeaking && !this.isPaused) {
      this.currentAudio.pause();
      this.isPaused = true;
      this.cdr.detectChanges();
    }
  }

  /**
   * Resume text-to-speech
   */
  async resumeSpeech(): Promise<void> {
    if (this.currentAudio && this.isPaused) {
      try {
        await this.currentAudio.play();
        this.isPaused = false;
        this.cdr.detectChanges();
      } catch (err) {
        console.error('Failed to resume audio:', err);
      }
    }
  }

  /**
   * Stop text-to-speech
   */
  stopSpeech(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      const src = this.currentAudio.src;
      if (src.startsWith('blob:')) {
        URL.revokeObjectURL(src);
      }
      this.currentAudio = null;
    }
    this.isSpeaking = false;
    this.isPaused = false;
    this.generatingAudio = false;
    this.currentTime = 0;
    this.hasAudio = false; // Mark audio as no longer available
    this.stopTimeUpdate();
    this.cdr.detectChanges();
  }

  /**
   * Start time update interval
   */
  private startTimeUpdate(): void {
    this.stopTimeUpdate();
    this.timeUpdateInterval = setInterval(() => {
      if (this.currentAudio) {
        this.currentTime = this.currentAudio.currentTime;
        this.cdr.detectChanges();
      }
    }, 100);
  }

  /**
   * Stop time update interval
   */
  private stopTimeUpdate(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  /**
   * Format time in MM:SS format
   */
  formatTime(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Seek audio to clicked position
   */
  seekAudio(event: MouseEvent): void {
    if (!this.currentAudio || !this.duration) return;
    
    const progressBar = event.currentTarget as HTMLElement;
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * this.duration;
    
    this.currentAudio.currentTime = newTime;
    this.currentTime = newTime;
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
    return this.summary.length > 0 && !this.generatingAudio;
  }

  /**
   * Copy transcript to clipboard
   */
  async copyTranscript(): Promise<void> {
    if (!this.transcriptData || !this.transcriptData.transcript || this.transcriptData.transcript.length === 0) {
      return;
    }

    // Format transcript as plain text with timestamps
    const transcriptText = this.transcriptData.transcript
      .map(item => `[${item.startTimeText}] ${item.text}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(transcriptText);
      this.showCopyMessage('Transcript copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy transcript:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = transcriptText;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        this.showCopyMessage('Transcript copied to clipboard!');
      } catch (fallbackErr) {
        this.showCopyMessage('Failed to copy. Please select and copy manually.');
      }
      document.body.removeChild(textArea);
    }
  }

  /**
   * Copy summary to clipboard
   */
  async copySummary(): Promise<void> {
    if (!this.summary) {
      return;
    }

    // Strip HTML tags and get plain text
    const plainText = this.stripHtml(this.summary);

    try {
      await navigator.clipboard.writeText(plainText);
      this.showCopyMessage('Summary copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy summary:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = plainText;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        this.showCopyMessage('Summary copied to clipboard!');
      } catch (fallbackErr) {
        this.showCopyMessage('Failed to copy. Please select and copy manually.');
      }
      document.body.removeChild(textArea);
    }
  }

  /**
   * Show copy confirmation message
   */
  showCopyMessage(message: string): void {
    this.copyMessage = message;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.copyMessage = '';
      this.cdr.detectChanges();
    }, 3000);
  }
}