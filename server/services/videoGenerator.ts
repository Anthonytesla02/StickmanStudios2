import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { generateStickmanPrompt } from "./gemini";
import { generateStickmanImage, resetFrameCounter } from "./imageGenerator";
import { generateAudio } from "./elevenlabs";
import { createVideo, getAudioDuration, type VideoFrame } from "./ffmpeg";

export interface GenerationProgress {
  stage: "images" | "audio" | "video" | "complete";
  progress: number;
  message: string;
}

export interface VideoGenerationResult {
  videoUrl: string;
  duration: number;
}

export async function generateVideo(
  script: string,
  onProgress?: (progress: GenerationProgress) => void
): Promise<VideoGenerationResult> {
  // Reset frame counter for consistent frame numbering
  resetFrameCounter();

  // Create output directories
  const outputDir = path.join(process.cwd(), "public", "generated");
  const tempDir = path.join(process.cwd(), "temp_video");
  
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }
  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true });
  }

  // Split script into lines
  const scriptLines = script
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (scriptLines.length === 0) {
    throw new Error("Script is empty");
  }

  // Group script lines into paragraphs of exactly 4 lines each
  // If the last group has fewer than 4 lines, pad it with the last line repeated
  const paragraphs: string[][] = [];
  for (let i = 0; i < scriptLines.length; i += 4) {
    const paragraph = scriptLines.slice(i, i + 4);
    
    // Ensure every paragraph has exactly 4 lines to prevent cropping issues
    while (paragraph.length < 4 && paragraph.length > 0) {
      // Pad with the last line to maintain 4-panel structure
      paragraph.push(paragraph[paragraph.length - 1]);
    }
    
    // Only add paragraphs that have content
    if (paragraph.length === 4) {
      paragraphs.push(paragraph);
    }
  }

  // Stage 1: Generate images (one 4-panel image per paragraph)
  onProgress?.({
    stage: "images",
    progress: 0,
    message: "Generating stickman images...",
  });

  const imagePaths: string[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    
    // Generate 4-panel image for this paragraph
    const panelImagePath = path.join(tempDir, `paragraph_${i}.png`);
    const frameImages = await generateStickmanImage(paragraph, panelImagePath, i);
    imagePaths.push(...frameImages);

    onProgress?.({
      stage: "images",
      progress: ((i + 1) / paragraphs.length) * 100,
      message: `Generated paragraph ${i + 1} of ${paragraphs.length} (${frameImages.length} frames)`,
    });
  }

  // Stage 2: Generate audio
  onProgress?.({
    stage: "audio",
    progress: 0,
    message: "Converting script to speech...",
  });

  const fullScript = scriptLines.join(". ");
  const audioPath = path.join(tempDir, "audio.mp3");
  const audioBuffer = await generateAudio(fullScript);
  await writeFile(audioPath, audioBuffer);

  onProgress?.({
    stage: "audio",
    progress: 100,
    message: "Audio generated successfully",
  });

  // Get audio duration to calculate frame durations
  const totalDuration = await getAudioDuration(audioPath);
  const frameDuration = totalDuration / imagePaths.length;

  // Stage 3: Create video
  onProgress?.({
    stage: "video",
    progress: 0,
    message: "Stitching video together...",
  });

  const frames: VideoFrame[] = imagePaths.map((imagePath) => ({
    imagePath,
    duration: frameDuration,
  }));

  const timestamp = Date.now();
  const outputPath = path.join(outputDir, `video_${timestamp}.mp4`);
  await createVideo(frames, audioPath, outputPath);

  onProgress?.({
    stage: "video",
    progress: 100,
    message: "Video created successfully",
  });

  // Clean up temporary files (frames and paragraph images)
  for (const imagePath of imagePaths) {
    await unlink(imagePath).catch(() => {});
  }
  
  // Clean up 4-panel paragraph images
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraphImagePath = path.join(tempDir, `paragraph_${i}.png`);
    await unlink(paragraphImagePath).catch(() => {});
  }
  
  await unlink(audioPath).catch(() => {});

  onProgress?.({
    stage: "complete",
    progress: 100,
    message: "Video generation complete!",
  });

  return {
    videoUrl: `/generated/video_${timestamp}.mp4`,
    duration: totalDuration,
  };
}
