# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start the server**: `npm start` - Runs the Express server on port 5000 (or PORT env var)
- **Install dependencies**: `npm install`

## Architecture Overview

This is a Node.js Express service that provides ISBN book lookup functionality through a REST API.

### Core Components

- **Main application**: `script.js` - Contains the Express server and all business logic
- **Book lookup service**: `fetchISBNData()` function implements a fallback strategy:
  1. First queries Google Books API for ISBN data
  2. If not found, falls back to scraping books.com.tw using Cheerio
- **NCL lookup service**: `fetchNCLData()` function queries Taiwan's National Central Library integrated catalog system
- **API endpoints**: 
  - `GET /search?isbn={isbn}` - Returns book data using Google Books + books.com.tw fallback
  - `GET /search-new?isbn={isbn}` - Returns book data using NCL integrated catalog system
- **Health check**: `GET /` - Returns server status

### Technology Stack

- **Express.js**: Web framework with CORS enabled
- **node-fetch**: HTTP client for external API calls
- **Cheerio**: Server-side HTML parsing for web scraping
- **ES modules**: Uses `"type": "module"` configuration

### Data Flow

**Original `/search` endpoint:**
1. Client sends ISBN via query parameter to `/search`
2. Server attempts Google Books API lookup first
3. On failure, scrapes books.com.tw search results
4. Returns standardized book object: `{title, author, isbn}`
5. Error handling returns empty array or 500 status

**New `/search-new` endpoint:**
1. Client sends ISBN via query parameter to `/search-new`
2. Server sends POST request to NCL integrated catalog system
3. Parses HTML response to extract book information from search results table
4. Returns standardized book object: `{title, author, isbn}`
5. Error handling returns empty array or 500 status

### Key Architectural Notes

- Single-file application with all logic in `script.js`
- Graceful fallback between data sources
- Stateless design suitable for horizontal scaling
- Chinese language support for books.com.tw scraping