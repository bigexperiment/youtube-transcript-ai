import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { TranscriptItem } from './api';
import { Storage } from './storage';

export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class Summary {
  private readonly GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

  constructor(
    private http: HttpClient,
    private storage: Storage
  ) {}

  /**
   * Generates a summary from transcript using Gemini AI with streaming support
   */
  async generateSummary(transcript: TranscriptItem[], lengthPercentage: number, style: string = 'essay'): Promise<{ summary: string; headline: string }> {
    if (!transcript || transcript.length === 0) {
      return { summary: 'No transcript available.', headline: '' };
    }

    const geminiApiKey = this.storage.getGeminiApiKey();
    if (!geminiApiKey) {
      throw new Error('Gemini API key not found. Please set your Gemini API key in settings.');
    }

    // Combine all transcript text with timestamps for timestamp style
    const fullText = transcript.map(item => item.text).join(' ');
    const transcriptWithTimestamps = transcript.map(item => `[${item.startTimeText}] ${item.text}`).join('\n');

    // Style instructions
    let styleInstruction = '';
    if (style === 'bullets') {
      styleInstruction = 'Format the summary as bullet points, with each main point on a new line starting with •';
    } else if (style === 'timestamp') {
      styleInstruction = 'Format the summary with timestamps from the transcript. Include the timestamp in [HH:MM] format before each key point.';
    } else {
      styleInstruction = 'Format the summary as a cohesive essay with paragraphs.';
    }

    // Create prompt with length requirement, style, headline, and neutral instructions
    const transcriptText = style === 'timestamp' ? transcriptWithTimestamps : fullText;
    const prompt = `You are a neutral transcription summarizer. Your task is to create an objective summary of the following YouTube video transcript.

CRITICAL INSTRUCTIONS:
- Provide ONLY a factual, neutral summary of what was said in the transcript
- Do NOT add your own opinions, perspectives, analysis, or conclusions
- Do NOT interpret, judge, or evaluate the content
- Simply summarize what was actually said, without commentary
- Maintain complete objectivity and neutrality

REQUIREMENTS:
1. First, generate a concise headline (maximum 80 characters) that summarizes the main topic
2. Then provide a summary that is approximately ${lengthPercentage}% of the original transcript length
3. ${styleInstruction}

Format your response EXACTLY as follows:
HEADLINE: [Your headline here]

SUMMARY:
[Your summary here]

Transcript:
${transcriptText}`;

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-goog-api-key': geminiApiKey
    });

    const body = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };

    try {
      const response = await firstValueFrom(this.http.post<GeminiResponse>(this.GEMINI_API_URL, body, { headers }));
      
      if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const fullText = response.candidates[0].content.parts[0].text;
        return this.parseSummaryResponse(fullText);
      }
      
      throw new Error('Invalid response from Gemini API');
    } catch (error: any) {
      console.error('Error generating summary with Gemini:', error);
      throw new Error(error?.error?.error?.message || 'Failed to generate summary with Gemini AI');
    }
  }

  /**
   * Parses the summary response to extract headline and summary
   */
  private parseSummaryResponse(text: string): { summary: string; headline: string } {
    const headlineMatch = text.match(/HEADLINE:\s*(.+?)(?:\n|$)/i);
    const headline = headlineMatch ? headlineMatch[1].trim() : '';
    
    const summaryMatch = text.match(/SUMMARY:\s*([\s\S]+)/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : text.trim();
    
    return { summary, headline };
  }

  /**
   * Generates a summary with streaming support using Gemini API
   */
  generateSummaryStream(transcript: TranscriptItem[], lengthPercentage: number, style: string = 'essay'): Observable<{ summary: string; headline: string }> {
    const subject = new Subject<{ summary: string; headline: string }>();
    
    if (!transcript || transcript.length === 0) {
      subject.next({ summary: 'No transcript available.', headline: '' });
      subject.complete();
      return subject.asObservable();
    }

    const geminiApiKey = this.storage.getGeminiApiKey();
    if (!geminiApiKey) {
      subject.error(new Error('Gemini API key not found. Please set your Gemini API key in settings.'));
      return subject.asObservable();
    }

    // Combine all transcript text with timestamps for timestamp style
    const fullText = transcript.map(item => item.text).join(' ');
    const transcriptWithTimestamps = transcript.map(item => `[${item.startTimeText}] ${item.text}`).join('\n');

    // Style instructions
    let styleInstruction = '';
    if (style === 'bullets') {
      styleInstruction = 'Format the summary as bullet points, with each main point on a new line starting with •';
    } else if (style === 'timestamp') {
      styleInstruction = 'Format the summary with timestamps from the transcript. Include the timestamp in [HH:MM] format before each key point.';
    } else {
      styleInstruction = 'Format the summary as a cohesive essay with paragraphs.';
    }

    // Create prompt with length requirement, style, headline, and neutral instructions
    const transcriptText = style === 'timestamp' ? transcriptWithTimestamps : fullText;
    const prompt = `You are a neutral transcription summarizer. Your task is to create an objective summary of the following YouTube video transcript.

CRITICAL INSTRUCTIONS:
- Provide ONLY a factual, neutral summary of what was said in the transcript
- Do NOT add your own opinions, perspectives, analysis, or conclusions
- Do NOT interpret, judge, or evaluate the content
- Simply summarize what was actually said, without commentary
- Maintain complete objectivity and neutrality

REQUIREMENTS:
1. First, generate a concise headline (maximum 80 characters) that summarizes the main topic
2. Then provide a summary that is approximately ${lengthPercentage}% of the original transcript length
3. ${styleInstruction}

Format your response EXACTLY as follows:
HEADLINE: [Your headline here]

SUMMARY:
[Your summary here]

Transcript:
${transcriptText}`;

    // Use streamGenerateContent endpoint for streaming
    const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:streamGenerateContent?key=${geminiApiKey}`;
    
    const body = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };

    // Use fetch API for streaming with proper SSE handling
    fetch(streamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    }).then(async (response) => {
      console.log('Stream response status:', response.status, response.ok);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Failed to generate summary' } }));
        console.error('Stream error response:', error);
        throw new Error(error.error?.message || 'Failed to generate summary');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      if (!reader) {
        console.log('No reader available, falling back to non-streaming');
        // Fallback to non-streaming
        const data = await response.json();
        console.log('Non-streaming response:', data);
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const result = this.parseSummaryResponse(data.candidates[0].content.parts[0].text);
          subject.next(result);
          subject.complete();
        } else {
          subject.error(new Error('Invalid response from Gemini API'));
        }
        return;
      }

      console.log('Starting to read stream...');

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('Stream done, final text length:', fullText.length);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Try to parse complete JSON objects from buffer
        // The response might be JSON objects separated by newlines or brackets
        let startIndex = 0;
        
        // Look for complete JSON objects (they start with { and have matching braces)
        while (startIndex < buffer.length) {
          // Try to find the start of a JSON object
          const objStart = buffer.indexOf('{', startIndex);
          if (objStart === -1) break;
          
          // Try to find the matching closing brace
          let braceCount = 0;
          let objEnd = -1;
          
          for (let i = objStart; i < buffer.length; i++) {
            if (buffer[i] === '{') braceCount++;
            if (buffer[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                objEnd = i + 1;
                break;
              }
            }
          }
          
          if (objEnd === -1) {
            // Incomplete object, wait for more data
            break;
          }
          
          // Extract and parse the JSON object
          try {
            const jsonStr = buffer.substring(objStart, objEnd);
            const data = JSON.parse(jsonStr);
            console.log('Parsed chunk:', data);
            
            // Handle streaming chunks from Gemini API
            const textParts = data.candidates?.[0]?.content?.parts;
            if (textParts && textParts.length > 0) {
              for (const part of textParts) {
                if (part.text) {
                  fullText += part.text;
                  // Parse and emit the accumulated result
                  const result = this.parseSummaryResponse(fullText);
                  console.log('Emitting summary chunk, total length:', result.summary.length);
                  subject.next(result);
                }
              }
            }

            // Check if finished (has finishReason)
            if (data.candidates?.[0]?.finishReason === 'STOP') {
              console.log('Stream finished with STOP');
              subject.complete();
              return;
            }
          } catch (e) {
            console.error('Error parsing JSON chunk:', e, 'Chunk:', buffer.substring(objStart, Math.min(objStart + 100, buffer.length)));
            // Move past this character and try again
            startIndex = objStart + 1;
            continue;
          }
          
          // Remove parsed object from buffer
          buffer = buffer.substring(objEnd);
          startIndex = 0;
        }
      }

      // Complete the stream
      const finalResult = this.parseSummaryResponse(fullText);
      console.log('Completing stream, final summary:', finalResult.summary.substring(0, 100));
      subject.complete();
    }).catch((error) => {
      console.error('Streaming error:', error);
      // Fallback to non-streaming
      this.generateSummary(transcript, lengthPercentage, style)
        .then(result => {
          subject.next(result);
          subject.complete();
        })
        .catch(err => {
          subject.error(err);
        });
    });

    return subject.asObservable();
  }
}