-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('announcements', 'announcements', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime']::text[]),
  ('recognitions', 'recognitions', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]),
  ('manuals', 'manuals', true, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png', 'video/mp4']::text[]),
  ('checklists', 'checklists', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for announcements bucket (public read, admin write)
CREATE POLICY "Anyone can view announcement files"
ON storage.objects FOR SELECT
USING (bucket_id = 'announcements');

CREATE POLICY "Admins and gestores can upload announcement files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'announcements' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'gestor_setor')
  )
);

CREATE POLICY "Admins and gestores can update announcement files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'announcements' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'gestor_setor')
  )
);

CREATE POLICY "Admins and gestores can delete announcement files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'announcements' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'gestor_setor')
  )
);

-- Storage policies for recognitions bucket (public read, admin write)
CREATE POLICY "Anyone can view recognition files"
ON storage.objects FOR SELECT
USING (bucket_id = 'recognitions');

CREATE POLICY "Admins and gestores can upload recognition files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'recognitions' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'gestor_setor')
  )
);

CREATE POLICY "Admins and gestores can delete recognition files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'recognitions' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'gestor_setor')
  )
);

-- Storage policies for manuals bucket (public read, admin write)
CREATE POLICY "Anyone can view manual files"
ON storage.objects FOR SELECT
USING (bucket_id = 'manuals');

CREATE POLICY "Admins and gestores can upload manual files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'manuals' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'gestor_setor')
  )
);

CREATE POLICY "Admins and gestores can delete manual files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'manuals' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'gestor_setor')
  )
);

-- Storage policies for checklists bucket (user can upload own files)
CREATE POLICY "Anyone can view checklist files"
ON storage.objects FOR SELECT
USING (bucket_id = 'checklists');

CREATE POLICY "Users can upload own checklist files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'checklists' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own checklist files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'checklists' AND
  auth.uid()::text = (storage.foldername(name))[1]
);