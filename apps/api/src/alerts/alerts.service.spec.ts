import { describe, expect, it, vi } from "vitest";

import { AlertsService } from "./alerts.service.js";

describe("AlertsService.deleteAlert", () => {
  it("deletes an alert and its notifications", async () => {
    const prisma = {
      alert: {
        findFirst: vi.fn().mockResolvedValue({ id: "alert-1", userId: "user-1" }),
        delete: vi.fn().mockResolvedValue({ id: "alert-1" })
      },
      notification: {
        deleteMany: vi.fn().mockResolvedValue({ count: 3 })
      },
      $transaction: vi.fn(async (callback: (tx: typeof prisma) => Promise<number>) => callback(prisma))
    };

    const service = new AlertsService(prisma as never, {} as never);

    await expect(service.deleteAlert("user-1", "alert-1")).resolves.toEqual({
      id: "alert-1",
      deleted: true,
      deletedNotifications: 3
    });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        alertId: "alert-1"
      }
    });
    expect(prisma.alert.delete).toHaveBeenCalledWith({
      where: { id: "alert-1" }
    });
  });
});
