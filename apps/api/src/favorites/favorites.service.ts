import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { FavoriteRecord } from "@jinka-eg/types";
import { PrismaService } from "../common/prisma.service.js";
import { ListingsService } from "../listings/listings.service.js";

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ListingsService) private readonly listingsService: ListingsService
  ) {}

  async getFavorites(userId: string): Promise<FavoriteRecord[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    const listings = await this.listingsService.findAllByIds(favorites.map((favorite) => favorite.clusterId));
    const listingMap = new Map(listings.map((listing) => [listing.id, listing]));
    const records: FavoriteRecord[] = [];

    for (const favorite of favorites) {
      const listing = listingMap.get(favorite.clusterId);
      if (!listing) {
        continue;
      }

      records.push({
        id: favorite.id,
        clusterId: favorite.clusterId,
        note: favorite.note ?? undefined,
        state: favorite.state as "saved" | "shortlisted",
        listing
      } satisfies FavoriteRecord);
    }

    return records;
  }

  async createFavorite(userId: string, clusterId: string, note?: string) {
    await this.listingsService.findOne(clusterId);

    const favorite = await this.prisma.favorite.upsert({
      where: {
        userId_clusterId: {
          userId,
          clusterId
        }
      },
      update: {
        ...(note !== undefined ? { note } : {})
      },
      create: {
        userId,
        clusterId,
        note
      }
    });

    const listing = await this.listingsService.findOne(clusterId);

    return {
      id: favorite.id,
      clusterId: favorite.clusterId,
      note: favorite.note ?? undefined,
      state: favorite.state as "saved" | "shortlisted",
      listing
    } satisfies FavoriteRecord;
  }

  async updateFavorite(userId: string, id: string, payload: { note?: string; state?: "saved" | "shortlisted" }) {
    const existing = await this.prisma.favorite.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existing) {
      throw new NotFoundException("Favorite not found");
    }

    const favorite = await this.prisma.favorite.update({
      where: { id },
      data: {
        ...(payload.note !== undefined ? { note: payload.note } : {}),
        ...(payload.state !== undefined ? { state: payload.state } : {})
      }
    });

    const listing = await this.listingsService.findOne(favorite.clusterId);

    return {
      id: favorite.id,
      clusterId: favorite.clusterId,
      note: favorite.note ?? undefined,
      state: favorite.state as "saved" | "shortlisted",
      listing
    } satisfies FavoriteRecord;
  }
}
