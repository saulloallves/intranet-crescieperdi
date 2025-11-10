import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!zapiToken || !zapiInstanceId || !zapiClientToken) {
      return new Response(
        JSON.stringify({ 
          status: 'error',
          message: 'Z-API não configurado',
          connected: false,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Checking Z-API status...');

    // Check instance status
    const statusUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/status`;
    
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Client-Token': zapiClientToken,
      },
    });

    const data = await response.json();
    console.log('Z-API status response:', data);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          status: 'error',
          message: 'Erro ao verificar status',
          connected: false,
          details: data,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if instance is connected
    const connected = data.connected === true || data.state === 'CONNECTED';

    return new Response(
      JSON.stringify({ 
        status: 'success',
        connected: connected,
        instanceState: data.state || data.status,
        message: connected ? 'Z-API conectado' : 'Z-API desconectado',
        data: data,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error checking Z-API status:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        connected: false,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
