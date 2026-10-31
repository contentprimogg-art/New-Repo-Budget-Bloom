-- Photos de profil: accepte aussi les GIF (gardés animés) et monte la limite à 5 Mo.
-- Les autres formats (PNG, AVIF, HEIC, SVG…) sont convertis en JPEG par l'application avant l'envoi.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'avatars';
