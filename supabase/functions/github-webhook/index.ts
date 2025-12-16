import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-github-event, x-github-delivery',
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
