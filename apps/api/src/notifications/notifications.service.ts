import { Inject, Injectable } from "@nestjs/common";

import type { NotificationItem } from "@jinka-eg/types";
import { PrismaService } from "../common/prisma.service.js";
import { ListingsService } from "../listings/listings.service.js";

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ListingsService) private readonly listingsService: ListingsService
  ) {}

  async getNotifications(userId: string): Promise<NotificationItem[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50
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
      clusterId: notification.clusterId ?? undefined,
      listing: notification.clusterId ? listingMap.get(notification.clusterId) : undefined
    }));
  }
}
