import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Storage } from './storage';

export interface TranscriptItem {
  text: string;
  startMs: string;
  endMs: string;
  startTimeText: string;
}

export interface TranscriptResponse {
  success: boolean;
  credits_remaining: number;
  videoId: string;
  type: string;
  url: string;
  transcript: TranscriptItem[];
}

@Injectable({
  providedIn: 'root',
})
export class Api {
  private readonly API_BASE_URL = 'https://api.scrapecreators.com/v1/youtube/video/transcript';

  constructor(
    private http: HttpClient,
    private storage: Storage
  ) {}

  /**
   * Extracts video ID from various YouTube URL formats
   */
  extractVideoId(url: string): string | null {
    // Remove whitespace
    url = url.trim();

    // Patterns for different YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|m\.youtube\.com\/watch\?v=|youtube\.com\/v\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  getTranscript(videoUrlOrId: string): Observable<TranscriptResponse> {
    const videoId = this.extractVideoId(videoUrlOrId);
    
    if (!videoId) {
      throw new Error('Invalid YouTube URL or video ID');
    }

    // Format as full YouTube URL: https://www.youtube.com/watch?v={VIDEO_ID}
    const formattedUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const apiKey = this.storage.getApiKey();
    if (!apiKey) {
      throw new Error('API key not found. Please set your Scrape Creators API key in settings.');
    }

    const headers = new HttpHeaders({
      'x-api-key': apiKey
    });

    // Send the formatted URL as the url parameter
    const params = new HttpParams().set('url', formattedUrl);

    return this.http.get<TranscriptResponse>(this.API_BASE_URL, {
      headers,
      params
    });
  }

  /**
   * Generate audio using Together.ai API
   */
  generateAudio(text: string, voice: string = 'af_heart'): Observable<Blob> {
    const apiKey = this.storage.getTogetherApiKey();
    if (!apiKey) {
      return throwError(() => new Error('Together.ai API key not found. Please set your API key in settings.'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    });

    const body = {
      model: 'hexgrad/Kokoro-82M',
      input: text,
      voice: voice,
      stream: false
    };

    return this.http.post('https://api.together.xyz/v1/audio/generations', body, {
      headers,
      responseType: 'blob'
    }).pipe(
      catchError((error) => {
        console.error('Together.ai API error:', error);
        return throwError(() => new Error('Failed to generate audio. Please try again.'));
      })
    );
  }
}