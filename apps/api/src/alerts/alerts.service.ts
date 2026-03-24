import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { AlertDeliveryCadence, ListingCluster, SearchFilters } from "@jinka-eg/types";
import { PrismaService } from "../common/prisma.service.js";
import { ListingsService } from "../listings/listings.service.js";

const INITIAL_ALERT_MATCH_LIMIT = 25;

function toJsonSearchFilters(filters: SearchFilters): Prisma.InputJsonObject {
  const json: Record<string, Prisma.InputJsonValue> = {};

  if (filters.locale !== undefined) json.locale = filters.locale;
  if (filters.query !== undefined) json.query = filters.query;
  if (filters.purpose !== undefined) json.purpose = filters.purpose;
  if (filters.marketSegment !== undefined) json.marketSegment = filters.marketSegment;
  if (filters.propertyTypes !== undefined) json.propertyTypes = [...filters.propertyTypes];
  if (filters.areaIds !== undefined) json.areaIds = [...filters.areaIds];
  if (filters.bedrooms !== undefined) json.bedrooms = [...filters.bedrooms];
  if (filters.bathrooms !== undefined) json.bathrooms = [...filters.bathrooms];
  if (filters.minPrice !== undefined) json.minPrice = filters.minPrice;
  if (filters.maxPrice !== undefined) json.maxPrice = filters.maxPrice;
  if (filters.minAreaSqm !== undefined) json.minAreaSqm = filters.minAreaSqm;
  if (filters.maxAreaSqm !== undefined) json.maxAreaSqm = filters.maxAreaSqm;
  if (filters.compoundIds !== undefined) json.compoundIds = [...filters.compoundIds];
  if (filters.developerIds !== undefined) json.developerIds = [...filters.developerIds];
  if (filters.sort !== undefined) json.sort = filters.sort;
  if (filters.bbox !== undefined) {
    json.bbox = {
      north: filters.bbox.north,
      south: filters.bbox.south,
      east: filters.bbox.east,
      west: filters.bbox.west
    } satisfies Prisma.InputJsonObject;
  }

  return json;
}

function mapAlertRecord(
  alert: {
    id: string;
    name: string;
    locale: string;
    filters: Prisma.JsonValue;
    isPaused: boolean;
    snoozedUntil: Date | null;
    deliveryCadence: string;
    minPriceDropPercent: number | null;
    minPriceDropAmount: number | null;
    notifyByPush: boolean;
    notifyByEmail: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    lastMatchedAt: Date | null;
  }
) {
  return {
    id: alert.id,
    name: alert.name,
    locale: alert.locale as "en" | "ar",
    filters: alert.filters as SearchFilters,
    isPaused: alert.isPaused,
    snoozedUntil: alert.snoozedUntil?.toISOString() ?? null,
    deliveryCadence: alert.deliveryCadence as AlertDeliveryCadence,
    minPriceDropPercent: alert.minPriceDropPercent,
    minPriceDropAmount: alert.minPriceDropAmount,
    notifyByPush: alert.notifyByPush,
    notifyByEmail: alert.notifyByEmail,
    quietHoursStart: alert.quietHoursStart ?? undefined,
    quietHoursEnd: alert.quietHoursEnd ?? undefined,
    lastMatchedAt: alert.lastMatchedAt?.toISOString() ?? null
  };
}

