import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

// ⚠️ ESTO ES LO NUEVO: Forzamos el motor Node.js
export const config = {
  runtime: 'nodejs', 
  maxDuration: 60, // Le damos hasta 60 segundos para pensar
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Usamos 'any' en los tipos para evitar conflictos de compilación en Vercel
export default async function handler(req: any, res: any) {
  // 1. Validar Método
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    // 2. Preparar datos (En Node.js req.body ya viene parseado usualmente)
    const payload = req.body;
    const eventType = req.headers["x-github-event"];

    console.log(`📡 Evento recibido: ${eventType}`);

    // 3. Filtro: Solo Pull Requests (abiertos o sincronizados)
    if (eventType !== "pull_request" || (payload.action !== "opened" && payload.action !== "synchronize")) {
      return res.status(200).json({ message: "Ignorado: No es un evento de interés" });
    }

    const { repository, pull_request, installation } = payload;
    console.log(`🚀 MIVNA: Analizando PR #${pull_request.number} en ${repository.full_name}`);

    // 4. Autenticación GitHub (Octokit)
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        installationId: installation.id,
      },
    });

    // 5. Obtener el Diff (El código que cambió)
    const { data: diffData } = await appOctokit.request(pull_request.diff_url);
    
    if (!diffData) {
      throw new Error("No se pudo obtener el diff del PR");
    }

    // 6. Cerebro: Google Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      ACT AS: Senior Software Architect.
      TASK: Analyze this code diff and create a Mermaid.js diagram.
      CONTEXT: Repository: ${repository.full_name}
      DIFF: ${diffData.substring(0, 30000)}
      
      OUTPUT STRICT JSON FORMAT:
      {
        "mermaid_code": "graph TD; ...",
        "explanation": "Brief summary of architectural changes (max 3 sentences)."
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    // Limpieza básica del JSON por si la IA añade markdown ```json ... ```
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const aiData = JSON.parse(cleanJson);

    // 7. Guardar en Base de Datos (Supabase)
    // Primero aseguramos que el repo existe
    await supabase.from("repositories").upsert({
       id: repository.id,
       full_name: repository.full_name,
       installation_id: installation.id
    });

    // Guardamos el diagrama
    await supabase.from("architecture_diagrams").insert({
        repository_id: repository.id,
        mermaid_code: aiData.mermaid_code,
        explanation_markdown: aiData.explanation,
        pr_number: pull_request.number,
        commit_sha: pull_request.head.sha
    });

    // 8. Comentar en el PR
    await appOctokit.rest.issues.createComment({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: pull_request.number,
      body: `## 🏗️ MIVNA Architecture Update\n\n${aiData.explanation}\n\n\`\`\`mermaid\n${aiData.mermaid_code}\n\`\`\``,
    });

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error("❌ Error MIVNA:", error.message);
    // Devolvemos 500 para ver el error en los logs, pero respondemos JSON
    return res.status(500).json({ error: error.message });
  }
}
