import "https://deno.land/x/xhr@0.1.0/mod.ts";
import * as jose from 'https://deno.land/x/jose@v5.2.0/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-github-event, x-github-delivery',
}

// Create a GitHub App JWT for authentication
async function createGitHubAppJWT(appId: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  // Parse the PEM private key
  const key = await jose.importPKCS8(privateKey, 'RS256');
  
  // Create and sign the JWT
  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(appId)
    .setIssuedAt(now - 60) // 60 seconds in the past to account for clock drift
    .setExpirationTime(now + 600) // 10 minutes from now
    .sign(key);
  
  return jwt;
}

// Exchange JWT for an installation access token
async function getInstallationToken(jwt: string, installationId: number): Promise<string> {
  console.log(`🔑 Getting installation token for installation ${installationId}...`);
  
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'MIVNA-Webhook'
      }
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Failed to get installation token: ${response.status} ${errorText}`);
    throw new Error(`Failed to get installation token: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('✅ Got installation token');
  return data.token;
}

// Fetch the repository file tree
async function fetchRepositoryTree(
  token: string,
  owner: string,
  repo: string,
  ref: string
): Promise<any[]> {
  // Extract branch name from ref (refs/heads/main -> main)
  const branch = ref.replace('refs/heads/', '');
  
  console.log(`📂 Fetching file tree for ${owner}/${repo} at ${branch}...`);
  
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'MIVNA-Webhook'
      }
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Failed to fetch tree: ${response.status} ${errorText}`);
    throw new Error(`Failed to fetch repository tree: ${response.status}`);
  }
  
  const data = await response.json();
  return data.tree || [];
}

// Verify GitHub webhook signature using HMAC SHA-256
async function verifyGitHubSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    console.log('❌ No signature provided');
    return false;
  }
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const computedSignature = 'sha256=' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Constant-time comparison to prevent timing attacks
  if (computedSignature.length !== signature.length) {
    console.log('❌ Signature length mismatch');
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < computedSignature.length; i++) {
    result |= computedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log(`❌ Method not allowed: ${req.method}`);
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get('GITHUB_WEBHOOK_SECRET');
    const appId = Deno.env.get('GITHUB_APP_ID');
    const privateKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY');
    
    if (!secret) {
      console.error('❌ GITHUB_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get the raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    const eventType = req.headers.get('x-github-event');
    const deliveryId = req.headers.get('x-github-delivery');

    console.log(`📥 Received GitHub event: ${eventType} (delivery: ${deliveryId})`);

    // Verify signature
    const isValid = await verifyGitHubSignature(rawBody, signature, secret);
    
    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('✅ Signature verified successfully');

    // Parse the payload
    const payload = JSON.parse(rawBody);

    // Handle different event types
    switch (eventType) {
      case 'push':
        console.log('🚀 PUSH EVENT RECEIVED');
        console.log('Repository:', payload.repository?.full_name);
        console.log('Branch:', payload.ref);
        console.log('Pusher:', payload.pusher?.name);
        console.log('Commits:', payload.commits?.length || 0);
        
        // Log commit details
        payload.commits?.forEach((commit: any, index: number) => {
          console.log(`  Commit ${index + 1}: ${commit.message?.split('\n')[0]} (${commit.id?.substring(0, 7)})`);
          console.log(`    Added: ${commit.added?.length || 0}, Modified: ${commit.modified?.length || 0}, Removed: ${commit.removed?.length || 0}`);
        });

        // Extract installation and repo info for file fetching
        const installationId = payload.installation?.id;
        const repoFullName = payload.repository?.full_name;
        const ref = payload.ref;

        if (installationId && repoFullName && appId && privateKey) {
          try {
            console.log('🔑 Authenticating as GitHub App...');
            
            // 1. Create GitHub App JWT
            const jwt = await createGitHubAppJWT(appId, privateKey);
            
            // 2. Get Installation Token
            const installToken = await getInstallationToken(jwt, installationId);
            
            // 3. Fetch File Tree
            const [owner, repo] = repoFullName.split('/');
            const tree = await fetchRepositoryTree(installToken, owner, repo, ref);
            
            // 4. Log results
            const files = tree.filter((item: any) => item.type === 'blob');
            console.log(`📂 Repository has ${tree.length} items (${files.length} files)`);
            console.log('First 5 files:');
            files.slice(0, 5).forEach((file: any, i: number) => {
              console.log(`  ${i + 1}. ${file.path}`);
            });
          } catch (authError) {
            console.error('❌ GitHub App authentication/fetch error:', authError);
          }
        } else {
          console.log('⚠️ Missing installation ID, repo name, or GitHub App credentials - skipping file fetch');
        }
        break;
        
      case 'ping':
        console.log('🏓 Ping event received - webhook configured successfully!');
        console.log('Zen:', payload.zen);
        console.log('Hook ID:', payload.hook_id);
        break;
        
      case 'pull_request':
        console.log('🔀 Pull Request event');
        console.log('Action:', payload.action);
        console.log('PR #:', payload.pull_request?.number);
        console.log('Title:', payload.pull_request?.title);
        break;
        
      default:
        console.log(`ℹ️ Received event type: ${eventType}`);
        console.log('Payload keys:', Object.keys(payload).join(', '));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      event: eventType,
      delivery_id: deliveryId,
      message: 'Webhook received and verified' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('❌ Webhook processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