@Injectable()
export class AlertsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ListingsService) private readonly listingsService: ListingsService
  ) {}

  async getAlerts(userId: string) {
    const alerts = await this.prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    return alerts.map((alert) => mapAlertRecord(alert));
  }

  async createAlert(
    userId: string,
    payload: {
      name: string;
      locale: "en" | "ar";
      filters: SearchFilters;
      isPaused?: boolean;
      snoozedUntil?: string;
      deliveryCadence?: AlertDeliveryCadence;
      minPriceDropPercent?: number | null;
      minPriceDropAmount?: number | null;
      notifyByPush: boolean;
      notifyByEmail: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
    }
  ) {
    const alert = await this.prisma.alert.create({
      data: {
        userId,
        name: payload.name,
        locale: payload.locale,
        filters: toJsonSearchFilters(payload.filters),
        isPaused: payload.isPaused ?? false,
        snoozedUntil: payload.snoozedUntil ? new Date(payload.snoozedUntil) : null,
        deliveryCadence: payload.deliveryCadence ?? "immediate",
        minPriceDropPercent: payload.minPriceDropPercent ?? null,
        minPriceDropAmount: payload.minPriceDropAmount ?? null,
        notifyByPush: payload.notifyByPush,
        notifyByEmail: payload.notifyByEmail,
        quietHoursStart: payload.quietHoursStart,
        quietHoursEnd: payload.quietHoursEnd
      }
    });

    try {
      await this.backfillInitialNotifications(alert.id, alert.userId, alert.name, payload.filters);
    } catch (error) {
      console.error("Unable to backfill initial alert notifications", error);
    }

    return mapAlertRecord(alert);
  }

  async updateAlert(
    userId: string,
    id: string,
    payload: {
      name?: string;
      filters?: SearchFilters;
      isPaused?: boolean;
      deliveryCadence?: AlertDeliveryCadence;
      minPriceDropPercent?: number | null;
      minPriceDropAmount?: number | null;
      notifyByPush?: boolean;
      notifyByEmail?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
      snoozedUntil?: string;
      clearSnooze?: boolean;
    }
  ) {
    const existing = await this.prisma.alert.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existing) {
      throw new NotFoundException("Alert not found");
    }

    const alert = await this.prisma.alert.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.filters !== undefined ? { filters: toJsonSearchFilters(payload.filters) } : {}),
        ...(payload.isPaused !== undefined ? { isPaused: payload.isPaused } : {}),
        ...(payload.deliveryCadence !== undefined ? { deliveryCadence: payload.deliveryCadence } : {}),
        ...(payload.minPriceDropPercent !== undefined ? { minPriceDropPercent: payload.minPriceDropPercent } : {}),
        ...(payload.minPriceDropAmount !== undefined ? { minPriceDropAmount: payload.minPriceDropAmount } : {}),
        ...(payload.notifyByPush !== undefined ? { notifyByPush: payload.notifyByPush } : {}),
        ...(payload.notifyByEmail !== undefined ? { notifyByEmail: payload.notifyByEmail } : {}),
        ...(payload.quietHoursStart !== undefined ? { quietHoursStart: payload.quietHoursStart } : {}),
        ...(payload.quietHoursEnd !== undefined ? { quietHoursEnd: payload.quietHoursEnd } : {}),
        ...(payload.clearSnooze ? { snoozedUntil: null } : {}),
        ...(payload.snoozedUntil !== undefined ? { snoozedUntil: new Date(payload.snoozedUntil) } : {})
      }
    });

    return mapAlertRecord(alert);
  }

  async deleteAlert(userId: string, id: string) {
    const existing = await this.prisma.alert.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existing) {
      throw new NotFoundException("Alert not found");
    }

    const deletedNotifications = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.notification.deleteMany({
        where: {
          userId,
          alertId: id
        }
      });

      await tx.alert.delete({
        where: { id }
      });

      return count;
    });

    return {
      id,
      deleted: true,
      deletedNotifications
    };
  }

  async testAlert(userId: string, id: string) {
    const alert = await this.prisma.alert.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!alert) {
      throw new NotFoundException("Alert not found");
    }

    const matches = await this.listingsService.searchClusters(alert.filters as SearchFilters);

    return {
      id: alert.id,
      matchedListingIds: matches.map((listing) => listing.id)
    };
  }

  private async backfillInitialNotifications(
    alertId: string,
    userId: string,
    alertName: string,
    filters: SearchFilters
  ) {
    const matches = await this.listingsService.searchClusters(filters);

    await Promise.all(
      matches.slice(0, INITIAL_ALERT_MATCH_LIMIT).map((listing) =>
        this.prisma.notification.upsert({
          where: {
            dedupeKey: this.getInitialMatchDedupeKey(alertId, listing.id)
          },
          update: {
            title: this.buildInitialMatchTitle(listing),
            body: this.buildInitialMatchBody(listing, alertName),
            metadata: this.buildInitialMatchMetadata(listing)
          },
          create: {
            userId,
            alertId,
            clusterId: listing.id,
            type: "new_listing",
            title: this.buildInitialMatchTitle(listing),
            body: this.buildInitialMatchBody(listing, alertName),
            dedupeKey: this.getInitialMatchDedupeKey(alertId, listing.id),
            metadata: this.buildInitialMatchMetadata(listing)
          }
        })
      )
    );
  }

  private buildInitialMatchTitle(listing: ListingCluster) {
    return `New match in ${listing.area.name.en}`;
  }

  private buildInitialMatchBody(listing: ListingCluster, alertName: string) {
    return `${listing.title.en} matched your alert ${alertName}.`;
  }

  private buildInitialMatchMetadata(listing: ListingCluster): Prisma.InputJsonObject {
    return {
      eventType: "new_listing",
      bestPrice: listing.price.amount,
      variantCount: listing.variantCount,
      source: "alert_backfill"
    };
  }

  private getInitialMatchDedupeKey(alertId: string, clusterId: string) {
    return `new_listing:${alertId}:${clusterId}`;
  }
}
