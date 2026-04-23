UPDATE document_chunks c SET dominio = 'general'
  FROM documentos_proyecto d
 WHERE c.documento_id = d.id AND d.dominio = 'general' AND c.dominio <> 'general';