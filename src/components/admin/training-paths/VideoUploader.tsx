import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, Video, ExternalLink, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VideoUploaderProps {
  onVideoUploaded: (url: string) => void;
}

export function VideoUploader({ onVideoUploaded }: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione um arquivo de vídeo válido',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'Erro',
        description: 'O arquivo deve ter no máximo 100MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);
      setProgress(0);

      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `training-video-${Date.now()}.${fileExt}`;
      const filePath = `training-videos/${fileName}`;

      // Simulate progress (Supabase doesn't provide real-time upload progress)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('trainings')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('trainings')
        .getPublicUrl(filePath);

      setVideoUrl(publicUrl);
      onVideoUploaded(publicUrl);

      toast({
        title: 'Upload concluído!',
        description: 'Vídeo carregado com sucesso',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Erro no upload',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const handleYoutubeUrl = () => {
    if (!youtubeUrl) {
      toast({
        title: 'Erro',
        description: 'Digite uma URL do YouTube',
        variant: 'destructive',
      });
      return;
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(youtubeUrl)) {
      toast({
        title: 'Erro',
        description: 'URL do YouTube inválida',
        variant: 'destructive',
      });
      return;
    }

    setVideoUrl(youtubeUrl);
    onVideoUploaded(youtubeUrl);
    toast({ title: 'URL do YouTube configurada!' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="w-5 h-5" />
          Upload de Vídeo
        </CardTitle>
        <CardDescription>
          Faça upload direto ou use um vídeo do YouTube
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Direct Upload */}
        <div className="space-y-3">
          <Label>Upload Direto (Supabase Storage)</Label>
          <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Arraste um vídeo ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: MP4, WebM, AVI (máx. 100MB)
              </p>
            </div>
            <Input
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="cursor-pointer"
            />
          </div>
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Fazendo upload...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Ou</span>
          </div>
        </div>

        {/* YouTube URL */}
        <div className="space-y-3">
          <Label htmlFor="youtube-url">URL do YouTube</Label>
          <div className="flex gap-2">
            <Input
              id="youtube-url"
              placeholder="https://youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
            <Button onClick={handleYoutubeUrl} variant="outline">
              <ExternalLink className="w-4 h-4 mr-2" />
              Usar
            </Button>
          </div>
        </div>

        {videoUrl && (
          <Alert className="bg-green-50 border-green-200">
            <Check className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-900">
              <strong>Vídeo configurado!</strong>
              <p className="text-xs mt-1 break-all">{videoUrl}</p>
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertDescription className="text-xs">
            💡 <strong>Dica:</strong> Para melhor performance, recomendamos hospedar vídeos longos no YouTube
            e fazer upload direto apenas para vídeos curtos (menos de 5 min).
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
