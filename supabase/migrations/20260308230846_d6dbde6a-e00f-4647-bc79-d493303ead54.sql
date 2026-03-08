-- Fix proyecto_contactos FK: it currently points to perfiles_negociador but should point to contactos
ALTER TABLE public.proyecto_contactos DROP CONSTRAINT proyecto_contactos_contacto_id_fkey;
ALTER TABLE public.proyecto_contactos ADD CONSTRAINT proyecto_contactos_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE CASCADE;