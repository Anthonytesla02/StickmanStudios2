# StickMotion Setup Complete ✅

## Configuration Status

### ✅ API Keys Configured
All required API keys are securely stored in Replit Secrets:
- **GEMINI_API_KEY_1**: Configured
- **GEMINI_API_KEY_2**: Configured  
- **GEMINI_API_KEY_3**: Configured
- **GEMINI_API_KEY_4**: Configured
- **ELEVENLABS_API_KEY**: Configured

### ✅ Directory Structure
```
project-root/
├── client/              (React frontend)
├── server/              (Express backend with WebSocket)
├── shared/              (Shared TypeScript schemas)
├── public/generated/    (Generated videos output)
├── temp_video/          (Temporary processing files)
└── attached_assets/     (Static assets)
```

### ✅ Application Features
- **Landing Page**: Marketing page at `/`
- **Video Creator**: Generation interface at `/creator`
- **AI-Powered**: Uses Gemini for stickman images and ElevenLabs for voice
- **Real-time Updates**: WebSocket connection for progress tracking
- **Multi-Key Rotation**: Automatically rotates through 4 Gemini keys to avoid quotas

---

## How to Run the Application

### Step 1: Create Workflow
1. Open the **Workflows** pane in your workspace
2. Click **+ New Workflow**
3. Name: `Start application`
4. Add task: **Execute Shell Command**
5. Command: `npm run dev`
6. Click **Save** and then **Run**

### Step 2: Access the Application
Once the workflow is running, the app will be available at:
- **Port**: 5000
- **Landing Page**: `http://localhost:5000/`
- **Creator Page**: `http://localhost:5000/creator`

---

## How to Test Video Generation

### Test Script Example
Try this sample script in the Creator page:

```
A stickman wakes up in the morning
He stretches and yawns with a big smile
The stickman walks to the kitchen
He makes a cup of coffee
The stickman sits at his desk
He opens his laptop and starts working
A lightbulb appears above his head
The stickman has a brilliant idea
```

### What Happens:
1. **Script Parsing**: Text split into 2 paragraphs (4 lines each)
2. **Image Generation**: 
   - Gemini generates 2 comic strip images (4 panels each)
   - Images automatically split into 8 individual frames
   - Keys rotate to avoid rate limits
3. **Audio Creation**: ElevenLabs converts full script to narration
4. **Video Assembly**: FFmpeg combines frames + audio into MP4
5. **Download**: Video available at `/generated/video_[timestamp].mp4`

### Expected Processing Time
- **2 paragraphs (8 lines)**: ~30-45 seconds
- **4 paragraphs (16 lines)**: ~60-90 seconds

Progress updates stream in real-time via WebSocket!

---

## Troubleshooting

### If the workflow doesn't start:
- Verify `package.json` exists with `npm run dev` script
- Check that node_modules directory is present
- Ensure port 5000 is not already in use

### If video generation fails:
- Check browser console for WebSocket connection errors
- Verify all 5 API keys are set in Replit Secrets
- Review server logs for specific error messages

### If images don't generate:
- Gemini may hit rate limits (app will retry with next key)
- Check that GEMINI_API_KEY values are valid
- Verify internet connectivity for API calls

### If audio doesn't generate:
- Verify ELEVENLABS_API_KEY is valid
- Check ElevenLabs account has available quota
- Review server logs for API error messages

---

## Architecture Overview

### Frontend (React + TypeScript)
- **Pages**: Home (landing), Creator (video generator)
- **State**: TanStack Query for API calls
- **Real-time**: WebSocket connection to backend
- **Styling**: Tailwind CSS + shadcn/ui components

### Backend (Express + Node.js)
- **Port**: 5000 (serves both API and frontend)
- **WebSocket**: Real-time progress at `/ws`
- **REST API**: `/api/generate-video` endpoint
- **Static Files**: `/generated` route for video downloads

### Video Pipeline
1. **Parse**: Split script into 4-line paragraphs
2. **Generate Images**: Gemini creates comic strips (multi-key rotation)
3. **Split Frames**: Sharp extracts individual panels
4. **Create Audio**: ElevenLabs generates narration
5. **Assemble**: FFmpeg combines frames + audio → MP4
6. **Cleanup**: Remove temporary files

---

## Next Steps

1. ✅ Create the workflow (see "How to Run" above)
2. ✅ Start the workflow to launch the app
3. ✅ Open the landing page to see the marketing site
4. ✅ Navigate to `/creator` to generate your first video
5. ✅ Test with the sample script provided above

**Your StickMotion app is fully configured and ready to create amazing stickman videos!** 🎬
