// 

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("❌ Gemini API key not found in .env");
}

const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-latest",
});

let chat = null; // Persist the chat session
let currentSystemInstruction = null; // Track the current system instruction

export const getGeminiResponse = async (
  promptContent,
  conversationHistory = [],
  systemPrompt = "" // Added systemPrompt parameter
) => {
  try {
    // Format the systemPrompt as a Content object if it's a string
    const formattedSystemInstruction = systemPrompt
      ? { parts: [{ text: systemPrompt }] }
      : undefined; // Use undefined if no system prompt

    // Reset chat if the system prompt changes or if chat is null
    if (!chat || systemPrompt !== currentSystemInstruction) {
      currentSystemInstruction = systemPrompt; // Update the tracked system instruction
      chat = model.startChat({
        history: conversationHistory, // This now expects an array of { role, parts }
        generationConfig: {
          maxOutputTokens: 500,
        },
        // Pass the formatted system instruction
        systemInstruction: formattedSystemInstruction,
      });
    }

    // Determine if promptContent is a simple string or an array of parts
    const partsToSend = Array.isArray(promptContent)
      ? promptContent
      : [{ text: promptContent }];

    const result = await chat.sendMessage(partsToSend); // Send the prepared parts
    const response = result.response.text();
    return response;
  } catch (error) {
    console.error("Gemini API error:", error);
    chat = null; // Reset chat on error
    currentSystemInstruction = null; // Also reset the system instruction tracker
    return "⚠️ Failed to get response from Gemini.";
  }
};

export const resetGeminiChat = () => {
  chat = null;
  currentSystemInstruction = null; // Reset system instruction on chat reset
};

export default getGeminiResponse;