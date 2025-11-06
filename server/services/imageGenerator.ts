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

CRITICAL: Each panel MUST visually illustrate the action/concept - DO NOT just draw a stickman with the sentence written below it. Show what's happening through the stickman's pose, gestures, and minimal visual elements.

Each panel should visualize the following ${panelCount} sentences in order:
${numberedLines}

Style requirements:
- ${panelCount} equal-width panels in a single horizontal row (no gaps between panels)
- Clean white or very light background
- Minimalist style with thin black outlines
- Simple stickman figure (circle head, stick body, arms, legs) performing the action described
- Use subtle colors ONLY to highlight key elements mentioned in the text (e.g., brown/blue for eye color, objects in the scene)
- Show the ACTION or CONCEPT visually through the stickman's pose, positioning, and simple props/elements
- Label each panel with a small number "1", "2", "3", or "4" in the top corner
- MINIMAL TEXT: Only use 1-3 words if absolutely necessary to clarify a key detail (like a label). NO full sentence captions at the bottom
- Each panel must be exactly the same width and height
- Clean separation between panels (use subtle vertical lines if needed)
- Professional educational comic style

REMEMBER: SHOW the action visually, don't just write the sentence below a standing stickman!`;

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
