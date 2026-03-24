import { describe, expect, it, vi } from "vitest";

import { NotificationsService } from "./notifications.service.js";

describe("NotificationsService.getNotifications", () => {
  it("returns all notifications with alert metadata when no filter is provided", async () => {
    const createdAt = new Date("2026-03-19T02:34:37.216Z");
    const prisma = {
      alert: {
        findFirst: vi.fn()
      },
      notification: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "notification-1",
            title: "New match in El Mandara",
            body: "Apartment matched your alert.",
            type: "new_listing",
            createdAt,
            readAt: null,
            alertId: "alert-1",
            clusterId: "cluster-1",
            alert: {
              id: "alert-1",
              name: "Working Alert"
            },
            metadata: {
              eventType: "price_drop",
              bestPrice: 4500000,
              previousBestPrice: 5000000,
              amountDrop: 500000,
              percentageDrop: 10
            },
            deliveries: [
              {
                channel: "inbox",
                status: "delivered",
                attemptedAt: null,
                deliveredAt: createdAt,
                createdAt
              },
              {
                channel: "email",
                status: "deferred",
                attemptedAt: null,
                deliveredAt: null,
                createdAt
              }
            ]
          }
        ])
      }
    };
    const listingsService = {
      findAllByIds: vi.fn().mockResolvedValue([
        {
          id: "cluster-1",
          title: { en: "Listing", ar: "Listing" },
          price: { amount: 100, currency: "EGP", period: "total" },
          purpose: "sale",
          marketSegment: "resale",
          propertyType: "apartment",
          area: {
            id: "area-1",
            slug: "area-1",
            name: { en: "Area", ar: "Area" }
          },
          variantCount: 1,
          variants: [],
          fraudAssessment: {
            label: "safe",
            score: 0,
            reasons: []
          },
          freshnessMinutes: 1
        }
      ])
    };

    const service = new NotificationsService(prisma as never, listingsService as never);

    await expect(service.getNotifications("user-1")).resolves.toEqual([
      {
        id: "notification-1",
        title: "New match in El Mandara",
        body: "Apartment matched your alert.",
        type: "new_listing",
        createdAt: createdAt.toISOString(),
        readAt: null,
        alertId: "alert-1",
        alertName: "Working Alert",
        clusterId: "cluster-1",
        listing: expect.objectContaining({ id: "cluster-1" }),
        metadata: {
          eventType: "price_drop",
          bestPrice: 4500000,
          previousBestPrice: 5000000,
          amountDrop: 500000,
          percentageDrop: 10
        },
        deliveries: [
          {
            channel: "inbox",
            status: "delivered",
            attemptedAt: null,
            deliveredAt: createdAt.toISOString()
          },
          {
            channel: "email",
            status: "deferred",
            attemptedAt: null,
            deliveredAt: null
          }
        ]
      }
    ]);
    expect(prisma.alert.findFirst).not.toHaveBeenCalled();
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1"
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
  });

  it("filters notifications to a specific alert after validating ownership", async () => {
    const prisma = {
      alert: {
        findFirst: vi.fn().mockResolvedValue({ id: "alert-1" })
      },
      notification: {
        findMany: vi.fn().mockResolvedValue([])
      }
    };
    const listingsService = {
      findAllByIds: vi.fn().mockResolvedValue([])
    };

    const service = new NotificationsService(prisma as never, listingsService as never);

    await expect(service.getNotifications("user-1", { alertId: "alert-1" })).resolves.toEqual([]);
    expect(prisma.alert.findFirst).toHaveBeenCalledWith({
      where: {
        id: "alert-1",
        userId: "user-1"
      },
      select: { id: true }
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        alertId: "alert-1"
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
  });
});
