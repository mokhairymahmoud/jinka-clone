import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "../common/prisma.service.js";

@Injectable()
export class PushSubscriptionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getPublicKey() {
    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;

    if (!publicKey) {
      throw new ServiceUnavailableException("Web push is not configured");
    }

    return { publicKey };
  }

  async createSubscription(
    userId: string,
    payload: {
      endpoint: string;
      p256dhKey: string;
      authKey: string;
      platform?: string;
    }
  ) {
    const subscription = await this.prisma.pushSubscription.upsert({
      where: {
        endpoint: payload.endpoint
      },
      update: {
        userId,
        p256dhKey: payload.p256dhKey,
        authKey: payload.authKey,
        platform: payload.platform
      },
      create: {
        userId,
        endpoint: payload.endpoint,
        p256dhKey: payload.p256dhKey,
        authKey: payload.authKey,
        platform: payload.platform
      }
    });

    return {
      id: subscription.id,
      endpoint: subscription.endpoint,
      platform: subscription.platform ?? undefined
    };
  }

  async deleteSubscription(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: {
        userId,
        endpoint
      }
    });

    return {
      success: true,
      endpoint
    };
  }
}
