UPDATE document_chunks c SET dominio = 'comunicaciones'
  FROM documentos_proyecto d
 WHERE c.documento_id = d.id AND d.dominio = 'comunicaciones' AND c.dominio <> 'comunicaciones';