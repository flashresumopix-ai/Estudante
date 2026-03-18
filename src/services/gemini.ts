import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
  // Tenta pegar de várias fontes possíveis em ambiente Vite/Browser
  const key = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  
  if (!key || key === 'undefined' || key === 'MY_GEMINI_API_KEY' || key === '') {
    return '';
  }
  return key;
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export async function summarizeText(text: string): Promise<string> {
  if (!text) return "";
  
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key do Gemini não encontrada. Configure GEMINI_API_KEY ou VITE_GEMINI_API_KEY no seu ambiente de deploy (Netlify/Vercel) e faça um novo deploy.");
  }
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Resuma o seguinte texto de forma completa, mantendo todos os pontos importantes e o contexto original. O resumo deve ser em Português do Brasil.\n\nTexto:\n${text}`,
      config: {
        temperature: 0.7,
      }
    });
    
    return response.text || "Não foi possível gerar o resumo.";
  } catch (error: any) {
    console.error("Erro ao resumir texto:", error);
    const errorMessage = error?.message || "Erro desconhecido na API do Gemini";
    throw new Error(`Falha ao gerar resumo: ${errorMessage}`);
  }
}

export async function extractTextFromImage(base64Data: string, mimeType: string): Promise<string> {
  if (!base64Data) return "";
  
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key do Gemini não encontrada. Configure GEMINI_API_KEY ou VITE_GEMINI_API_KEY no seu ambiente de deploy.");
  }
  
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
  } catch (error: any) {
    console.error("Erro ao extrair texto da imagem:", error);
    const errorMessage = error?.message || "Erro desconhecido ao processar imagem";
    throw new Error(`Falha ao processar imagem: ${errorMessage}`);
  }
}
