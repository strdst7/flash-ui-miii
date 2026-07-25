import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "dummy_key";

  if (!process.env.GEMINI_API_KEY && !process.env.API_KEY) {
    console.warn("GEMINI_API_KEY is not set. API calls will fail.");
  }

  // Ensure genAI is initialized correctly as per the skill's modern options
  const genAI = new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const callGeminiWithRetry = async <T>(
    initialModel: string,
    operation: (activeModel: string) => Promise<T>,
    maxRetries = 10,
    initialDelay = 2000
  ): Promise<T> => {
    let retries = 0;
    let currentModel = initialModel;
    // Normalize model name on entry
    if (currentModel === 'gemini-3.5-flash' || currentModel === 'gemini-1.5-flash') {
      currentModel = 'gemini-3.6-flash';
    }

    while (true) {
      try {
        return await operation(currentModel);
      } catch (error: any) {
        let statusCode = error.status || error.code || (error.response ? error.response.status : undefined);
        
        // Extract status code from message string if missing (SDK specific behavior)
        if (!statusCode && error.message) {
          const match = error.message.match(/status:\s*(\d+)/i);
          if (match) statusCode = parseInt(match[1], 10);
        }

        const isRetryable = statusCode === 503 || statusCode === 429 || statusCode === 404 ||
                           error.message?.toLowerCase().includes('high demand') || 
                           error.message?.toLowerCase().includes('service unavailable') ||
                           error.message?.toLowerCase().includes('overloaded') ||
                           error.message?.toLowerCase().includes('parsing response') ||
                           error.message?.toLowerCase().includes('not found');
        
        if (isRetryable && retries < maxRetries) {
          const oldModel = currentModel;
          // Fallback chain using recommended stable models
          if (currentModel === 'gemini-3.6-flash') {
            currentModel = 'gemini-flash-latest';
          } else if (currentModel === 'gemini-flash-latest') {
            currentModel = 'gemini-3.1-flash-lite';
          } else if (currentModel === 'gemini-3.1-flash-lite') {
            currentModel = 'gemini-3.1-pro-preview';
          } else {
            currentModel = 'gemini-3.6-flash'; // Loop back to primary
          }
          
          if (oldModel !== currentModel) {
            console.warn(`Gemini API error on model ${oldModel}. Falling back to ${currentModel}`);
          }

          const delay = initialDelay * Math.pow(1.6, retries) + Math.random() * 2000;
          console.warn(`Gemini API retryable error (Status: ${statusCode || 'Unknown'}, Model attempted: ${oldModel}, Message: ${error.message}). Retrying in ${Math.round(delay)}ms... (Attempt ${retries + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
          continue;
        }
        throw error;
      }
    }
  };

  // API Routes
  app.post('/api/generate', async (req, res) => {
    try {
      let { prompt, styleInstruction, model = 'gemini-3.6-flash' } = req.body;
      
      // Map old model names to new ones
      if (model === 'gemini-3.5-flash' || model === 'gemini-1.5-flash') {
        model = 'gemini-3.6-flash';
      }

      const fullPrompt = `
You are Flash UI. Create a stunning, high-fidelity UI component for: "${prompt}".

**CONCEPTUAL DIRECTION: ${styleInstruction}**

**VISUAL EXECUTION RULES:**
1. **Materiality**: Use the specified metaphor to drive every CSS choice. (e.g. if Risograph, use \`feTurbulence\` for grain and \`mix-blend-mode: multiply\` for ink layering).
2. **Typography**: Use high-quality web fonts. Pair a bold sans-serif with a refined monospace for data.
3. **Motion**: Include subtle, high-performance CSS/JS animations (hover transitions, entry reveals).
4. **IP SAFEGUARD**: No artist names or trademarks. 
5. **Layout**: Be bold with negative space and hierarchy. Avoid generic cards.

Return ONLY RAW HTML. No markdown fences.
      `.trim();

      const result = await callGeminiWithRetry(model, (activeModel) => genAI.models.generateContentStream({
        model: activeModel,
        contents: fullPrompt
      }));
      
      res.setHeader('Content-Type', 'text/plain');
      for await (const chunk of result) {
        const chunkText = chunk.text;
        res.write(chunkText);
      }
      res.end();
    } catch (error: any) {
      console.error("Error in /api/generate:", error);
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/variant', async (req, res) => {
    try {
      let { prompt, currentCode, styleName, model = 'gemini-3.6-flash' } = req.body;

      // Map old model names to new ones
      if (model === 'gemini-3.5-flash' || model === 'gemini-1.5-flash') {
        model = 'gemini-3.6-flash';
      }

      const fullPrompt = `
You are a master UI/UX designer. Create a HIGH-FIDELITY VARIATION of the following UI artifact.

**CONTEXT:**
Original Prompt: "${prompt}"
Style Direction: "${styleName}"

**TASK:**
Maintain the CORE STRUCTURE and FUNCTIONALITY, but change the STYLISTIC EXECUTION or ADD a new functional nuance. 
Think about changing the color palette, typography weight, spacing density, or adding a subtle interactive element.

**OUTPUT:**
Provide ONLY the complete HTML/CSS code. No conversational text. No markdown blocks.

Current Code:
${currentCode}
`.trim();

      const result = await callGeminiWithRetry(model, (activeModel) => genAI.models.generateContentStream({
        model: activeModel,
        contents: fullPrompt
      }));
      
      res.setHeader('Content-Type', 'text/plain');
      for await (const chunk of result) {
        const chunkText = chunk.text;
        res.write(chunkText);
      }
      res.end();
    } catch (error: any) {
      console.error("Error in /api/variant:", error);
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/variations', async (req, res) => {
    try {
      let { prompt, model = 'gemini-3.6-flash' } = req.body;

      // Map old model names to new ones
      if (model === 'gemini-3.5-flash' || model === 'gemini-1.5-flash') {
        model = 'gemini-3.6-flash';
      }

      const fullPrompt = `
You are a master UI/UX designer. Generate 3 RADICAL CONCEPTUAL VARIATIONS of: "${prompt}".

**STRICT IP SAFEGUARD:**
No names of artists. 
Instead, describe the *Physicality* and *Material Logic* of the UI.

**CREATIVE GUIDANCE (Use these as EXAMPLES of how to describe style, but INVENT YOUR OWN):**
1. Example: "Asymmetrical Primary Grid" (Heavy black strokes, rectilinear structure, flat primary pigments, high-contrast white space).
2. Example: "Suspended Kinetic Mobile" (Delicate wire-thin connections, floating organic primary shapes, slow-motion balance, white-void background).
3. Example: "Grainy Risograph Press" (Overprinted translucent inks, dithered grain textures, monochromatic color depth, raw paper substrate).
4. Example: "Volumetric Spectral Fluid" (Generative morphing gradients, soft-focus diffusion, bioluminescent light sources, spectral chromatic aberration).

**YOUR TASK:**
For EACH variation:
- Invent a unique design persona name based on a NEW physical metaphor.
- Rewrite the prompt to fully adopt that metaphor's visual language.
- Generate high-fidelity HTML/CSS.

Required JSON Output Format (stream ONE object per line):
{ "name": "Persona Name", "html": "..." }
      `.trim();

      const result = await callGeminiWithRetry(model, (activeModel) => genAI.models.generateContentStream({
        model: activeModel,
        contents: fullPrompt,
        config: { temperature: 1.2 }
      }));
      
      res.setHeader('Content-Type', 'text/plain');
      for await (const chunk of result) {
        const chunkText = chunk.text;
        res.write(chunkText);
      }
      res.end();
    } catch (error: any) {
      console.error("Error in /api/variations:", error);
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get('/api/placeholders', async (req, res) => {
    try {
      const prompt = 'Generate 20 creative, short, diverse UI component prompts (e.g. "bioluminescent task list"). Return ONLY a raw JSON array of strings. IP SAFEGUARD: Avoid referencing specific famous artists, movies, or brands.';
      
      const result = await callGeminiWithRetry('gemini-3.6-flash', (activeModel) => genAI.models.generateContent({
        model: activeModel,
        contents: prompt
      }));
      const text = result.text;
      res.json({ text });
    } catch (error: any) {
      console.error("Error in /api/placeholders:", error);
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/styles', async (req, res) => {
    try {
      let { prompt, model = 'gemini-3.6-flash' } = req.body;

      // Map old model names to new ones
      if (model === 'gemini-3.5-flash' || model === 'gemini-1.5-flash') {
        model = 'gemini-3.6-flash';
      }

      const stylePrompt = `
Generate 3 distinct, highly evocative design directions for: "${prompt}".

**STRICT IP SAFEGUARD:**
Never use artist or brand names. Use physical and material metaphors.

**CREATIVE EXAMPLES (Do not simply copy these, use them as a guide for tone):**
- Example A: "Asymmetrical Rectilinear Blockwork" (Grid-heavy, primary pigments, thick structural strokes, Bauhaus-functionalism vibe).
- Example B: "Grainy Risograph Layering" (Tactile paper texture, overprinted translucent inks, dithered gradients).
- Example C: "Kinetic Wireframe Suspension" (Floating silhouettes, thin balancing lines, organic primary shapes).
- Example D: "Spectral Prismatic Diffusion" (Glassmorphism, caustic refraction, soft-focus morphing gradients).

**GOAL:**
Return ONLY a raw JSON array of 3 *NEW*, creative names for these directions (e.g. ["Tactile Risograph Press", "Kinetic Silhouette Balance", "Primary Pigment Gridwork"]).
      `.trim();

      const result = await callGeminiWithRetry(model, (activeModel) => genAI.models.generateContent({
        model: activeModel,
        contents: stylePrompt
      }));
      const text = result.text;
      res.json({ text });
    } catch (error: any) {
      console.error("Error in /api/styles:", error);
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite middleware failed to load. This might be normal if 'vite' is not installed.", e);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*all', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.error(`Production error: 'dist' directory not found at ${distPath}`);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL: Failed to start server:", err);
  process.exit(1);
});
