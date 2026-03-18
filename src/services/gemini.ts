import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function summarizeText(text: string): Promise<string> {
  if (!text) return "";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Resuma o seguinte texto de forma completa, mantendo todos os pontos importantes e o contexto original. O resumo deve ser em Português do Brasil.\n\nTexto:\n${text}`,
      config: {
        temperature: 0.7,
      }
    });
    
    return response.text || "Não foi possível gerar o resumo.";
  } catch (error) {
    console.error("Erro ao resumir texto:", error);
    throw new Error("Falha ao gerar resumo com IA.");
  }
}

export async function extractTextFromImage(base64Data: string, mimeType: string): Promise<string> {
  if (!base64Data) return "";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        {
          text: "Extraia todo o texto desta imagem de forma fiel e completa. Se houver tabelas ou dados estruturados, mantenha a estrutura o melhor possível. Retorne apenas o texto extraído, sem comentários adicionais."
        }
      ],
      config: {
        temperature: 0,
      }
    });
    
    return response.text || "Não foi possível extrair o texto da imagem.";
  } catch (error) {
    console.error("Erro ao extrair texto da imagem:", error);
    throw new Error("Falha ao processar imagem com IA.");
  }
}
