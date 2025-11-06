import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

export interface VideoFrame {
  imagePath: string;
  duration: number;
}

function getVideoDimensions(aspectRatio: string): { width: number; height: number } {
  const aspectRatioMap: Record<string, { width: number; height: number }> = {
    "16:9": { width: 1920, height: 1080 },
    "9:16": { width: 1080, height: 1920 },
    "1:1": { width: 1080, height: 1080 },
    "4:3": { width: 1440, height: 1080 },
  };
  
  return aspectRatioMap[aspectRatio] || aspectRatioMap["16:9"];
}

export async function createVideo(
  frames: VideoFrame[],
  audioPath: string,
  outputPath: string,
  aspectRatio: string = "16:9"
): Promise<void> {
  // Create a temporary directory for processing
  const tempDir = path.join(process.cwd(), "temp_video");
  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true });
  }

  // Create a concat file for FFmpeg
  const concatFilePath = path.join(tempDir, "concat.txt");
  const concatContent = frames
    .map((frame) => `file '${frame.imagePath}'\nduration ${frame.duration}`)
    .join("\n");
  
  await writeFile(concatFilePath, concatContent);

  const { width, height } = getVideoDimensions(aspectRatio);
  
  try {
    // First, create video from images
    const videoOnlyPath = path.join(tempDir, "video_only.mp4");
    await execFileAsync("ffmpeg", [
      "-y", // Overwrite output file
      "-f", "concat",
      "-safe", "0",
      "-i", concatFilePath,
      "-vf", `fps=25,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:-1:-1:color=white`,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      videoOnlyPath,
    ]);

    // Then, combine video with audio
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", videoOnlyPath,
      "-i", audioPath,
      "-c:v", "copy",
      "-c:a", "aac",
      "-shortest",
      outputPath,
    ]);

    // Clean up temporary files
    await unlink(videoOnlyPath);
    await unlink(concatFilePath);
  } catch (error: any) {
    throw new Error(`FFmpeg error: ${error.message}`);
  }
}

export async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      audioPath,
    ]);
    return parseFloat(stdout.trim());
  } catch (error: any) {
    throw new Error(`FFprobe error: ${error.message}`);
  }
}
