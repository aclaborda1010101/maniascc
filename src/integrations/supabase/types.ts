export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      aba_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      aba_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          meta: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          meta?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          meta?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "aba_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "aba_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      actividad_proyecto: {
        Row: {
          created_at: string | null
          descripcion: string
          id: string
          metadata: Json | null
          proyecto_id: string
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          descripcion: string
          id?: string
          metadata?: Json | null
          proyecto_id: string
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          descripcion?: string
          id?: string
          metadata?: Json | null
          proyecto_id?: string
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actividad_proyecto_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      activos: {
        Row: {
          caracteristicas: Json | null
          codigo_postal: string | null
          coordenadas_lat: number | null
          coordenadas_lon: number | null
          creado_por: string | null
          created_at: string | null
          direccion: string | null
          estado: string | null
          fachada_metros: number | null
          fotos_urls: Json | null
          gastos_comunidad: number | null
          id: string
          metros_cuadrados: number | null
          nombre: string
          notas: string | null
          planta: string | null
          proyecto_id: string | null
          renta_actual: number | null
          renta_esperada: number | null
          tipo_activo: string | null
          updated_at: string | null
        }
        Insert: {
          caracteristicas?: Json | null
          codigo_postal?: string | null
          coordenadas_lat?: number | null
          coordenadas_lon?: number | null
          creado_por?: string | null
          created_at?: string | null
          direccion?: string | null
          estado?: string | null
          fachada_metros?: number | null
          fotos_urls?: Json | null
          gastos_comunidad?: number | null
          id?: string
          metros_cuadrados?: number | null
          nombre: string
          notas?: string | null
          planta?: string | null
          proyecto_id?: string | null
          renta_actual?: number | null
          renta_esperada?: number | null
          tipo_activo?: string | null
          updated_at?: string | null
        }
        Update: {
          caracteristicas?: Json | null
          codigo_postal?: string | null
          coordenadas_lat?: number | null
          coordenadas_lon?: number | null
          creado_por?: string | null
          created_at?: string | null
          direccion?: string | null
          estado?: string | null
          fachada_metros?: number | null
          fotos_urls?: Json | null
          gastos_comunidad?: number | null
          id?: string
          metros_cuadrados?: number | null
          nombre?: string
          notas?: string | null
          planta?: string | null
          proyecto_id?: string | null
          renta_actual?: number | null
          renta_esperada?: number | null
          tipo_activo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_tasks: {
        Row: {
          agente_tipo: string
          completado_en: string | null
          coste_estimado: number | null
          creado_por: string | null
          created_at: string | null
          entidad_id: string | null
          entidad_tipo: string | null
          error_mensaje: string | null
          estado: string | null
          id: string
          iniciado_en: string | null
          insights_generados: Json | null
          intentos: number | null
          max_intentos: number | null
          modelo_usado: string | null
          parametros: Json | null
          prioridad: number | null
          resultado: Json | null
          sugerencias: Json | null
          tokens_consumidos: number | null
          updated_at: string | null
        }
        Insert: {
          agente_tipo: string
          completado_en?: string | null
          coste_estimado?: number | null
          creado_por?: string | null
          created_at?: string | null
          entidad_id?: string | null
          entidad_tipo?: string | null
          error_mensaje?: string | null
          estado?: string | null
          id?: string
          iniciado_en?: string | null
          insights_generados?: Json | null
          intentos?: number | null
          max_intentos?: number | null
          modelo_usado?: string | null
          parametros?: Json | null
          prioridad?: number | null
          resultado?: Json | null
          sugerencias?: Json | null
          tokens_consumidos?: number | null
          updated_at?: string | null
        }
        Update: {
          agente_tipo?: string
          completado_en?: string | null
          coste_estimado?: number | null
          creado_por?: string | null
          created_at?: string | null
          entidad_id?: string | null
          entidad_tipo?: string | null
          error_mensaje?: string | null
          estado?: string | null
          id?: string
          iniciado_en?: string | null
          insights_generados?: Json | null
          intentos?: number | null
          max_intentos?: number | null
          modelo_usado?: string | null
          parametros?: Json | null
          prioridad?: number | null
          resultado?: Json | null
          sugerencias?: Json | null
          tokens_consumidos?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_feedback: {
        Row: {
          accion: string | null
          comentario: string | null
          contexto: Json | null
          correccion_sugerida: string | null
          created_at: string | null
          entidad_id: string
          entidad_tipo: string
          feedback_tipo: string | null
          id: string
          metadata: Json | null
          posicion_en_lista: number | null
          rating: number | null
          seleccionado: boolean | null
          tiempo_visualizacion_ms: number | null
          usuario_id: string | null
        }
        Insert: {
          accion?: string | null
          comentario?: string | null
          contexto?: Json | null
          correccion_sugerida?: string | null
          created_at?: string | null
          entidad_id: string
          entidad_tipo: string
          feedback_tipo?: string | null
          id?: string
          metadata?: Json | null
          posicion_en_lista?: number | null
          rating?: number | null
          seleccionado?: boolean | null
          tiempo_visualizacion_ms?: number | null
          usuario_id?: string | null
        }
        Update: {
          accion?: string | null
          comentario?: string | null
          contexto?: Json | null
          correccion_sugerida?: string | null
          created_at?: string | null
          entidad_id?: string
          entidad_tipo?: string
          feedback_tipo?: string | null
          id?: string
          metadata?: Json | null
          posicion_en_lista?: number | null
          rating?: number | null
          seleccionado?: boolean | null
          tiempo_visualizacion_ms?: number | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          accion_tomada: string | null
          acciones_sugeridas: Json | null
          confianza: number | null
          created_at: string | null
          descripcion: string
          entidades_relacionadas: Json | null
          estado: string | null
          feedback_usuario: string | null
          generado_por_tarea_id: string | null
          id: string
          impacto_estimado: string | null
          modelo_usado: string | null
          proyecto_id: string | null
          severidad: string | null
          tipo: string
          titulo: string
          visto_en: string | null
        }
        Insert: {
          accion_tomada?: string | null
          acciones_sugeridas?: Json | null
          confianza?: number | null
          created_at?: string | null
          descripcion: string
          entidades_relacionadas?: Json | null
          estado?: string | null
          feedback_usuario?: string | null
          generado_por_tarea_id?: string | null
          id?: string
          impacto_estimado?: string | null
          modelo_usado?: string | null
          proyecto_id?: string | null
          severidad?: string | null
          tipo: string
          titulo: string
          visto_en?: string | null
        }
        Update: {
          accion_tomada?: string | null
          acciones_sugeridas?: Json | null
          confianza?: number | null
          created_at?: string | null
          descripcion?: string
          entidades_relacionadas?: Json | null
          estado?: string | null
          feedback_usuario?: string | null
          generado_por_tarea_id?: string | null
          id?: string
          impacto_estimado?: string | null
          modelo_usado?: string | null
          proyecto_id?: string | null
          severidad?: string | null
          tipo?: string
          titulo?: string
          visto_en?: string | null
        }
        Relationships: []
      }
      ai_learned_patterns: {
        Row: {
          activo: boolean | null
          confianza: number | null
          created_at: string | null
          datos_agregados: Json | null
          ejemplos_recientes: Json | null
          id: string
          num_observaciones: number | null
          patron_descripcion: string | null
          patron_key: string
          patron_tipo: string
          score_ajuste: number | null
          tasa_exito: number | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          confianza?: number | null
          created_at?: string | null
          datos_agregados?: Json | null
          ejemplos_recientes?: Json | null
          id?: string
          num_observaciones?: number | null
          patron_descripcion?: string | null
          patron_key: string
          patron_tipo: string
          score_ajuste?: number | null
          tasa_exito?: number | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          confianza?: number | null
          created_at?: string | null
          datos_agregados?: Json | null
          ejemplos_recientes?: Json | null
          id?: string
          num_observaciones?: number | null
          patron_descripcion?: string | null
          patron_key?: string
          patron_tipo?: string
          score_ajuste?: number | null
          tasa_exito?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      auditoria_ia: {
        Row: {
          coste_estimado: number | null
          created_at: string
          created_by: string | null
          error_mensaje: string | null
          exito: boolean
          funcion_ia: string | null
          id: string
          latencia_ms: number | null
          local_id: string | null
          match_id: string | null
          modelo: string
          tokens_entrada: number | null
          tokens_salida: number | null
        }
        Insert: {
          coste_estimado?: number | null
          created_at?: string
          created_by?: string | null
          error_mensaje?: string | null
          exito?: boolean
          funcion_ia?: string | null
          id?: string
          latencia_ms?: number | null
          local_id?: string | null
          match_id?: string | null
          modelo?: string
          tokens_entrada?: number | null
          tokens_salida?: number | null
        }
        Update: {
          coste_estimado?: number | null
          created_at?: string
          created_by?: string | null
          error_mensaje?: string | null
          exito?: boolean
          funcion_ia?: string | null
          id?: string
          latencia_ms?: number | null
          local_id?: string | null
          match_id?: string | null
          modelo?: string
          tokens_entrada?: number | null
          tokens_salida?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_ia_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_ia_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      ava_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ava_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          meta: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          meta?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          meta?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ava_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ava_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      configuraciones_tenant_mix: {
        Row: {
          centro_nombre: string
          centro_ubicacion: string | null
          creado_en: string | null
          estado: string | null
          id: string
          operadores_recomendados: Json
          plan: string
          prediccion_ocupacion: number | null
          renta_estimada_total: number | null
          riesgos: Json | null
          score_sinergia_total: number | null
          usuario_id: string | null
        }
        Insert: {
          centro_nombre: string
          centro_ubicacion?: string | null
          creado_en?: string | null
          estado?: string | null
          id?: string
          operadores_recomendados?: Json
          plan?: string
          prediccion_ocupacion?: number | null
          renta_estimada_total?: number | null
          riesgos?: Json | null
          score_sinergia_total?: number | null
          usuario_id?: string | null
        }
        Update: {
          centro_nombre?: string
          centro_ubicacion?: string | null
          creado_en?: string | null
          estado?: string | null
          id?: string
          operadores_recomendados?: Json
          plan?: string
          prediccion_ocupacion?: number | null
          renta_estimada_total?: number | null
          riesgos?: Json | null
          score_sinergia_total?: number | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      contact_interactions: {
        Row: {
          contact_email: string
          contact_id: string | null
          contact_name: string | null
          created_at: string
          first_interaction: string | null
          id: string
          last_interaction: string | null
          message_count: number
          owner_id: string
          sentiment_avg: number | null
          thread_count: number
          topics: string[] | null
          updated_at: string
          visibility: string
        }
        Insert: {
          contact_email: string
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          first_interaction?: string | null
          id?: string
          last_interaction?: string | null
          message_count?: number
          owner_id: string
          sentiment_avg?: number | null
          thread_count?: number
          topics?: string[] | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          contact_email?: string
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          first_interaction?: string | null
          id?: string
          last_interaction?: string | null
          message_count?: number
          owner_id?: string
          sentiment_avg?: number | null
          thread_count?: number
          topics?: string[] | null
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      contactos: {
        Row: {
          activo_id: string | null
          ai_tags: string[] | null
          apellidos: string | null
          cargo: string | null
          creado_por: string | null
          created_at: string | null
          datos_consentimiento: Json | null
          email: string | null
          empresa: string | null
          estilo_negociacion: string | null
          id: string
          in_network: boolean | null
          interaction_count: number | null
          is_favorite: boolean | null
          last_contact: string | null
          linkedin_url: string | null
          nombre: string
          notas_perfil: string | null
          operador_id: string | null
          perfil_ia: Json | null
          plaud_count: number | null
          sentiment: string | null
          subdivision_id: string | null
          telefono: string | null
          updated_at: string | null
          visibility: string
          wa_message_count: number | null
          whatsapp: string | null
        }
        Insert: {
          activo_id?: string | null
          ai_tags?: string[] | null
          apellidos?: string | null
          cargo?: string | null
          creado_por?: string | null
          created_at?: string | null
          datos_consentimiento?: Json | null
          email?: string | null
          empresa?: string | null
          estilo_negociacion?: string | null
          id?: string
          in_network?: boolean | null
          interaction_count?: number | null
          is_favorite?: boolean | null
          last_contact?: string | null
          linkedin_url?: string | null
          nombre: string
          notas_perfil?: string | null
          operador_id?: string | null
          perfil_ia?: Json | null
          plaud_count?: number | null
          sentiment?: string | null
          subdivision_id?: string | null
          telefono?: string | null
          updated_at?: string | null
          visibility?: string
          wa_message_count?: number | null
          whatsapp?: string | null
        }
        Update: {
          activo_id?: string | null
          ai_tags?: string[] | null
          apellidos?: string | null
          cargo?: string | null
          creado_por?: string | null
          created_at?: string | null
          datos_consentimiento?: Json | null
          email?: string | null
          empresa?: string | null
          estilo_negociacion?: string | null
          id?: string
          in_network?: boolean | null
          interaction_count?: number | null
          is_favorite?: boolean | null
          last_contact?: string | null
          linkedin_url?: string | null
          nombre?: string
          notas_perfil?: string | null
          operador_id?: string | null
          perfil_ia?: Json | null
          plaud_count?: number | null
          sentiment?: string | null
          subdivision_id?: string | null
          telefono?: string | null
          updated_at?: string | null
          visibility?: string
          wa_message_count?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contactos_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_subdivision_id_fkey"
            columns: ["subdivision_id"]
            isOneToOne: false
            referencedRelation: "operador_subdivisiones"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          contenido: string
          created_at: string | null
          documento_id: string | null
          dominio: string
          embedding: string | null
          id: string
          metadata: Json | null
          owner_id: string | null
          proyecto_id: string | null
          visibility: string
        }
        Insert: {
          chunk_index?: number
          contenido: string
          created_at?: string | null
          documento_id?: string | null
          dominio?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          owner_id?: string | null
          proyecto_id?: string | null
          visibility?: string
        }
        Update: {
          chunk_index?: number
          contenido?: string
          created_at?: string | null
          documento_id?: string | null
          dominio?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          owner_id?: string | null
          proyecto_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_proyecto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      document_embeddings: {
        Row: {
          chunk_id: string | null
          contenido_normalizado: string | null
          created_at: string | null
          documento_id: string | null
          dominio: string | null
          embedding_json: Json | null
          entidades_detectadas: Json | null
          id: string
          keywords: string[] | null
          modelo_embedding: string | null
          proyecto_id: string | null
          relevancia_calculada: number | null
        }
        Insert: {
          chunk_id?: string | null
          contenido_normalizado?: string | null
          created_at?: string | null
          documento_id?: string | null
          dominio?: string | null
          embedding_json?: Json | null
          entidades_detectadas?: Json | null
          id?: string
          keywords?: string[] | null
          modelo_embedding?: string | null
          proyecto_id?: string | null
          relevancia_calculada?: number | null
        }
        Update: {
          chunk_id?: string | null
          contenido_normalizado?: string | null
          created_at?: string | null
          documento_id?: string | null
          dominio?: string | null
          embedding_json?: Json | null
          entidades_detectadas?: Json | null
          id?: string
          keywords?: string[] | null
          modelo_embedding?: string | null
          proyecto_id?: string | null
          relevancia_calculada?: number | null
        }
        Relationships: []
      }
      document_links: {
        Row: {
          created_at: string
          created_by: string | null
          documento_id: string
          entity_id: string
          entity_type: string
          id: string
          rol: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          documento_id: string
          entity_id: string
          entity_type: string
          id?: string
          rol?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          documento_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          rol?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_links_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_proyecto"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_generados: {
        Row: {
          contexto: string | null
          created_at: string
          documento_proyecto_id: string | null
          id: string
          latencia_ms: number | null
          mode: string
          mode_label: string
          modelo: string | null
          owner_id: string
          proyecto_id: string | null
          storage_path: string | null
          structured_data: Json
          titulo: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          contexto?: string | null
          created_at?: string
          documento_proyecto_id?: string | null
          id?: string
          latencia_ms?: number | null
          mode: string
          mode_label: string
          modelo?: string | null
          owner_id: string
          proyecto_id?: string | null
          storage_path?: string | null
          structured_data?: Json
          titulo?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          contexto?: string | null
          created_at?: string
          documento_proyecto_id?: string | null
          id?: string
          latencia_ms?: number | null
          mode?: string
          mode_label?: string
          modelo?: string | null
          owner_id?: string
          proyecto_id?: string | null
          storage_path?: string | null
          structured_data?: Json
          titulo?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      documentos_proyecto: {
        Row: {
          contacto_id: string | null
          created_at: string | null
          dominio: string | null
          fase_rag: string
          fecha_documento: string | null
          hash_md5: string | null
          id: string
          metadata_extraida: Json | null
          mime_type: string | null
          nivel_sensibilidad: string
          nombre: string
          nombre_normalizado: string | null
          operador_id: string | null
          origen: string
          origen_external_id: string | null
          owner_id: string | null
          procesado_ia: boolean | null
          proyecto_id: string | null
          resumen_ia: string | null
          storage_path: string
          subido_por: string | null
          tamano_bytes: number | null
          taxonomia_id: string | null
          tipo_documento: string | null
          visibility: string
        }
        Insert: {
          contacto_id?: string | null
          created_at?: string | null
          dominio?: string | null
          fase_rag?: string
          fecha_documento?: string | null
          hash_md5?: string | null
          id?: string
          metadata_extraida?: Json | null
          mime_type?: string | null
          nivel_sensibilidad?: string
          nombre: string
          nombre_normalizado?: string | null
          operador_id?: string | null
          origen?: string
          origen_external_id?: string | null
          owner_id?: string | null
          procesado_ia?: boolean | null
          proyecto_id?: string | null
          resumen_ia?: string | null
          storage_path: string
          subido_por?: string | null
          tamano_bytes?: number | null
          taxonomia_id?: string | null
          tipo_documento?: string | null
          visibility?: string
        }
        Update: {
          contacto_id?: string | null
          created_at?: string | null
          dominio?: string | null
          fase_rag?: string
          fecha_documento?: string | null
          hash_md5?: string | null
          id?: string
          metadata_extraida?: Json | null
          mime_type?: string | null
          nivel_sensibilidad?: string
          nombre?: string
          nombre_normalizado?: string | null
          operador_id?: string | null
          origen?: string
          origen_external_id?: string | null
          owner_id?: string | null
          procesado_ia?: boolean | null
          proyecto_id?: string | null
          resumen_ia?: string | null
          storage_path?: string
          subido_por?: string | null
          tamano_bytes?: number | null
          taxonomia_id?: string | null
          tipo_documento?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_proyecto_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_proyecto_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_proyecto_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_proyecto_taxonomia_id_fkey"
            columns: ["taxonomia_id"]
            isOneToOne: false
            referencedRelation: "documentos_taxonomia"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_taxonomia: {
        Row: {
          activo: boolean
          codigo: string
          color: string | null
          created_at: string
          descripcion: string | null
          icono: string | null
          id: string
          nombre: string
          orden: number | null
          parent_id: string | null
        }
        Insert: {
          activo?: boolean
          codigo: string
          color?: string | null
          created_at?: string
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre: string
          orden?: number | null
          parent_id?: string | null
        }
        Update: {
          activo?: boolean
          codigo?: string
          color?: string | null
          created_at?: string
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre?: string
          orden?: number | null
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_taxonomia_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "documentos_taxonomia"
            referencedColumns: ["id"]
          },
        ]
      }
      email_entities: {
        Row: {
          confidence: number
          context_snippet: string | null
          created_at: string
          entity_id: string | null
          entity_name_raw: string
          entity_type: string
          id: string
          mention_count: number
          owner_id: string
          thread_id: string
          visibility: string
        }
        Insert: {
          confidence?: number
          context_snippet?: string | null
          created_at?: string
          entity_id?: string | null
          entity_name_raw: string
          entity_type: string
          id?: string
          mention_count?: number
          owner_id: string
          thread_id: string
          visibility?: string
        }
        Update: {
          confidence?: number
          context_snippet?: string | null
          created_at?: string
          entity_id?: string | null
          entity_name_raw?: string
          entity_type?: string
          id?: string
          mention_count?: number
          owner_id?: string
          thread_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_entities_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_threads: {
        Row: {
          created_at: string
          documento_id: string | null
          first_date: string | null
          id: string
          key_topics: string[] | null
          last_date: string | null
          message_count: number
          metadata: Json
          owner_id: string
          participants: Json
          sentiment: string | null
          subject: string | null
          summary: string | null
          thread_external_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          documento_id?: string | null
          first_date?: string | null
          id?: string
          key_topics?: string[] | null
          last_date?: string | null
          message_count?: number
          metadata?: Json
          owner_id: string
          participants?: Json
          sentiment?: string | null
          subject?: string | null
          summary?: string | null
          thread_external_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          documento_id?: string | null
          first_date?: string | null
          id?: string
          key_topics?: string[] | null
          last_date?: string | null
          message_count?: number
          metadata?: Json
          owner_id?: string
          participants?: Json
          sentiment?: string | null
          subject?: string | null
          summary?: string | null
          thread_external_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      ingestion_jobs: {
        Row: {
          completado_en: string | null
          config: Json
          created_at: string
          estado: string
          failed_items: number
          id: string
          iniciado_en: string | null
          job_type: string
          processed_items: number
          resumen: Json
          skipped_items: number
          total_items: number
          ultimo_error: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completado_en?: string | null
          config?: Json
          created_at?: string
          estado?: string
          failed_items?: number
          id?: string
          iniciado_en?: string | null
          job_type: string
          processed_items?: number
          resumen?: Json
          skipped_items?: number
          total_items?: number
          ultimo_error?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completado_en?: string | null
          config?: Json
          created_at?: string
          estado?: string
          failed_items?: number
          id?: string
          iniciado_en?: string | null
          job_type?: string
          processed_items?: number
          resumen?: Json
          skipped_items?: number
          total_items?: number
          ultimo_error?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      locales: {
        Row: {
          caracteristicas: Json | null
          ciudad: string
          codigo_postal: string
          coordenadas_lat: number | null
          coordenadas_lng: number | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          direccion: string
          estado: Database["public"]["Enums"]["estado_local"]
          id: string
          imagen_url: string | null
          nombre: string
          precio_renta: number
          superficie_m2: number
          updated_at: string
        }
        Insert: {
          caracteristicas?: Json | null
          ciudad?: string
          codigo_postal?: string
          coordenadas_lat?: number | null
          coordenadas_lng?: number | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          direccion: string
          estado?: Database["public"]["Enums"]["estado_local"]
          id?: string
          imagen_url?: string | null
          nombre: string
          precio_renta?: number
          superficie_m2?: number
          updated_at?: string
        }
        Update: {
          caracteristicas?: Json | null
          ciudad?: string
          codigo_postal?: string
          coordenadas_lat?: number | null
          coordenadas_lng?: number | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          direccion?: string
          estado?: Database["public"]["Enums"]["estado_local"]
          id?: string
          imagen_url?: string | null
          nombre?: string
          precio_renta?: number
          superficie_m2?: number
          updated_at?: string
        }
        Relationships: []
      }
      match_predictions: {
        Row: {
          ajuste_feedback: number | null
          ajuste_historico: number | null
          ajuste_sector: number | null
          ajuste_zona: number | null
          comparables_usados: Json | null
          created_at: string | null
          factores_negativos: Json | null
          factores_positivos: Json | null
          id: string
          local_id: string | null
          operador_id: string | null
          probabilidad_exito: number | null
          score_ajustado: number | null
          score_base: number | null
          score_final: number | null
          score_predictivo: number | null
          tiempo_estimado_cierre: number | null
        }
        Insert: {
          ajuste_feedback?: number | null
          ajuste_historico?: number | null
          ajuste_sector?: number | null
          ajuste_zona?: number | null
          comparables_usados?: Json | null
          created_at?: string | null
          factores_negativos?: Json | null
          factores_positivos?: Json | null
          id?: string
          local_id?: string | null
          operador_id?: string | null
          probabilidad_exito?: number | null
          score_ajustado?: number | null
          score_base?: number | null
          score_final?: number | null
          score_predictivo?: number | null
          tiempo_estimado_cierre?: number | null
        }
        Update: {
          ajuste_feedback?: number | null
          ajuste_historico?: number | null
          ajuste_sector?: number | null
          ajuste_zona?: number | null
          comparables_usados?: Json | null
          created_at?: string | null
          factores_negativos?: Json | null
          factores_positivos?: Json | null
          id?: string
          local_id?: string | null
          operador_id?: string | null
          probabilidad_exito?: number | null
          score_ajustado?: number | null
          score_base?: number | null
          score_final?: number | null
          score_predictivo?: number | null
          tiempo_estimado_cierre?: number | null
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["estado_match"]
          explicacion: string | null
          feedback_usuario: string | null
          generado_por: string | null
          id: string
          local_id: string
          operador_id: string
          score: number
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_match"]
          explicacion?: string | null
          feedback_usuario?: string | null
          generado_por?: string | null
          id?: string
          local_id: string
          operador_id: string
          score?: number
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_match"]
          explicacion?: string | null
          feedback_usuario?: string | null
          generado_por?: string | null
          id?: string
          local_id?: string
          operador_id?: string
          score?: number
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
        ]
      }
      negociaciones: {
        Row: {
          activo_id: string | null
          briefing_ia: string | null
          condiciones_actuales: Json | null
          condiciones_finales: Json | null
          condiciones_propuestas: Json | null
          contacto_interlocutor_id: string | null
          creado_por: string | null
          created_at: string | null
          estado: string | null
          fecha_cierre: string | null
          fecha_ultimo_contacto: string | null
          id: string
          motivo_resultado: string | null
          negociador_interno_id: string | null
          notas: string | null
          operador_id: string | null
          probabilidad_cierre: number | null
          proyecto_id: string
          resultado: string | null
          updated_at: string | null
        }
        Insert: {
          activo_id?: string | null
          briefing_ia?: string | null
          condiciones_actuales?: Json | null
          condiciones_finales?: Json | null
          condiciones_propuestas?: Json | null
          contacto_interlocutor_id?: string | null
          creado_por?: string | null
          created_at?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_ultimo_contacto?: string | null
          id?: string
          motivo_resultado?: string | null
          negociador_interno_id?: string | null
          notas?: string | null
          operador_id?: string | null
          probabilidad_cierre?: number | null
          proyecto_id: string
          resultado?: string | null
          updated_at?: string | null
        }
        Update: {
          activo_id?: string | null
          briefing_ia?: string | null
          condiciones_actuales?: Json | null
          condiciones_finales?: Json | null
          condiciones_propuestas?: Json | null
          contacto_interlocutor_id?: string | null
          creado_por?: string | null
          created_at?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_ultimo_contacto?: string | null
          id?: string
          motivo_resultado?: string | null
          negociador_interno_id?: string | null
          notas?: string | null
          operador_id?: string | null
          probabilidad_cierre?: number | null
          proyecto_id?: string
          resultado?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negociaciones_activo_id_fkey"
            columns: ["activo_id"]
            isOneToOne: false
            referencedRelation: "activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negociaciones_contacto_interlocutor_id_fkey"
            columns: ["contacto_interlocutor_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negociaciones_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negociaciones_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      negociaciones_historico: {
        Row: {
          activo_ref: string | null
          concesiones: Json | null
          condiciones_finales: Json | null
          condiciones_iniciales: Json | null
          creado_en: string | null
          duracion_dias: number | null
          id: string
          interlocutor_perfil_id: string | null
          negociador_interno: string
          notas: string | null
          operador_ref: string | null
          probabilidad_cierre_predicha: number | null
          probabilidad_cierre_real: number | null
          resultado: string | null
          usuario_id: string | null
        }
        Insert: {
          activo_ref?: string | null
          concesiones?: Json | null
          condiciones_finales?: Json | null
          condiciones_iniciales?: Json | null
          creado_en?: string | null
          duracion_dias?: number | null
          id?: string
          interlocutor_perfil_id?: string | null
          negociador_interno: string
          notas?: string | null
          operador_ref?: string | null
          probabilidad_cierre_predicha?: number | null
          probabilidad_cierre_real?: number | null
          resultado?: string | null
          usuario_id?: string | null
        }
        Update: {
          activo_ref?: string | null
          concesiones?: Json | null
          condiciones_finales?: Json | null
          condiciones_iniciales?: Json | null
          creado_en?: string | null
          duracion_dias?: number | null
          id?: string
          interlocutor_perfil_id?: string | null
          negociador_interno?: string
          notas?: string | null
          operador_ref?: string | null
          probabilidad_cierre_predicha?: number | null
          probabilidad_cierre_real?: number | null
          resultado?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negociaciones_historico_interlocutor_perfil_id_fkey"
            columns: ["interlocutor_perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles_negociador"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_signals: {
        Row: {
          confidence: number
          context_snippet: string | null
          extracted_at: string
          id: string
          numeric_value: number | null
          owner_id: string
          related_entity_id: string | null
          related_entity_type: string | null
          signal_type: string
          signal_value: string | null
          thread_id: string
          unit: string | null
          visibility: string
        }
        Insert: {
          confidence?: number
          context_snippet?: string | null
          extracted_at?: string
          id?: string
          numeric_value?: number | null
          owner_id: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          signal_type: string
          signal_value?: string | null
          thread_id: string
          unit?: string | null
          visibility?: string
        }
        Update: {
          confidence?: number
          context_snippet?: string | null
          extracted_at?: string
          id?: string
          numeric_value?: number | null
          owner_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          signal_type?: string
          signal_value?: string | null
          thread_id?: string
          unit?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_signals_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          created_at: string
          description: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      onedrive_sync_state: {
        Row: {
          archivos_indexados: number
          config: Json
          created_at: string
          delta_token: string | null
          drive_id: string | null
          estado: string
          root_folder_id: string | null
          total_archivos: number
          total_bytes: number
          ultimo_backfill: string | null
          ultimo_delta: string | null
          ultimo_error: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archivos_indexados?: number
          config?: Json
          created_at?: string
          delta_token?: string | null
          drive_id?: string | null
          estado?: string
          root_folder_id?: string | null
          total_archivos?: number
          total_bytes?: number
          ultimo_backfill?: string | null
          ultimo_delta?: string | null
          ultimo_error?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archivos_indexados?: number
          config?: Json
          created_at?: string
          delta_token?: string | null
          drive_id?: string | null
          estado?: string
          root_folder_id?: string | null
          total_archivos?: number
          total_bytes?: number
          ultimo_backfill?: string | null
          ultimo_delta?: string | null
          ultimo_error?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      operador_subdivisiones: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          operador_id: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          operador_id: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          operador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operador_subdivisiones_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
        ]
      }
      operadores: {
        Row: {
          activo: boolean
          activo_id: string | null
          contacto_email: string | null
          contacto_nombre: string | null
          contacto_telefono: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          direccion: string | null
          id: string
          logo_url: string | null
          matriz_id: string | null
          nombre: string
          perfil_ia: string | null
          presupuesto_max: number
          presupuesto_min: number
          sector: string
          superficie_max: number
          superficie_min: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          activo_id?: string | null
          contacto_email?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          direccion?: string | null
          id?: string
          logo_url?: string | null
          matriz_id?: string | null
          nombre: string
          perfil_ia?: string | null
          presupuesto_max?: number
          presupuesto_min?: number
          sector?: string
          superficie_max?: number
          superficie_min?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          activo_id?: string | null
          contacto_email?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          direccion?: string | null
          id?: string
          logo_url?: string | null
          matriz_id?: string | null
          nombre?: string
          perfil_ia?: string | null
          presupuesto_max?: number
          presupuesto_min?: number
          sector?: string
          superficie_max?: number
          superficie_min?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operadores_activo_id_fkey"
            columns: ["activo_id"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operadores_matriz_id_fkey"
            columns: ["matriz_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
        ]
      }
      patrones_localizacion: {
        Row: {
          comparables: Json | null
          confianza: number | null
          coordenadas_lat: number
          coordenadas_lon: number
          creado_en: string | null
          desglose_variables: Json | null
          fuentes_consultadas: Json | null
          id: string
          oportunidades: Json | null
          radio_km: number | null
          riesgos: Json | null
          score_viabilidad: number | null
          tipo_centro: string | null
          usuario_id: string | null
        }
        Insert: {
          comparables?: Json | null
          confianza?: number | null
          coordenadas_lat: number
          coordenadas_lon: number
          creado_en?: string | null
          desglose_variables?: Json | null
          fuentes_consultadas?: Json | null
          id?: string
          oportunidades?: Json | null
          radio_km?: number | null
          riesgos?: Json | null
          score_viabilidad?: number | null
          tipo_centro?: string | null
          usuario_id?: string | null
        }
        Update: {
          comparables?: Json | null
          confianza?: number | null
          coordenadas_lat?: number
          coordenadas_lon?: number
          creado_en?: string | null
          desglose_variables?: Json | null
          fuentes_consultadas?: Json | null
          id?: string
          oportunidades?: Json | null
          radio_km?: number | null
          riesgos?: Json | null
          score_viabilidad?: number | null
          tipo_centro?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          apellidos: string
          avatar_url: string | null
          created_at: string
          email: string
          evolution_api_key: string | null
          evolution_connected: boolean | null
          evolution_instance_name: string | null
          evolution_instance_url: string | null
          id: string
          imap_connected: boolean | null
          imap_host: string | null
          imap_password_encrypted: string | null
          imap_port: number | null
          imap_user: string | null
          nombre: string
          onedrive_account: string | null
          onedrive_connected: boolean
          onedrive_root_path: string | null
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apellidos?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          evolution_api_key?: string | null
          evolution_connected?: boolean | null
          evolution_instance_name?: string | null
          evolution_instance_url?: string | null
          id?: string
          imap_connected?: boolean | null
          imap_host?: string | null
          imap_password_encrypted?: string | null
          imap_port?: number | null
          imap_user?: string | null
          nombre?: string
          onedrive_account?: string | null
          onedrive_connected?: boolean
          onedrive_root_path?: string | null
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          apellidos?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          evolution_api_key?: string | null
          evolution_connected?: boolean | null
          evolution_instance_name?: string | null
          evolution_instance_url?: string | null
          id?: string
          imap_connected?: boolean | null
          imap_host?: string | null
          imap_password_encrypted?: string | null
          imap_port?: number | null
          imap_user?: string | null
          nombre?: string
          onedrive_account?: string | null
          onedrive_connected?: boolean
          onedrive_root_path?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      perfiles_negociador: {
        Row: {
          actualizado_en: string | null
          contacto_cargo: string | null
          contacto_empresa: string | null
          contacto_nombre: string
          creado_en: string | null
          datos_consentimiento: Json | null
          estilo_primario: string | null
          estilo_secundario: string | null
          historico_resumen: string | null
          id: string
          preferencias_comunicacion: Json | null
          puntos_flexion: Json | null
          usuario_id: string | null
        }
        Insert: {
          actualizado_en?: string | null
          contacto_cargo?: string | null
          contacto_empresa?: string | null
          contacto_nombre: string
          creado_en?: string | null
          datos_consentimiento?: Json | null
          estilo_primario?: string | null
          estilo_secundario?: string | null
          historico_resumen?: string | null
          id?: string
          preferencias_comunicacion?: Json | null
          puntos_flexion?: Json | null
          usuario_id?: string | null
        }
        Update: {
          actualizado_en?: string | null
          contacto_cargo?: string | null
          contacto_empresa?: string | null
          contacto_nombre?: string
          creado_en?: string | null
          datos_consentimiento?: Json | null
          estilo_primario?: string | null
          estilo_secundario?: string | null
          historico_resumen?: string | null
          id?: string
          preferencias_comunicacion?: Json | null
          puntos_flexion?: Json | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      playground_evaluations: {
        Row: {
          created_at: string
          evaluacion: string | null
          fuentes_consultadas: number | null
          id: string
          latencia_ms: number | null
          prompt: string
          respuesta: string
          tools_used: Json | null
          usuario_id: string
          variante_config: Json
          variante_index: number
        }
        Insert: {
          created_at?: string
          evaluacion?: string | null
          fuentes_consultadas?: number | null
          id?: string
          latencia_ms?: number | null
          prompt: string
          respuesta: string
          tools_used?: Json | null
          usuario_id: string
          variante_config?: Json
          variante_index: number
        }
        Update: {
          created_at?: string
          evaluacion?: string | null
          fuentes_consultadas?: number | null
          id?: string
          latencia_ms?: number | null
          prompt?: string
          respuesta?: string
          tools_used?: Json | null
          usuario_id?: string
          variante_config?: Json
          variante_index?: number
        }
        Relationships: []
      }
      privacy_preferences: {
        Row: {
          default_contact_visibility: string
          default_document_visibility: string
          default_email_visibility: string
          share_contacts_with_team: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          default_contact_visibility?: string
          default_document_visibility?: string
          default_email_visibility?: string
          share_contacts_with_team?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          default_contact_visibility?: string
          default_document_visibility?: string
          default_email_visibility?: string
          share_contacts_with_team?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proyecto_contactos: {
        Row: {
          added_at: string
          contacto_id: string
          id: string
          proyecto_id: string
          rol: string | null
        }
        Insert: {
          added_at?: string
          contacto_id: string
          id?: string
          proyecto_id: string
          rol?: string | null
        }
        Update: {
          added_at?: string
          contacto_id?: string
          id?: string
          proyecto_id?: string
          rol?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_contactos_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_contactos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_equipo: {
        Row: {
          created_at: string | null
          id: string
          proyecto_id: string
          rol_proyecto: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          proyecto_id: string
          rol_proyecto?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          proyecto_id?: string
          rol_proyecto?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_equipo_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_operadores: {
        Row: {
          added_at: string
          id: string
          operador_id: string
          proyecto_id: string
          rol: string | null
        }
        Insert: {
          added_at?: string
          id?: string
          operador_id: string
          proyecto_id: string
          rol?: string | null
        }
        Update: {
          added_at?: string
          id?: string
          operador_id?: string
          proyecto_id?: string
          rol?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_operadores_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_operadores_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyectos: {
        Row: {
          cliente_contacto_id: string | null
          codigo_postal: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          estado: Database["public"]["Enums"]["estado_proyecto"]
          fecha_inicio: string | null
          fecha_objetivo: string | null
          id: string
          local_id: string | null
          metadata: Json | null
          nombre: string
          notas: string | null
          presupuesto_estimado: number | null
          responsable_id: string | null
          tipo: Database["public"]["Enums"]["tipo_proyecto"]
          ubicacion: string | null
          updated_at: string
        }
        Insert: {
          cliente_contacto_id?: string | null
          codigo_postal?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_proyecto"]
          fecha_inicio?: string | null
          fecha_objetivo?: string | null
          id?: string
          local_id?: string | null
          metadata?: Json | null
          nombre: string
          notas?: string | null
          presupuesto_estimado?: number | null
          responsable_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_proyecto"]
          ubicacion?: string | null
          updated_at?: string
        }
        Update: {
          cliente_contacto_id?: string | null
          codigo_postal?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_proyecto"]
          fecha_inicio?: string | null
          fecha_objetivo?: string | null
          id?: string
          local_id?: string | null
          metadata?: Json | null
          nombre?: string
          notas?: string | null
          presupuesto_estimado?: number | null
          responsable_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_proyecto"]
          ubicacion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_cliente_contacto_id_fkey"
            columns: ["cliente_contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_reprocess_queue: {
        Row: {
          created_at: string
          documento_id: string
          error_msg: string | null
          estado: string
          id: string
          intentos: number
          task_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          documento_id: string
          error_msg?: string | null
          estado?: string
          id?: string
          intentos?: number
          task_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          documento_id?: string
          error_msg?: string | null
          estado?: string
          id?: string
          intentos?: number
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_reprocess_queue_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_proyecto"
            referencedColumns: ["id"]
          },
        ]
      }
      sinergias_operadores: {
        Row: {
          coeficiente_sinergia: number | null
          fuente: string | null
          id: string
          notas: string | null
          num_observaciones: number | null
          operador_a_id: string | null
          operador_b_id: string | null
          ultima_actualizacion: string | null
        }
        Insert: {
          coeficiente_sinergia?: number | null
          fuente?: string | null
          id?: string
          notas?: string | null
          num_observaciones?: number | null
          operador_a_id?: string | null
          operador_b_id?: string | null
          ultima_actualizacion?: string | null
        }
        Update: {
          coeficiente_sinergia?: number | null
          fuente?: string | null
          id?: string
          notas?: string | null
          num_observaciones?: number | null
          operador_a_id?: string | null
          operador_b_id?: string | null
          ultima_actualizacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sinergias_operadores_operador_a_id_fkey"
            columns: ["operador_a_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinergias_operadores_operador_b_id_fkey"
            columns: ["operador_b_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
        ]
      }
      subdivision_activos: {
        Row: {
          activo_id: string
          created_at: string | null
          id: string
          subdivision_id: string
        }
        Insert: {
          activo_id: string
          created_at?: string | null
          id?: string
          subdivision_id: string
        }
        Update: {
          activo_id?: string
          created_at?: string | null
          id?: string
          subdivision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subdivision_activos_subdivision_id_fkey"
            columns: ["subdivision_id"]
            isOneToOne: false
            referencedRelation: "operador_subdivisiones"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          action_type: string
          agent_id: string | null
          agent_label: string | null
          cost_eur: number | null
          created_at: string
          id: string
          latency_ms: number | null
          metadata: Json | null
          model: string | null
          rag_filter: string | null
          tokens_input: number | null
          tokens_output: number | null
          user_id: string
        }
        Insert: {
          action_type?: string
          agent_id?: string | null
          agent_label?: string | null
          cost_eur?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          model?: string | null
          rag_filter?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id: string
        }
        Update: {
          action_type?: string
          agent_id?: string | null
          agent_label?: string | null
          cost_eur?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          model?: string | null
          rag_filter?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      validaciones_retorno: {
        Row: {
          benchmarks_usados: Json | null
          cerrado_en: string | null
          codigo_postal: string | null
          confianza_global: number | null
          creado_en: string | null
          desviaciones: Json | null
          dossier_storage_path: string | null
          estado: string
          id: string
          metricas_declaradas: Json
          metricas_reales: Json | null
          propietario_ref: string | null
          semaforos: Json | null
          tipo_activo: string | null
          ubicacion: string | null
          usuario_id: string | null
        }
        Insert: {
          benchmarks_usados?: Json | null
          cerrado_en?: string | null
          codigo_postal?: string | null
          confianza_global?: number | null
          creado_en?: string | null
          desviaciones?: Json | null
          dossier_storage_path?: string | null
          estado?: string
          id?: string
          metricas_declaradas?: Json
          metricas_reales?: Json | null
          propietario_ref?: string | null
          semaforos?: Json | null
          tipo_activo?: string | null
          ubicacion?: string | null
          usuario_id?: string | null
        }
        Update: {
          benchmarks_usados?: Json | null
          cerrado_en?: string | null
          codigo_postal?: string | null
          confianza_global?: number | null
          creado_en?: string | null
          desviaciones?: Json | null
          dossier_storage_path?: string | null
          estado?: string
          id?: string
          metricas_declaradas?: Json
          metricas_reales?: Json | null
          propietario_ref?: string | null
          semaforos?: Json | null
          tipo_activo?: string | null
          ubicacion?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      whatsapp_threads: {
        Row: {
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          documento_id: string | null
          first_date: string | null
          id: string
          key_topics: string[] | null
          last_date: string | null
          message_count: number
          metadata: Json
          origen: string
          owner_id: string
          sentiment: string | null
          summary: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          documento_id?: string | null
          first_date?: string | null
          id?: string
          key_topics?: string[] | null
          last_date?: string | null
          message_count?: number
          metadata?: Json
          origen?: string
          owner_id: string
          sentiment?: string | null
          summary?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          documento_id?: string | null
          first_date?: string | null
          id?: string
          key_topics?: string[] | null
          last_date?: string | null
          message_count?: number
          metadata?: Json
          origen?: string
          owner_id?: string
          sentiment?: string | null
          summary?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_threads_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_proyecto"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dashboard_stats: { Args: never; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      propagar_dominio_chunks_lote: {
        Args: { p_limite?: number }
        Returns: number
      }
      propagar_dominio_embeddings_lote: {
        Args: { p_limite?: number }
        Returns: number
      }
      rag_hybrid_search:
        | {
            Args: {
              p_dominio?: string
              p_limit?: number
              p_proyecto_id?: string
              p_query_embedding: string
              p_question: string
            }
            Returns: {
              contenido: string
              documento_id: string
              dominio: string
              fts_rank: number
              hybrid_score: number
              id: string
              metadata: Json
              proyecto_id: string
              vec_distance: number
            }[]
          }
        | {
            Args: {
              p_dominio?: string
              p_dominios?: string[]
              p_limit?: number
              p_proyecto_id?: string
              p_query_embedding: string
              p_question: string
            }
            Returns: {
              contenido: string
              documento_id: string
              dominio: string
              fts_rank: number
              hybrid_score: number
              id: string
              metadata: Json
              proyecto_id: string
              vec_distance: number
            }[]
          }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "inversor"
      estado_local: "disponible" | "en_negociacion" | "ocupado" | "reforma"
      estado_match:
        | "pendiente"
        | "aprobado"
        | "descartado"
        | "sugerido"
        | "contactado"
        | "exito"
      estado_proyecto:
        | "borrador"
        | "activo"
        | "en_pausa"
        | "cerrado_exito"
        | "cerrado_sin_exito"
        | "en_negociacion"
        | "archivado"
      tipo_proyecto:
        | "comercializacion"
        | "negociacion"
        | "centro_completo"
        | "otro"
        | "auditoria_estrategica"
        | "desarrollo_suelo"
        | "traspaso_adquisicion"
        | "farmacia"
        | "desarrollo_comercial"
        | "venta_activo"
        | "optimizacion_centros"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gestor", "inversor"],
      estado_local: ["disponible", "en_negociacion", "ocupado", "reforma"],
      estado_match: [
        "pendiente",
        "aprobado",
        "descartado",
        "sugerido",
        "contactado",
        "exito",
      ],
      estado_proyecto: [
        "borrador",
        "activo",
        "en_pausa",
        "cerrado_exito",
        "cerrado_sin_exito",
        "en_negociacion",
        "archivado",
      ],
      tipo_proyecto: [
        "comercializacion",
        "negociacion",
        "centro_completo",
        "otro",
        "auditoria_estrategica",
        "desarrollo_suelo",
        "traspaso_adquisicion",
        "farmacia",
        "desarrollo_comercial",
        "venta_activo",
        "optimizacion_centros",
      ],
    },
  },
} as const
