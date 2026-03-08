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
      contactos: {
        Row: {
          apellidos: string | null
          cargo: string | null
          creado_por: string | null
          created_at: string | null
          datos_consentimiento: Json | null
          email: string | null
          empresa: string | null
          estilo_negociacion: string | null
          id: string
          linkedin_url: string | null
          nombre: string
          notas_perfil: string | null
          perfil_ia: Json | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          apellidos?: string | null
          cargo?: string | null
          creado_por?: string | null
          created_at?: string | null
          datos_consentimiento?: Json | null
          email?: string | null
          empresa?: string | null
          estilo_negociacion?: string | null
          id?: string
          linkedin_url?: string | null
          nombre: string
          notas_perfil?: string | null
          perfil_ia?: Json | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          apellidos?: string | null
          cargo?: string | null
          creado_por?: string | null
          created_at?: string | null
          datos_consentimiento?: Json | null
          email?: string | null
          empresa?: string | null
          estilo_negociacion?: string | null
          id?: string
          linkedin_url?: string | null
          nombre?: string
          notas_perfil?: string | null
          perfil_ia?: Json | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number
          contenido: string
          created_at: string | null
          documento_id: string | null
          dominio: string
          id: string
          metadata: Json | null
          proyecto_id: string | null
        }
        Insert: {
          chunk_index?: number
          contenido: string
          created_at?: string | null
          documento_id?: string | null
          dominio?: string
          id?: string
          metadata?: Json | null
          proyecto_id?: string | null
        }
        Update: {
          chunk_index?: number
          contenido?: string
          created_at?: string | null
          documento_id?: string | null
          dominio?: string
          id?: string
          metadata?: Json | null
          proyecto_id?: string | null
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
      documentos_proyecto: {
        Row: {
          contacto_id: string | null
          created_at: string | null
          id: string
          metadata_extraida: Json | null
          mime_type: string | null
          nombre: string
          operador_id: string | null
          procesado_ia: boolean | null
          proyecto_id: string | null
          resumen_ia: string | null
          storage_path: string
          subido_por: string | null
          tamano_bytes: number | null
          tipo_documento: string | null
        }
        Insert: {
          contacto_id?: string | null
          created_at?: string | null
          id?: string
          metadata_extraida?: Json | null
          mime_type?: string | null
          nombre: string
          operador_id?: string | null
          procesado_ia?: boolean | null
          proyecto_id?: string | null
          resumen_ia?: string | null
          storage_path: string
          subido_por?: string | null
          tamano_bytes?: number | null
          tipo_documento?: string | null
        }
        Update: {
          contacto_id?: string | null
          created_at?: string | null
          id?: string
          metadata_extraida?: Json | null
          mime_type?: string | null
          nombre?: string
          operador_id?: string | null
          procesado_ia?: boolean | null
          proyecto_id?: string | null
          resumen_ia?: string | null
          storage_path?: string
          subido_por?: string | null
          tamano_bytes?: number | null
          tipo_documento?: string | null
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
        ]
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
      operadores: {
        Row: {
          activo: boolean
          contacto_email: string | null
          contacto_nombre: string | null
          contacto_telefono: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          logo_url: string | null
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
          contacto_email?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          logo_url?: string | null
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
          contacto_email?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          logo_url?: string | null
          nombre?: string
          perfil_ia?: string | null
          presupuesto_max?: number
          presupuesto_min?: number
          sector?: string
          superficie_max?: number
          superficie_min?: number
          updated_at?: string
        }
        Relationships: []
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
          id: string
          nombre: string
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apellidos?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          apellidos?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre?: string
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
            referencedRelation: "perfiles_negociador"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      ],
    },
  },
} as const
