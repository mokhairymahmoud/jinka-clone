import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { PrismaService } from "../common/prisma.service.js";

type NotificationPrefs = {
  emailEnabled?: boolean;
  pushEnabled?: boolean;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  locale: string;
  role: "user" | "ops_reviewer" | "admin";
  notificationPrefs: NotificationPrefs;
};

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private mapRole(role: UserRole): UserProfile["role"] {
    if (role === UserRole.ADMIN) return "admin";
    if (role === UserRole.OPS_REVIEWER) return "ops_reviewer";
    return "user";
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      role: this.mapRole(user.role),
      notificationPrefs: (user.notificationPrefs as NotificationPrefs | null) ?? {
        emailEnabled: true,
        pushEnabled: true
      }
    };
  }

  async updateProfile(
    userId: string,
    payload: {
      name?: string;
      locale?: string;
      notificationPrefs?: NotificationPrefs;
    }
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.locale !== undefined ? { locale: payload.locale } : {}),
        ...(payload.notificationPrefs !== undefined ? { notificationPrefs: payload.notificationPrefs } : {})
      }
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      role: this.mapRole(user.role),
      notificationPrefs: (user.notificationPrefs as NotificationPrefs | null) ?? {
        emailEnabled: true,
        pushEnabled: true
      }
    };
  }
}
