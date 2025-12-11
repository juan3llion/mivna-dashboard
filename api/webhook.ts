import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

// Forzamos Node.js para que fetch funcione full
export const config = {
  runtime: 'nodejs', 
};

export default async function handler(req: any, res: any) {
  // Solo aceptamos POST
  if (req.method !== 'POST') { return res.status(405).send('Method not allowed'); }

  try {
    const eventType = req.headers["x-github-event"];
    console.log(`📡 Diagnóstico MIVNA iniciado. Evento: ${eventType}`);

    // DIAGNÓSTICO DE MODELOS DE GOOGLE
    // Hacemos una llamada directa a la API para listar modelos
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ ERROR CRÍTICO: No se encontró GEMINI_API_KEY en las variables de entorno.");
      return res.status(500).json({ error: "No API Key" });
    }

    console.log("🕵️‍♂️ Consultando lista oficial de modelos a Google...");
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    if (data.error) {
        console.error("❌ Error de Google API:", JSON.stringify(data.error, null, 2));
    } else {
        console.log("✅ LISTA DE MODELOS DISPONIBLES PARA TU API KEY:");
        // Imprimimos la lista bonita en los logs
        console.log(JSON.stringify(data, null, 2));
    }

    return res.status(200).json({ 
        message: "Diagnóstico completado. Revisa los Logs de Vercel.",
        models_found: data.models ? data.models.length : 0 
    });

  } catch (error: any) {
    console.error("❌ Error en Diagnóstico:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
