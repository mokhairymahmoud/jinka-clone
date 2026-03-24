import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { NotificationDeliveryStatus, NotificationItem } from "@jinka-eg/types";
import { PrismaService } from "../common/prisma.service.js";
import { ListingsService } from "../listings/listings.service.js";

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ListingsService) private readonly listingsService: ListingsService
  ) {}

  async getNotifications(userId: string, options?: { alertId?: string }): Promise<NotificationItem[]> {
    if (options?.alertId) {
      const alert = await this.prisma.alert.findFirst({
        where: {
          id: options.alertId,
          userId
        },
        select: { id: true }
      });

      if (!alert) {
        throw new NotFoundException("Alert not found");
      }
    }

    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(options?.alertId ? { alertId: options.alertId } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        alert: {
          select: {
            id: true,
            name: true
          }
        },
        deliveries: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });
    const listingIds = notifications
      .map((notification) => notification.clusterId)
      .filter((clusterId): clusterId is string => Boolean(clusterId));
    const listings = await this.listingsService.findAllByIds(listingIds);
    const listingMap = new Map(listings.map((listing) => [listing.id, listing]));

    return notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type as "new_listing" | "price_drop",
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
      alertId: notification.alert?.id ?? notification.alertId ?? undefined,
      alertName: notification.alert?.name ?? undefined,
      clusterId: notification.clusterId ?? undefined,
      listing: notification.clusterId ? listingMap.get(notification.clusterId) : undefined,
      metadata: ((notification.metadata ?? null) as NotificationItem["metadata"]) ?? undefined,
      deliveries: notification.deliveries.map((delivery) => ({
        channel: delivery.channel as "inbox" | "email" | "push",
        status: delivery.status as NotificationDeliveryStatus,
        attemptedAt: delivery.attemptedAt?.toISOString() ?? null,
        deliveredAt: delivery.deliveredAt?.toISOString() ?? null
      }))
    }));
  }
}
