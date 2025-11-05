// Multi-key rotation system for Gemini API
// Rotates through multiple API keys to avoid quota limits

class KeyRotation {
  private keys: string[];
  private currentIndex: number = 0;

  constructor() {
    // Load all available Gemini API keys from environment
    const keys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
    ].filter((key): key is string => !!key && key.trim() !== "");

    if (keys.length === 0) {
      throw new Error("No Gemini API keys found. Please set GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.");
    }

    this.keys = keys;
    console.log(`Initialized key rotation with ${this.keys.length} API key(s)`);
  }

  getNextKey(): string {
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  getKeyCount(): number {
    return this.keys.length;
  }
}

export const keyRotation = new KeyRotation();
