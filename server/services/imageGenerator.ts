import { writeFile } from "fs/promises";
import { GoogleGenAI, Modality } from "@google/genai";
import sharp from "sharp";
import path from "path";
import { keyRotation } from "./keyRotation";

const BASE_DELAY_MS = 3000;
const RETRY_DELAY_MS = 8000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function staggerRequest(baseDelayMs = BASE_DELAY_MS): Promise<void> {
  const randomJitter = Math.floor(Math.random() * 1500);
  await delay(baseDelayMs + randomJitter);
}

let globalFrameCounter = 0;

async function splitIntoPanels(
  imagePath: string,
  panelCount: number
): Promise<string[]> {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }

  const panelWidth = Math.floor(metadata.width / panelCount);
  const framePaths: string[] = [];
  const dir = path.dirname(imagePath);

  for (let i = 0; i < panelCount; i++) {
    const framePath = path.join(dir, `frame_${globalFrameCounter}.png`);
    globalFrameCounter++;
    
    await image
      .clone()
      .extract({ 
        left: i * panelWidth, 
        top: 0, 
        width: panelWidth, 
        height: metadata.height 
      })
      .toFile(framePath);
    
    framePaths.push(framePath);
    console.log(`Split panel ${i + 1}/${panelCount}: ${framePath}`);
  }

  return framePaths;
}

export function resetFrameCounter(): void {
  globalFrameCounter = 0;
}

export async function generateStickmanImage(
  paragraphLines: string[],
  outputPath: string,
  paragraphIndex: number,
  retryAttempt: number = 0
): Promise<string[]> {
  const maxRetries = keyRotation.getKeyCount();
  
  if (retryAttempt >= maxRetries) {
    throw new Error(`Gemini API quota exceeded after trying all ${maxRetries} API keys. Please wait and try again later.`);
  }

  const apiKey = keyRotation.getNextKey();
  
  await staggerRequest();

  const genAI = new GoogleGenAI({ 
    vertexai: false,
    apiKey 
  });

  const panelCount = paragraphLines.length;
  const numberedLines = paragraphLines
    .map((line, i) => `${i + 1}. ${line}`)
    .join("\n");

  const imagePrompt = `Create a single high-quality stickman comic strip with ${panelCount} panels arranged horizontally in a single row.

Each panel should visualize the following ${panelCount} sentences in order:
${numberedLines}

Style requirements:
- ${panelCount} panels in a single horizontal row
- White or light background
- Minimalist, thin black outlines
- Simple stickman figure (circle head, stick body, arms, legs) in each panel
- Subtle colors only for key elements (e.g., brown/blue/green for context)
- Label each panel clearly with subtle numbers "1", "2", "3", "4" in the corner
- NO long captions or bottom text blocks
- Style: educational infographic / simple comic strip
- Professional and clean appearance
- Each panel should be the same size and clearly separated`;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        {
          role: "user",
          parts: [{ text: imagePrompt }]
        }
      ],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      }
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("Gemini API returned no candidates");
    }

    const content = candidates[0].content;
    if (!content || !content.parts) {
      throw new Error("Gemini API returned no content parts");
    }

    let imageSaved = false;
    for (const part of content.parts) {
      if (part.text) {
        console.log(`Gemini description: ${part.text}`);
      } else if (part.inlineData && part.inlineData.data) {
        const imageData = Buffer.from(part.inlineData.data, "base64");
        await writeFile(outputPath, imageData);
        console.log(`4-panel image saved: ${outputPath}`);
        imageSaved = true;
        break;
      }
    }

    if (!imageSaved) {
      throw new Error("Gemini API did not return an image");
    }

    const framePaths = await splitIntoPanels(outputPath, panelCount);
    console.log(`Split into ${framePaths.length} frames`);
    
    return framePaths;

  } catch (error: any) {
    if (error.message?.includes("RESOURCE_EXHAUSTED") || 
        error.message?.includes("Quota exceeded") || 
        error.message?.includes("429")) {
      console.warn(`Quota hit on attempt ${retryAttempt + 1}/${maxRetries}, retrying with next key...`);
      await staggerRequest(RETRY_DELAY_MS);
      return await generateStickmanImage(paragraphLines, outputPath, paragraphIndex, retryAttempt + 1);
    }
    throw new Error(`Gemini image generation error: ${error.message || "Failed to generate image"}`);
  }
}
