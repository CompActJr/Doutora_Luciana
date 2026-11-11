/** Contratos públicos da API. Nunca incluir modelos internos ou segredos. */
export type HealthResponse = { status: "ok" };
export type ReadinessResponse = { status: "ready" | "unavailable" };

export type UserRole = "admin" | "editor";
export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  disabled: boolean;
  createdAt: string;
};
export type CurrentUserResponse = { user: UserSummary };
export type UsersResponse = { users: UserSummary[] };
