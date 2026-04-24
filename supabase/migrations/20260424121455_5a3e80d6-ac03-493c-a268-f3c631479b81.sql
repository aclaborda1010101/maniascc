ALTER TABLE public.document_links 
  DROP CONSTRAINT document_links_entity_type_check;

ALTER TABLE public.document_links 
  ADD CONSTRAINT document_links_entity_type_check
  CHECK (entity_type IN (
    'proyecto','operador','contacto','activo',
    'negociacion','subdivision','documento'
  ));