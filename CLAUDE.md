# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a Node.js application that generates customized HTML pages using Groq's AI models. The system has two main components:

1. **CLI Interface** (`index.js`) - Command-line tool for direct HTML generation
2. **Web Interface** (`server.js`) - Express.js server providing a browser-based UI

### Core Architecture

- **Template-Based Generation**: Uses a base HTML template (`templates/base.html`) that gets customized based on user input
- **AI Integration**: Leverages Groq API with the `openai/gpt-oss-120b` model to transform the base template
- **Dual Interface**: Both CLI and web interfaces share the same `generateHTML()` function logic
- **File Output**: Generated HTML files are saved to `output/` directory with timestamps

### Key Files

- `templates/base.html` - Base HTML template (e-commerce theme) that serves as the foundation
- `server.js` - Express web server with routes for form input and real-time generation
- `index.js` - CLI version for command-line usage
- `.env` - Contains `GROQ_API_KEY` (required for API access)

## Development Commands

```bash
# Install dependencies
npm install

# Start web server (primary interface)
npm start
# or
npm run dev

# Use CLI interface
npm run cli "user input description"

# Example CLI usage
npm run cli "女性、30代、健康志向"
```

## Environment Setup

The application requires a Groq API key:
1. Copy `.env.example` to `.env`
2. Set `GROQ_API_KEY=your_api_key_here` in `.env`
3. API keys should start with `gsk_` (Groq format), not `sk_` (OpenAI format)

## AI Model Configuration

- Model: `openai/gpt-oss-120b`
- Max completion tokens: `32766` (120b model limit)
- Streaming: Enabled for real-time output
- Temperature: `1` (creative output)

## Web Interface Flow

1. User visits `http://localhost:3000`
2. Submits user description via form
3. Loading screen displays while processing
4. Generated HTML renders directly in browser
5. HTML file automatically saved to `output/` directory

The web interface includes example inputs and handles errors gracefully with user-friendly messages.