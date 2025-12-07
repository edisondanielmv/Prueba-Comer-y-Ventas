import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { RAW_QUESTION_BANK } from "../data/rawQuestions";

// Helper to parse the raw text locally if API fails (Basic parsing)
const parseLocalBank = (): Question[] => {
    const questions: Question[] = [];
    // Split by number followed by dot (e.g., "1.")
    const blocks = RAW_QUESTION_BANK.split(/\n\d+\./).filter(b => b.trim().length > 10);
    
    blocks.forEach((block, index) => {
        const lines = block.trim().split('\n');
        const text = lines[0].trim();
        const options: string[] = [];
        let correctIndex = 0;

        lines.forEach(line => {
            // Regex to match A) or a)
            if (line.match(/^[a-dA-D]\)/)) {
                options.push(line.replace(/^[a-dA-D]\)\s*/, '').trim());
            }
            // Check for "Correcta:" or "Respuesta:" case insensitive
            if (line.toLowerCase().startsWith('correcta:') || line.toLowerCase().startsWith('respuesta:')) {
                const char = line.split(':')[1].trim().toLowerCase();
                correctIndex = char.charCodeAt(0) - 97; // 'a' code is 97
            }
        });

        if (options.length === 4) {
            questions.push({
                id: index + 1,
                text,
                options,
                correctOptionIndex: correctIndex
            });
        }
    });

    // Shuffle and pick 20
    const shuffled = questions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 20);
};

export const generateExamQuestions = async (): Promise<Question[]> => {
    // 1. First try to use Gemini to generate rephrased questions
    try {
        if (!process.env.API_KEY) {
            console.warn("No API Key found, using local parser.");
            return parseLocalBank();
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const systemInstruction = `
        You are an expert academic examiner in Marketing and Sales (Comercialización y Ventas). 
        Your task is to generate a unique exam for a student based strictly on the provided question bank.
        
        Rules:
        1. Randomly select exactly 20 questions from the provided text.
        2. REPHRASE the question stem and the options slightly to prevent students from simply searching for the exact text, but KEEP the meaning and correct answer logic identical.
        3. Ensure the selection covers diverse topics (Strategy, Segmentation, PEST, Consumer Behavior, etc.) to increase complexity.
        4. Shuffle the order of the options (A, B, C, D) for each question so the position of the correct answer varies.
        5. Return strictly JSON format.
        `;

        const prompt = `
        Here is the Question Bank:
        ${RAW_QUESTION_BANK}

        Generate 20 rephrased questions in Spanish.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.INTEGER },
                            text: { type: Type.STRING, description: "The rephrased question text" },
                            options: { 
                                type: Type.ARRAY, 
                                items: { type: Type.STRING },
                                description: "Array of 4 options" 
                            },
                            correctOptionIndex: { 
                                type: Type.INTEGER, 
                                description: "Index (0-3) of the correct option in the provided options array" 
                            }
                        },
                        required: ["id", "text", "options", "correctOptionIndex"]
                    }
                }
            }
        });

        if (response.text) {
            const data = JSON.parse(response.text);
            if (Array.isArray(data) && data.length > 0) {
                return data as Question[];
            }
        }
        
        throw new Error("Invalid API response format");

    } catch (error) {
        console.error("Gemini API failed or key missing, falling back to local shuffle.", error);
        // Fallback: Parse the string locally, shuffle, and return 20.
        return parseLocalBank();
    }
};