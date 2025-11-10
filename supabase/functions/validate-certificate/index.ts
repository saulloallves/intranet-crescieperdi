import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const certificateId = url.pathname.split('/').pop();

    if (!certificateId) {
      throw new Error('ID do certificado não fornecido');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Buscar certificado
    const { data: certificate, error } = await supabaseClient
      .from('training_certificates' as any)
      .select(`
        *,
        profiles:user_id (full_name, role, unit_code),
        training_paths:training_path_id (name, estimated_duration_hours)
      `)
      .eq('id', certificateId)
      .single();

    if (error || !certificate) {
      throw new Error('Certificado não encontrado');
    }

    // HTML de validação
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Validação de Certificado - Cresci e Perdi</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 100%;
            padding: 40px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #ec4899, #fbbf24);
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
          }
          h1 {
            color: #1a1a1a;
            font-size: 28px;
            margin-bottom: 10px;
          }
          .status {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
          }
          .info {
            margin: 30px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 15px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .label {
            color: #6b7280;
            font-weight: 500;
          }
          .value {
            color: #1a1a1a;
            font-weight: 600;
            text-align: right;
          }
          .actions {
            margin-top: 30px;
            display: flex;
            gap: 10px;
          }
          .btn {
            flex: 1;
            padding: 14px;
            border-radius: 8px;
            border: none;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            text-align: center;
            transition: all 0.2s;
          }
          .btn-primary {
            background: linear-gradient(135deg, #ec4899, #fbbf24);
            color: white;
          }
          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
          }
          .code {
            font-family: 'Courier New', monospace;
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="icon">✓</div>
            <h1>Certificado Válido</h1>
            <span class="status">AUTENTICADO</span>
          </div>
          
          <div class="info">
            <div class="info-row">
              <span class="label">Nome</span>
              <span class="value">${certificate.profiles.full_name}</span>
            </div>
            <div class="info-row">
              <span class="label">Cargo</span>
              <span class="value">${getRoleLabel(certificate.profiles.role)}</span>
            </div>
            <div class="info-row">
              <span class="label">Unidade</span>
              <span class="value">${certificate.profiles.unit_code || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="label">Trilha</span>
              <span class="value">${certificate.training_paths.name}</span>
            </div>
            <div class="info-row">
              <span class="label">Carga Horária</span>
              <span class="value">${certificate.training_paths.estimated_duration_hours}h</span>
            </div>
            <div class="info-row">
              <span class="label">Pontuação</span>
              <span class="value">${certificate.score}%</span>
            </div>
            <div class="info-row">
              <span class="label">Data de Emissão</span>
              <span class="value">${new Date(certificate.issued_at).toLocaleDateString('pt-BR')}</span>
            </div>
            <div class="info-row">
              <span class="label">Código</span>
              <span class="value code">${certificateId.substring(0, 8).toUpperCase()}</span>
            </div>
          </div>

          <div class="actions">
            <a href="${certificate.file_url}" class="btn btn-primary" target="_blank">
              📄 Baixar Certificado
            </a>
          </div>

          <div class="footer">
            <p>Cresci e Perdi - Sistema de Gestão de Treinamentos</p>
            <p>Este certificado foi emitido digitalmente e pode ser validado através deste link.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error: any) {
    console.error('Error validating certificate:', error);
    
    const errorHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Erro - Validação de Certificado</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f3f4f6;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            max-width: 400px;
          }
          .icon {
            font-size: 60px;
            margin-bottom: 20px;
          }
          h1 {
            color: #ef4444;
            margin-bottom: 10px;
          }
          p {
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">❌</div>
          <h1>Certificado não encontrado</h1>
          <p>O certificado que você está tentando validar não existe ou foi removido.</p>
        </div>
      </body>
      </html>
    `;

    return new Response(errorHtml, {
      status: 404,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }
});

function getRoleLabel(role: string): string {
  const roleMap: Record<string, string> = {
    'avaliadora': 'Avaliadora',
    'gerente': 'Gerente',
    'social_midia': 'Social Mídia',
    'operador_caixa': 'Operador de Caixa',
    'franqueado': 'Franqueado',
    'suporte': 'Equipe de Suporte',
    'colaborador': 'Colaborador',
    'admin': 'Administrador',
  };
  return roleMap[role] || role;
}
