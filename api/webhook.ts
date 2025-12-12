import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

export const config = {
  runtime: 'nodejs', 
  maxDuration: 60,
};

// Usamos Service Role para tener permisos totales en DB
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

    // Solo PRs
    if (eventType !== "pull_request" || (payload.action !== "opened" && payload.action !== "synchronize")) {
      return res.status(200).json({ message: "Ignorado" });
    }

    const { repository, pull_request, installation } = payload;
    console.log(`🚀 MIVNA: Analizando PR #${pull_request.number}`);

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
    if (!diffData) return res.status(200).json({ message: "Diff vacío" });

    // 2. IA Generation
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
      ACT AS: Senior Software Architect.
      TASK: Analyze this code diff and create a Mermaid.js diagram.
      CONTEXT: Repository: ${repository.full_name}
      DIFF: ${diffData.substring(0, 30000)}
      
      RULES:
      1. Use "graph TD".
      2. WRAP LABELS IN DOUBLE QUOTES.
      3. No special chars in Node IDs.

      OUTPUT JSON: { "mermaid_code": "...", "explanation": "..." }
    `;

    console.log("🧠 Consultando IA...");
    const result = await model.generateContent(prompt);
    const aiData = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());

    // 3. 🛡️ GUARDADO EN DB (CORREGIDO)
    console.log("💾 Guardando en Supabase...");

    // PASO A: Guardar la Instalación (Esto faltaba y causaba el error silencioso)
    const { error: installError } = await supabase.from("github_installations").upsert({
        id: installation.id,
        account_name: repository.owner.login,
        account_avatar_url: repository.owner.avatar_url
    });
    if (installError) throw new Error(`Error Instalación: ${installError.message}`);

    // PASO B: Guardar el Repositorio
    const { error: repoError } = await supabase.from("repositories").upsert({
       id: repository.id,
       full_name: repository.full_name,
       installation_id: installation.id
    });
    if (repoError) throw new Error(`Error Repo: ${repoError.message}`);

    // PASO C: Guardar el Diagrama
    const { error: diagError } = await supabase.from("architecture_diagrams").insert({
        repository_id: repository.id,
        mermaid_code: aiData.mermaid_code,
        explanation_markdown: aiData.explanation,
        pr_number: pull_request.number,
        commit_sha: pull_request.head.sha
    });
    if (diagError) throw new Error(`Error Diagrama: ${diagError.message}`);

    console.log("✅ TODO GUARDADO CORRECTAMENTE EN DB.");

    // 4. Comentar en GitHub
    await appOctokit.rest.issues.createComment({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: pull_request.number,
      body: `## 🏗️ MIVNA Architecture\n\n${aiData.explanation}\n\n\`\`\`mermaid\n${aiData.mermaid_code}\n\`\`\``,
    });

    return res.status(200).json({ success: true });

  } catch (error: any) {
    // Esto hará que el log salga ROJO en Vercel
    console.error("❌ ERROR FATAL:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
