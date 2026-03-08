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
      farmacias: {
        Row: {
          codigo_postal: string
          created_at: string
          created_by: string | null
          datos_revelados: boolean | null
          id: string
          nombre: string
          riesgo_desabastecimiento: string | null
          score_riesgo: number | null
          updated_at: string
        }
        Insert: {
          codigo_postal?: string
          created_at?: string
          created_by?: string | null
          datos_revelados?: boolean | null
          id?: string
          nombre: string
          riesgo_desabastecimiento?: string | null
          score_riesgo?: number | null
          updated_at?: string
        }
        Update: {
          codigo_postal?: string
          created_at?: string
          created_by?: string | null
          datos_revelados?: boolean | null
          id?: string
          nombre?: string
          riesgo_desabastecimiento?: string | null
          score_riesgo?: number | null
          updated_at?: string
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
    },
  },
} as const
