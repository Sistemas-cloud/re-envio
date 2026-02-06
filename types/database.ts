export type AgAlumno = {
  idalum: number;
  nombre: string | null;
  ap_pat: string | null;
  ap_mat: string | null;
  fecna: string | null;
  telefono: string | null;
  email: string | null;
  ciclo: number | null;
  n_ing: number | null;
  g_ing: string | null;
  f_exa: string | null;
  h_exa: string | null;
  e_pro: string | null;
  contacto: string | null;
  alumno_status: number | null;
  npase: string | null;
  alumno_registro: string | null;
  alumno_alta: string | null;
  codigo: number | null;
};

export type Database = {
  public: {
    Tables: {
      ag_alumno: {
        Row: AgAlumno;
        Insert: Partial<AgAlumno>;
        Update: Partial<AgAlumno>;
      };
    };
  };
};
