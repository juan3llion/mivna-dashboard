import "https://deno.land/x/xhr@0.1.0/mod.ts";
import * as jose from 'https://deno.land/x/jose@v5.2.0/index.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-github-event, x-github-delivery',
}

// Filter out noise from file tree (node_modules, .git, dist, lock files, etc.)
function filterFileTree(tree: any[]): any[] {
  const excludePatterns = [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    '.lock',
    '-lock.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lockb'
  ];

  return tree.filter(item => {
    const path = item.path.toLowerCase();
    return !excludePatterns.some(pattern => path.includes(pattern));
  });
}

// Convert PKCS#1 (RSA PRIVATE KEY) to PKCS#8 (PRIVATE KEY) format
// GitHub generates PKCS#1 keys, but jose library requires PKCS#8
function convertPKCS1ToPKCS8(pkcs1Pem: string): string {
  // Check if already PKCS#8
  if (pkcs1Pem.includes('BEGIN PRIVATE KEY')) {
    console.log('🔐 Key is already in PKCS#8 format');
    return pkcs1Pem;
  }
  
  if (!pkcs1Pem.includes('BEGIN RSA PRIVATE KEY')) {
    console.log('⚠️ Unknown key format, attempting to use as-is');
    return pkcs1Pem;
  }
  
  console.log('🔐 Converting PKCS#1 key to PKCS#8 format...');
  
  // Extract base64 content from PKCS#1 PEM
  const pemContent = pkcs1Pem
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  // Decode base64 to bytes
  const pkcs1Bytes = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  
  // PKCS#8 header for RSA algorithm (OID 1.2.840.113549.1.1.1)
  // Structure: SEQUENCE { version INTEGER, algorithm AlgorithmIdentifier, privateKey OCTET STRING }
  const pkcs8Header = new Uint8Array([
    0x30, 0x82, // SEQUENCE, 2-byte length follows
    0x00, 0x00, // placeholder for total length (will be set below)
    0x02, 0x01, 0x00, // INTEGER version = 0
    0x30, 0x0d, // SEQUENCE (algorithm identifier) - 13 bytes
    0x06, 0x09, // OID - 9 bytes
    0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, // RSA OID: 1.2.840.113549.1.1.1
    0x05, 0x00, // NULL parameters
    0x04, 0x82, // OCTET STRING, 2-byte length follows
    0x00, 0x00  // placeholder for PKCS#1 key length (will be set below)
  ]);
  
  // Calculate lengths
  const pkcs1Length = pkcs1Bytes.length;
  const totalLength = pkcs1Length + 22; // 22 = fixed header overhead after initial SEQUENCE tag
  
  // Create final PKCS#8 buffer
  const pkcs8Bytes = new Uint8Array(totalLength + 4); // +4 for SEQUENCE tag and length bytes
  pkcs8Bytes.set(pkcs8Header);
  
  // Set total length (bytes 2-3, after 0x30 0x82)
  pkcs8Bytes[2] = ((totalLength) >> 8) & 0xff;
  pkcs8Bytes[3] = (totalLength) & 0xff;
  
  // Set PKCS#1 key length (bytes 24-25, inside OCTET STRING)
  pkcs8Bytes[24] = (pkcs1Length >> 8) & 0xff;
  pkcs8Bytes[25] = pkcs1Length & 0xff;
  
  // Copy PKCS#1 key data starting at byte 26
  pkcs8Bytes.set(pkcs1Bytes, 26);
  
  // Encode to base64 and format as PEM (64 chars per line)
  const base64 = btoa(String.fromCharCode(...pkcs8Bytes));
  const formattedBase64 = base64.match(/.{1,64}/g)?.join('\n') || base64;
  
  console.log('✅ Key conversion complete');
  return `-----BEGIN PRIVATE KEY-----\n${formattedBase64}\n-----END PRIVATE KEY-----`;
}

// Create a GitHub App JWT for authentication
async function createGitHubAppJWT(appId: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  // Convert PKCS#1 to PKCS#8 if needed (GitHub generates PKCS#1 keys)
  const pkcs8Key = convertPKCS1ToPKCS8(privateKey);
  
  // Parse the PEM private key (now guaranteed to be PKCS#8 format)
  const key = await jose.importPKCS8(pkcs8Key, 'RS256');
  
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
            
            // 4. Filter out noise (node_modules, .git, dist, lock files)
            const filteredTree = filterFileTree(tree);
            const originalCount = tree.length;
            const filteredCount = filteredTree.length;
            console.log(`🔧 Filtered to ${filteredCount} source files (excluded ${originalCount - filteredCount} noise files)`);
            
            // 5. Save to database (using EXTERNAL_ prefixed vars to avoid Lovable Cloud override)
            const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')!;
            const supabaseServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;
            console.log(`🔗 Connecting to Supabase at: ${supabaseUrl}`);
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            
            const { error: upsertError } = await supabase
              .from('repositories')
              .upsert({
                github_repo_id: payload.repository.id,
                name: repoFullName,
                file_tree: filteredTree,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'github_repo_id'
              });
            
            if (upsertError) {
              console.error('❌ Database upsert error:', upsertError);
            } else {
              console.log(`✅ Successfully saved ${filteredCount} files for repo ${repoFullName}`);
            }
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
