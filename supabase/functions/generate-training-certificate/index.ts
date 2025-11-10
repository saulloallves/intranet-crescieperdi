import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import QRCode from "https://esm.sh/qrcode@1.5.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CertificateRequest {
  user_id: string;
  training_path_id: string;
  score: number;
  completion_date: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { user_id, training_path_id, score, completion_date }: CertificateRequest = await req.json();

    // Buscar dados do usuário
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('full_name, role, unit_code')
      .eq('id', user_id)
      .single();

    if (!profile) {
      throw new Error('Perfil não encontrado');
    }

    // Buscar dados da trilha
    const { data: trainingPath } = await supabaseClient
      .from('training_paths' as any)
      .select('name, estimated_duration_hours')
      .eq('id', training_path_id)
      .single();

    if (!trainingPath) {
      throw new Error('Trilha não encontrada');
    }

    // Gerar ID único do certificado
    const certificateId = crypto.randomUUID();
    const validationUrl = `${Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '')}/validate-certificate/${certificateId}`;

    // Gerar QR Code
    const qrCodeDataUrl = await QRCode.toDataURL(validationUrl, {
      width: 150,
      margin: 1,
    });

    // Criar PDF
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Configurar página
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Borda decorativa
    doc.setDrawColor(236, 72, 153); // primary color
    doc.setLineWidth(2);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
    
    doc.setDrawColor(251, 191, 36); // secondary color
    doc.setLineWidth(1);
    doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

    // Cabeçalho
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(236, 72, 153);
    doc.text('CERTIFICADO', pageWidth / 2, 35, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('DE CONCLUSÃO DE TREINAMENTO', pageWidth / 2, 45, { align: 'center' });

    // Linha decorativa
    doc.setDrawColor(236, 72, 153);
    doc.setLineWidth(0.5);
    doc.line(60, 50, pageWidth - 60, 50);

    // Texto principal
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('Certificamos que', pageWidth / 2, 65, { align: 'center' });

    // Nome do participante
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(profile.full_name.toUpperCase(), pageWidth / 2, 78, { align: 'center' });

    // Linha sob o nome
    const nameWidth = doc.getTextWidth(profile.full_name.toUpperCase());
    doc.setDrawColor(200, 200, 200);
    doc.line((pageWidth - nameWidth) / 2, 80, (pageWidth + nameWidth) / 2, 80);

    // Cargo e unidade
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const roleLabel = getRoleLabel(profile.role);
    doc.text(`${roleLabel} - Unidade ${profile.unit_code || 'N/A'}`, pageWidth / 2, 90, { align: 'center' });

    // Informações do treinamento
    doc.setFontSize(13);
    doc.setTextColor(60, 60, 60);
    doc.text('concluiu com êxito a trilha de treinamento', pageWidth / 2, 102, { align: 'center' });

    // Nome da trilha
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(236, 72, 153);
    doc.text(trainingPath.name, pageWidth / 2, 113, { align: 'center' });

    // Detalhes
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Carga horária: ${trainingPath.estimated_duration_hours}h`, pageWidth / 2, 125, { align: 'center' });
    doc.text(`Pontuação final: ${score}%`, pageWidth / 2, 133, { align: 'center' });

    // Data de conclusão
    const formattedDate = new Date(completion_date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Data de conclusão: ${formattedDate}`, pageWidth / 2, 143, { align: 'center' });

    // QR Code
    doc.addImage(qrCodeDataUrl, 'PNG', pageWidth - 50, pageHeight - 55, 35, 35);
    
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Valide este certificado', pageWidth - 32.5, pageHeight - 15, { align: 'center' });
    doc.text('escaneando o QR Code', pageWidth - 32.5, pageHeight - 12, { align: 'center' });

    // Empresa
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(236, 72, 153);
    doc.text('CRESCI E PERDI', 25, pageHeight - 25);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Sistema de Gestão de Treinamentos', 25, pageHeight - 20);

    // Código de validação
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Código: ${certificateId.substring(0, 8).toUpperCase()}`, 25, pageHeight - 15);

    // Converter PDF para base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    const pdfBuffer = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

    // Upload para Storage
    const fileName = `certificates/${user_id}/${certificateId}.pdf`;
    const { error: uploadError } = await supabaseClient
      .storage
      .from('training-certificates')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    // Obter URL pública
    const { data: urlData } = supabaseClient
      .storage
      .from('training-certificates')
      .getPublicUrl(fileName);

    // Salvar registro no banco
    const { error: dbError } = await supabaseClient
      .from('training_certificates' as any)
      .insert({
        id: certificateId,
        user_id,
        training_path_id,
        score,
        issued_at: new Date().toISOString(),
        pdf_url: urlData.publicUrl,
        verified: false,
        validation_url: validationUrl,
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    // Enviar notificação ao colaborador
    await supabaseClient.from('notifications').insert({
      user_id,
      title: '🎓 Certificado emitido!',
      message: `Parabéns! Seu certificado de conclusão da trilha "${trainingPath.name}" foi emitido com sucesso.`,
      type: 'certificate',
      reference_id: certificateId,
      is_read: false,
    });

    // Notificar gerente (se houver)
    const { data: managerProfiles } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('unit_code', profile.unit_code)
      .in('role', ['gerente', 'admin']);

    if (managerProfiles && managerProfiles.length > 0) {
      const managerNotifications = managerProfiles.map(manager => ({
        user_id: manager.id,
        title: '📜 Novo certificado emitido',
        message: `${profile.full_name} concluiu a trilha "${trainingPath.name}" com ${score}% de aproveitamento.`,
        type: 'certificate',
        reference_id: certificateId,
        is_read: false,
      }));

      await supabaseClient.from('notifications').insert(managerNotifications);
    }

    return new Response(
      JSON.stringify({
        success: true,
        certificate_id: certificateId,
        pdf_url: urlData.publicUrl,
        validation_url: validationUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error generating certificate:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
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
