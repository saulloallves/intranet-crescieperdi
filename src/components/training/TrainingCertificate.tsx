import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Award, Download, Share2, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TrainingCertificateProps {
  userId: string;
  trainingPathId: string;
  trainingPathName: string;
  score: number;
  completionDate: string;
  onBack: () => void;
}

export function TrainingCertificate({
  userId,
  trainingPathId,
  trainingPathName,
  score,
  completionDate,
  onBack,
}: TrainingCertificateProps) {
  const [generating, setGenerating] = useState(false);
  const [certificateData, setCertificateData] = useState<{
    id: string;
    pdf_url: string;
    validation_url: string;
  } | null>(null);
  const { toast } = useToast();

  const handleGenerateCertificate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-training-certificate', {
        body: {
          user_id: userId,
          training_path_id: trainingPathId,
          score,
          completion_date: completionDate,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setCertificateData({
          id: data.certificate_id,
          pdf_url: data.pdf_url,
          validation_url: data.validation_url,
        });

        toast({
          title: 'Certificado gerado!',
          description: 'Seu certificado foi emitido com sucesso.',
        });
      } else {
        throw new Error('Erro ao gerar certificado');
      }
    } catch (error: any) {
      console.error('Error generating certificate:', error);
      toast({
        title: 'Erro ao gerar certificado',
        description: error.message || 'Não foi possível gerar o certificado. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!certificateData) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Certificado - ${trainingPathName}`,
          text: `Confira meu certificado de conclusão da trilha "${trainingPathName}" com ${score}% de aproveitamento!`,
          url: certificateData.validation_url,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: copiar link
      await navigator.clipboard.writeText(certificateData.validation_url);
      toast({
        title: 'Link copiado!',
        description: 'O link do certificado foi copiado para a área de transferência.',
      });
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
          <Award className="w-10 h-10 text-white" />
        </div>
        <CardTitle className="text-2xl">Parabéns pela conclusão!</CardTitle>
        <CardDescription className="text-base">
          Você concluiu com sucesso a trilha de treinamento
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg border-2 border-primary/20">
          <h3 className="text-xl font-semibold text-center mb-4">{trainingPathName}</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{score}%</div>
              <div className="text-sm text-muted-foreground">Aproveitamento</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {new Date(completionDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </div>
              <div className="text-sm text-muted-foreground">Data de conclusão</div>
            </div>
          </div>

          {certificateData && (
            <Alert className="bg-green-50 border-green-200 mb-4">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-900">
                Certificado emitido com sucesso! Código: <strong>{certificateData.id.substring(0, 8).toUpperCase()}</strong>
              </AlertDescription>
            </Alert>
          )}

          {!certificateData ? (
            <Button
              onClick={handleGenerateCertificate}
              disabled={generating}
              className="w-full gap-2"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Gerando certificado...
                </>
              ) : (
                <>
                  <Award className="w-5 h-5" />
                  Gerar Certificado
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => window.open(certificateData.pdf_url, '_blank')}
                  variant="default"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </Button>
                <Button
                  onClick={handleShare}
                  variant="outline"
                  className="gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Compartilhar
                </Button>
              </div>
              <Button
                onClick={() => window.open(certificateData.validation_url, '_blank')}
                variant="secondary"
                className="w-full gap-2"
                size="sm"
              >
                <ExternalLink className="w-4 h-4" />
                Validar Certificado
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Informações do Certificado</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• O certificado é emitido automaticamente após a conclusão da trilha</p>
            <p>• Possui QR Code para validação online</p>
            <p>• Pode ser compartilhado nas redes sociais</p>
            <p>• É armazenado permanentemente no sistema</p>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={onBack} variant="outline" className="flex-1">
            Voltar
          </Button>
          {certificateData && (
            <Button onClick={() => window.location.href = '/minha-jornada'} className="flex-1">
              Ver Minhas Trilhas
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
