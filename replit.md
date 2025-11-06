# StickMotion - AI-Powered Stickman Video Generator

## Overview

StickMotion is a SaaS application that transforms text scripts into animated stickman videos using AI. Users write scripts line-by-line, and the system generates corresponding stickman illustrations for each scene using Google Gemini, creates professional narration with ElevenLabs text-to-speech, and assembles everything into a downloadable MP4 video. The application features a landing page showcasing the product and a creator interface for video generation with real-time progress updates.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type safety and component-based UI
- Vite as the build tool for fast development and optimized production builds
- Wouter for lightweight client-side routing (landing page and creator page)
- Component-first architecture with reusable UI elements

**UI Component System**
- shadcn/ui component library built on Radix UI primitives for accessible, customizable components
- Tailwind CSS for utility-first styling with custom design tokens
- Design system uses "new-york" style variant with neutral color palette
- Supports light/dark mode theming via CSS custom properties
- Typography uses Inter (UI/body) and Outfit (display/headlines) from Google Fonts

**State Management**
- TanStack Query (React Query) for server state management and API requests
- Local React state (useState) for UI-specific state
- WebSocket connection for real-time video generation progress updates

**Key Pages**
- Home: Marketing landing page with hero, features, how-it-works, and pricing sections
- Creator: Interactive video generation interface with script editor (includes aspect ratio selector), progress panel, and video preview

### Backend Architecture

**Server Framework**
- Express.js running on Node.js with TypeScript
- Hybrid WebSocket/REST API approach for flexible client communication
- Custom middleware for request logging and JSON body parsing with raw buffer access

**WebSocket Integration**
- Real-time bidirectional communication using the `ws` library
- Progress streaming during video generation (image generation, audio creation, video rendering stages)
- Graceful fallback to REST API endpoint for video generation if needed

**Video Generation Pipeline (Updated November 6, 2025)**
1. Script parsing: Split input into lines, then group into paragraphs of exactly 4 lines each
   - Paragraphs with fewer than 4 lines are padded by repeating the last line to ensure consistent 4-panel layout
   - This prevents cropping issues during image splitting
2. Image generation: 
   - Multi-key rotation system cycles through 4 Gemini API keys to avoid quota limits
   - Generate one 4-panel horizontal comic strip per paragraph with enhanced visual storytelling
   - AI prompt emphasizes showing actions visually through stickman poses and gestures, not text captions
   - Minimal text policy: only 1-3 words for key labels, no full sentence captions
   - Automatically split 4-panel images into individual frames using Sharp
   - Staggered request timing (3s base + random jitter) to avoid rate limits
   - Adaptive retry with up to N attempts (where N = number of API keys)
3. Audio synthesis: Convert full script text to speech using ElevenLabs API
4. Video assembly: Use FFmpeg to combine frames and audio into MP4 format
5. Cleanup: Remove temporary frame and paragraph images after video creation

**Static File Serving**
- Generated videos stored in `/public/generated` directory
- Served via Express static middleware at `/generated` route
- Vite handles client asset bundling and serving

### Data Storage Solutions

**In-Memory Storage (Current Implementation)**
- `MemStorage` class implements basic CRUD operations for users
- No persistent database in current state - uses in-memory Map structures
- User schema defined with Drizzle ORM for future PostgreSQL integration

**Database Schema (Prepared for PostgreSQL)**
- Drizzle ORM configured with PostgreSQL dialect
- Schema defines users table with UUID primary keys, username, and password fields
- Connection configured via `DATABASE_URL` environment variable
- Migration files output to `./migrations` directory

**File System Storage**
- Temporary files during video processing stored in `/temp_video` directory
- Final video outputs saved to `/public/generated` for client download access

### Authentication & Authorization

**Current State**
- User schema prepared but authentication not actively implemented
- Basic user storage interface (getUser, getUserByUsername, createUser) exists
- Password field present in schema but no hashing/validation logic implemented

**Prepared Infrastructure**
- Session management via `connect-pg-simple` package (PostgreSQL session store)
- Express session middleware ready for integration
- User validation schemas using Zod via `drizzle-zod`

## External Dependencies

### AI Services

**Google Gemini (via @google/genai)**
- Model: `gemini-2.0-flash-exp`
- Purpose: Generates 4-panel comic strip images for each paragraph of the script
- Multi-key rotation: Uses `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`, `GEMINI_API_KEY_4` environment variables
- Configured for non-Vertex AI usage (direct API access)
- Rate limiting: 3s base delay + random jitter between requests, 8s retry delay on quota errors
- Retry logic: Up to N attempts (where N = number of API keys) before failing gracefully

**ElevenLabs Text-to-Speech**
- Voice ID: `pNInz6obpgDQGcFmaJgB` (Adam voice)
- Model: `eleven_turbo_v2_5` (free tier compatible)
- Purpose: Generates professional narration from script text
- Requires `ELEVENLABS_API_KEY` environment variable
- Returns MP3 audio buffers

### Media Processing

**FFmpeg**
- Used via child_process execFile for video assembly
- Operations: image concatenation, audio mixing, format conversion
- Output: MP4 videos at 25fps with yuv420p pixel format
- Supports multiple aspect ratios:
  - 16:9 (Landscape): 1920x1080
  - 9:16 (Portrait): 1080x1920
  - 1:1 (Square): 1080x1080
  - 4:3 (Classic): 1440x1080
- Handles frame duration timing and audio synchronization
- Defaults to 16:9 if invalid aspect ratio provided

**Sharp**
- High-performance image processing library
- Used for splitting 4-panel comic strips into individual frames
- Extracts equal-width panels from horizontally arranged comic strips
- Handles metadata reading and precise image cropping operations

### Database (Prepared)

**Neon Database (@neondatabase/serverless)**
- Serverless PostgreSQL provider
- Connection via `DATABASE_URL` environment variable
- Used with Drizzle ORM for type-safe database queries
- Session storage via `connect-pg-simple` for PostgreSQL-backed sessions

### Development Tools

**Replit Integration**
- `@replit/vite-plugin-runtime-error-modal` for development error overlays
- `@replit/vite-plugin-cartographer` for code navigation
- `@replit/vite-plugin-dev-banner` for development environment indicators
- Only loaded in non-production Replit environments

### Build & Deployment

**Production Build**
- Client: Vite builds React app to `/dist/public`
- Server: esbuild bundles Express server to `/dist/index.js` with ESM format
- All dependencies marked as external in server bundle
- Serves pre-built static files in production mode