import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

// 1. CONFIGURACIÓN VITAL: Node.js para soportar todas las librerías
export const config = {
  runtime: 'nodejs', 
  maxDuration: 60,
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export default async function handler(req: any, res: any) {
  // Solo aceptamos POST
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const payload = req.body;
    const eventType = req.headers["x-github-event"];

    console.log(`📡 Evento recibido: ${eventType}`);

    // 2. FILTRO: Solo actuamos en Pull Requests abiertos o actualizados
    if (eventType !== "pull_request" || (payload.action !== "opened" && payload.action !== "synchronize")) {
      return res.status(200).json({ message: "Ignorado: No es PR o acción relevante" });
    }

    const { repository, pull_request, installation } = payload;
    console.log(`🚀 MIVNA: Analizando PR #${pull_request.number} en ${repository.full_name}`);

    // 3. CONEXIÓN GITHUB (Para leer el código)
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        installationId: installation.id,
      },
    });

    // Obtenemos los cambios del código (Diff)
    const { data: diffData } = await appOctokit.request(pull_request.diff_url);
    
    if (!diffData) {
      throw new Error("No se pudo leer el diff del PR");
    }

    // 4. CEREBRO IA: Usamos el modelo QUE SÍ EXISTE en tu cuenta
    // Según tus logs, este es el correcto:
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
      ACT AS: Senior Software Architect.
      TASK: Analyze this code diff and create a Mermaid.js diagram.
      CONTEXT: Repository: ${repository.full_name}
      DIFF: ${diffData.substring(0, 30000)}
      
      OUTPUT STRICT JSON FORMAT ONLY (No markdown):
      {
        "mermaid_code": "graph TD; ...",
        "explanation": "Brief summary of changes."
      }
    `;

    console.log("🧠 Consultando a Gemini 2.5 Flash...");
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Limpiamos la respuesta por si la IA pone ```json ... ```
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    let aiData;
    
    try {
        aiData = JSON.parse(cleanJson);
    } catch (e) {
        console.error("Error parseando JSON de IA:", cleanJson);
        throw new Error("La IA no devolvió un JSON válido");
    }

    // 5. GUARDAR DATOS (Supabase)
    await supabase.from("repositories").upsert({
       id: repository.id,
       full_name: repository.full_name,
       installation_id: installation.id
    });

    await supabase.from("architecture_diagrams").insert({
        repository_id: repository.id,
        mermaid_code: aiData.mermaid_code,
        explanation_markdown: aiData.explanation,
        pr_number: pull_request.number,
        commit_sha: pull_request.head.sha
    });

    // 6. PUBLICAR RESULTADO (Comentario en GitHub)
    await appOctokit.rest.issues.createComment({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: pull_request.number,
      body: `## 🏗️ MIVNA Architecture (Gemini 2.5)\n\n${aiData.explanation}\n\n\`\`\`mermaid\n${aiData.mermaid_code}\n\`\`\``,
    });

    console.log("✅ Éxito: Diagrama publicado.");
    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error("❌ Error MIVNA:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
