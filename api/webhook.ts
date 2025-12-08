import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

// NOTA: Usamos Node.js runtime por defecto (más compatible)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Usamos 'any' para evitar problemas de tipos si faltan definiciones
export default async function handler(req: any, res: any) {
  // 1. Método permitido
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    // En Node.js Vercel, req.body ya viene listo si es JSON
    const payload = req.body;
    // Las cabeceras en Node suelen venir en minúsculas
    const eventType = req.headers["x-github-event"];

    // 2. Filtro: Solo Pull Requests
    if (eventType !== "pull_request" || (payload.action !== "opened" && payload.action !== "synchronize")) {
      return res.status(200).json({ message: "Ignorado: No es PR o acción relevante" });
    }

    const { repository, pull_request, installation } = payload;
    console.log(`🚀 MIVNA: Analizando PR #${pull_request.number}`);

    // 3. Autenticación GitHub
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        installationId: installation.id,
      },
    });

    // 4. Obtener Diff
    const { data: diffData } = await appOctokit.request(pull_request.diff_url);

    // 5. Gemini 1.5 Flash
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      ACT AS: Senior Software Architect.
      TASK: Create a Mermaid.js diagram code from this diff.
      CONTEXT: Repo: ${repository.full_name}
      DIFF: ${diffData.substring(0, 40000)}
      OUTPUT JSON ONLY: { "mermaid_code": "graph TD; ...", "explanation": "Brief summary." }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    const aiData = JSON.parse(text);

    // 6. Guardar en Supabase
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

    // 7. Comentar en GitHub
    await appOctokit.rest.issues.createComment({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: pull_request.number,
      body: `## 🏗️ MIVNA Update\n\n${aiData.explanation}\n\n\`\`\`mermaid\n${aiData.mermaid_code}\n\`\`\``,
    });

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error("❌ Error MIVNA:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
