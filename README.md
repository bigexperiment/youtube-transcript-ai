# YouTube Transcript AI

A simple Angular web application that provides AI-powered summaries of YouTube videos by fetching and analyzing video transcripts.

## Features

- 📹 **YouTube URL Support**: Accepts various YouTube URL formats:
  - `https://youtu.be/9M_QK4stCJU`
  - `https://www.youtube.com/watch?v=9M_QK4stCJU`
  - `https://m.youtube.com/watch?v=9M_QK4stCJU`
  - Direct video ID input
- 🤖 **AI Summary Generation**: Uses Google's Gemini AI to generate intelligent summaries based on transcript content
- ⚡ **Streaming Support**: Real-time streaming of AI-generated summaries for better user experience
- 📊 **Summary Length Control**: Adjustable summary length (10-100% of original transcript)
- 💳 **Credits Management**: Track and display remaining API credits
- ⚙️ **Settings Panel**: Manage API keys through a convenient settings menu
- 💾 **Local Storage**: API keys and credits are stored locally and persist across sessions
- 🔒 **Zero Credits Handling**: Automatic alerts and button disabling when credits reach zero

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager
- A Scrape Creators API key (for fetching transcripts)
- A Google Gemini API key (for AI summarization) - Get yours from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd youtube-transcript-ai
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
ng serve
```

4. Open your browser and navigate to `http://localhost:4200/`

### First Time Setup

On first launch, the application will prompt you to enter both API keys:
1. **Scrape Creators API Key**: For fetching YouTube transcripts
2. **Gemini AI API Key**: For generating AI summaries

Both keys will be saved in local storage and won't be requested again unless you change them through the settings menu.

## Usage

1. **Enter API Keys**: On first launch, enter both your Scrape Creators and Gemini AI API keys
2. **Input YouTube URL**: Paste any YouTube video URL or video ID
3. **Adjust Summary Length**: Use the slider to set desired summary length (default: 50%)
4. **Get Transcript**: Click "Get Transcript & Summary" to fetch the transcript and generate an AI summary
5. **View Results**: 
   - Video information
   - AI-generated summary (streamed in real-time using Gemini AI)
   - Full transcript with timestamps

## Settings

Access settings by clicking the gear icon (⚙️) in the header. From here you can:
- Update your Scrape Creators API key
- Update your Gemini AI API key
- View remaining credits

## API Integration

### Scrape Creators API (Transcript Fetching)

This application uses the Scrape Creators API for fetching YouTube transcripts:

- **Endpoint**: `https://api.scrapecreators.com/v1/youtube/video/transcript`
- **Method**: GET
- **Header**: `x-api-key: <your-api-key>`
- **Query Parameter**: `url=<formatted-youtube-url>`

The API formats the extracted video ID as: `https://www.youtube.com/watch?v={VIDEO_ID}`

### Google Gemini API (AI Summarization)

The application uses Google's Gemini AI for intelligent summarization:

- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent`
- **Streaming Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:streamGenerateContent`
- **Method**: POST
- **Header**: `X-goog-api-key: <your-gemini-api-key>`
- **Content-Type**: `application/json`

The app attempts to use streaming for real-time summary generation, falling back to non-streaming if streaming fails.

### Response Format

```json
{
  "success": true,
  "credits_remaining": 99,
  "videoId": "9M_QK4stCJU",
  "type": "video",
  "url": "https://www.youtube.com/watch?v=9M_QK4stCJU",
  "transcript": [
    {
      "text": "- [Derek] Friday, the 17th of July, 1992.",
      "startMs": "1008",
      "endMs": "3570",
      "startTimeText": "0:01"
    }
  ]
}
```

## Project Structure

```
src/app/
├── components/
│   └── settings/          # Settings modal component
├── services/
│   ├── api.ts            # API service for transcript fetching (Scrape Creators)
│   ├── storage.ts        # Local storage service (both API keys)
│   └── summary.ts        # Summary generation service (Gemini AI with streaming)
├── app.ts                # Main application component
├── app.html              # Main application template
├── app.css               # Main application styles
└── app.config.ts         # Application configuration
```

## Development

### Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

### Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

### Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Technologies Used

- **Angular 20**: Frontend framework
- **TypeScript**: Programming language
- **RxJS**: Reactive programming for API calls
- **HTML/CSS**: UI and styling

## Features in Detail

### Credit Management
- Credits are automatically tracked and updated after each API call
- When credits reach zero, the application will:
  - Display a visual warning (red credits display)
  - Disable the submit button
  - Show an alert when attempting to use the service

### Local Storage
- Both API keys (Scrape Creators and Gemini) are stored securely in browser local storage
- Credits remaining are cached locally
- Data persists across browser sessions

### AI Summarization
- Uses Google's Gemini 2.0 Flash Lite model for fast, accurate summaries
- Supports streaming responses for real-time summary generation
- Automatically adjusts summary length based on user preference (10-100%)
- Falls back to non-streaming mode if streaming fails

### URL Parsing
The application intelligently extracts video IDs from various YouTube URL formats:
- Standard watch URLs
- Short URLs (youtu.be)
- Mobile URLs (m.youtube.com)
- Embed URLs
- Direct video ID input

## License

This project is open source and available under the MIT License.

## Additional Resources

- [Angular Documentation](https://angular.dev)
- [Scrape Creators API Documentation](https://scrapecreators.com)
- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [Get Gemini API Key](https://makersuite.google.com/app/apikey)