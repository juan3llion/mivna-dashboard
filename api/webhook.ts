import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

export const config = {
  runtime: 'nodejs', 
  maxDuration: 60,
};

// ⚠️ Usamos Service Role para saltarnos las reglas RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    console.log(`🚀 MIVNA: Analizando PR #${pull_request.number} en ${repository.full_name}`);

    // 1. GitHub Auth
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

    // 2. IA Generation
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
      ACT AS: Senior Software Architect.
      TASK: Analyze this code diff and create a Mermaid.js diagram.
      CONTEXT: Repository: ${repository.full_name}
      DIFF: ${diffData.substring(0, 30000)}
      
      CRITICAL MERMAID RULES:
      1. Use "graph TD".
      2. ALWAYS wrap node labels in double quotes.
      3. Do NOT use special characters inside node IDs.

      OUTPUT STRICT JSON FORMAT ONLY:
      {
        "mermaid_code": "graph TD; ...",
        "explanation": "Brief summary."
      }
    `;

    console.log("🧠 Consultando a Gemini 2.5 Flash...");
    const result = await model.generateContent(prompt);
    const aiData = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());

    // 3. 🛡️ GUARDADO EN BASE DE DATOS (CON CHIVATO)
    console.log("💾 Intentando guardar en Supabase...");
    
    // Guardar Repo
    const { error: repoError } = await supabase.from("repositories").upsert({
       id: repository.id,
       full_name: repository.full_name,
       installation_id: installation.id
    });
    
    if (repoError) {
        console.error("❌ ERROR CRÍTICO SUPABASE (Repos):", repoError);
        throw new Error(`Fallo guardando Repo: ${repoError.message}`);
    }

    // Guardar Diagrama
    const { error: diagError } = await supabase.from("architecture_diagrams").insert({
        repository_id: repository.id,
        mermaid_code: aiData.mermaid_code,
        explanation_markdown: aiData.explanation,
        pr_number: pull_request.number,
        commit_sha: pull_request.head.sha
    });

    if (diagError) {
        console.error("❌ ERROR CRÍTICO SUPABASE (Diagrams):", diagError);
        throw new Error(`Fallo guardando Diagrama: ${diagError.message}`);
    }

    console.log("✅ Guardado exitoso en DB.");

    // 4. Comentar en GitHub
    await appOctokit.rest.issues.createComment({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: pull_request.number,
      body: `## 🏗️ MIVNA Architecture\n\n${aiData.explanation}\n\n\`\`\`mermaid\n${aiData.mermaid_code}\n\`\`\``,
    });

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error("❌ Error Fatal:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
