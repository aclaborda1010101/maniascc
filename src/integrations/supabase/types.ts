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
