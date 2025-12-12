import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

export const config = {
  runtime: 'nodejs', 
  maxDuration: 60,
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ Usamos la versión 2.0 que SÍ te funcionó (según tu prueba anterior)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const payload = req.body;
    const eventType = req.headers["x-github-event"];

    if (eventType !== "pull_request" || (payload.action !== "opened" && payload.action !== "synchronize")) {
      return res.status(200).json({ message: "Ignorado" });
    }

    const { repository, pull_request, installation } = payload;
    console.log(`🚀 MIVNA: Analizando PR #${pull_request.number}`);

    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        installationId: installation.id,
      },
    });

    const { data: diffData } = await appOctokit.request(pull_request.diff_url);
    
    if (!diffData) {
      return res.status(200).json({ message: "Diff vacío" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // 🔥 PROMPT MEJORADO: Instrucciones estrictas para Mermaid
    const prompt = `
      ACT AS: Senior Software Architect.
      TASK: Analyze this code diff and create a Mermaid.js diagram.
      CONTEXT: Repository: ${repository.full_name}
      DIFF: ${diffData.substring(0, 30000)}
      
      MERMAID RULES (CRITICAL):
      1. Use "graph TD".
      2. WRAP ALL LABEL TEXT IN DOUBLE QUOTES. Example: A["This is text"] --> B["Function()"].
      3. Do NOT use special characters like () or ; inside node IDs, only in labels.
      4. Keep the diagram simple and high-level.

      OUTPUT STRICT JSON FORMAT ONLY:
      {
        "mermaid_code": "graph TD;\n  A[\"User\"] --> B[\"Login System\"];",
        "explanation": "Brief summary of changes."
      }
    `;

    console.log("🧠 Consultando a Gemini 2.0 Flash...");
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    
    let aiData;
    try {
        aiData = JSON.parse(cleanJson);
    } catch (e) {
        throw new Error("Error parseando JSON de IA");
    }

    // Guardar en Supabase
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

    // Comentar
    await appOctokit.rest.issues.createComment({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: pull_request.number,
      body: `## 🏗️ MIVNA Architecture\n\n${aiData.explanation}\n\n\`\`\`mermaid\n${aiData.mermaid_code}\n\`\`\``,
    });

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
