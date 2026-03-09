export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "user" | "ops_reviewer" | "admin";
}
