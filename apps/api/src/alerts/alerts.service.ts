import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { SearchFilters } from "@jinka-eg/types";
import { PrismaService } from "../common/prisma.service.js";
import { ListingsService } from "../listings/listings.service.js";

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

    return alerts.map((alert) => ({
      id: alert.id,
      name: alert.name,
      locale: alert.locale as "en" | "ar",
      filters: alert.filters as SearchFilters,
      notifyByPush: alert.notifyByPush,
      notifyByEmail: alert.notifyByEmail,
      quietHoursStart: alert.quietHoursStart ?? undefined,
      quietHoursEnd: alert.quietHoursEnd ?? undefined
    }));
  }

  async createAlert(
    userId: string,
    payload: {
      name: string;
      locale: "en" | "ar";
      filters: SearchFilters;
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
        notifyByPush: payload.notifyByPush,
        notifyByEmail: payload.notifyByEmail,
        quietHoursStart: payload.quietHoursStart,
        quietHoursEnd: payload.quietHoursEnd
      }
    });

    return {
      id: alert.id,
      name: alert.name,
      locale: alert.locale as "en" | "ar",
      filters: alert.filters as SearchFilters,
      notifyByPush: alert.notifyByPush,
      notifyByEmail: alert.notifyByEmail,
      quietHoursStart: alert.quietHoursStart ?? undefined,
      quietHoursEnd: alert.quietHoursEnd ?? undefined
    };
  }

  async updateAlert(
    userId: string,
    id: string,
    payload: {
      name?: string;
      filters?: SearchFilters;
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
        ...(payload.filters !== undefined ? { filters: toJsonSearchFilters(payload.filters) } : {})
      }
    });

    return {
      id: alert.id,
      name: alert.name,
      locale: alert.locale as "en" | "ar",
      filters: alert.filters as SearchFilters,
      notifyByPush: alert.notifyByPush,
      notifyByEmail: alert.notifyByEmail,
      quietHoursStart: alert.quietHoursStart ?? undefined,
      quietHoursEnd: alert.quietHoursEnd ?? undefined
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
}
