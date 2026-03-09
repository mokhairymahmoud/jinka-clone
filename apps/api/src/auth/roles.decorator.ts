import { SetMetadata } from "@nestjs/common";

import type { AuthenticatedUser } from "./auth.types.js";

export const ROLES_KEY = "roles";
export const Roles = (...roles: AuthenticatedUser["role"][]) => SetMetadata(ROLES_KEY, roles);
