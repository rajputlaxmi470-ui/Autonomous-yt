import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function generateVideoMetadata(filename: string, context: string = "") {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a catchy YouTube title and a detailed description for a video with the filename: "${filename}". 
      Additional context: ${context}
      
      Return the result in JSON format with "title" and "description" fields.`,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      title: result.title || `Video: ${filename}`,
      description: result.description || "Uploaded via YT-Auto",
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      title: `Video: ${filename}`,
      description: "Uploaded via YT-Auto",
    };
  }
}
