export type Role =
  | "solicitante"
  | "mac"
  | "operaciones"
  | "ingenieria"
  | "servicios"
  | "admin"
  | "superadmin"
  | "analista_contable";

export interface User {
  email: string;
  name: string;
  picture: string;
  role: Role;
}
