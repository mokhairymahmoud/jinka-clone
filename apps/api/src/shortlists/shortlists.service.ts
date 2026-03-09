import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { ShortlistRecord } from "@jinka-eg/types";
import { PrismaService } from "../common/prisma.service.js";
import { ListingsService } from "../listings/listings.service.js";

@Injectable()
export class ShortlistsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ListingsService) private readonly listingsService: ListingsService
  ) {}

  async createShortlist(userId: string, payload: { name: string; description?: string; clusterIds?: string[] }) {
    const shortlist = await this.prisma.shortlist.create({
      data: {
        name: payload.name,
        description: payload.description,
        members: {
          create: {
            userId,
            role: "owner"
          }
        }
      }
    });

    if (payload.clusterIds && payload.clusterIds.length > 0) {
      await Promise.all(payload.clusterIds.map((clusterId) => this.createShortlistItem(userId, shortlist.id, clusterId)));
    }

    return this.getShortlist(userId, shortlist.id);
  }

  async shareShortlist(userId: string, shortlistId: string, email: string, role = "viewer") {
    await this.assertMembership(shortlistId, userId);

    const normalizedEmail = email.trim().toLowerCase();
    const sharedUser =
      (await this.prisma.user.findUnique({ where: { email: normalizedEmail } })) ??
      (await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          locale: "en"
        }
      }));

    await this.prisma.shortlistMember.upsert({
      where: {
        shortlistId_userId: {
          shortlistId,
          userId: sharedUser.id
        }
      },
      update: {
        role
      },
      create: {
        shortlistId,
        userId: sharedUser.id,
        role
      }
    });

    return this.getShortlist(userId, shortlistId);
  }

  async getShortlist(userId: string, shortlistId: string): Promise<ShortlistRecord> {
    await this.assertMembership(shortlistId, userId);

    const shortlist = await this.prisma.shortlist.findUnique({
      where: { id: shortlistId },
      include: {
        members: {
          include: {
            user: true
          },
          orderBy: {
            createdAt: "asc"
          }
        },
        items: {
          orderBy: {
            createdAt: "desc"
          }
        },
        comments: {
          include: {
            author: true
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    if (!shortlist) {
      throw new NotFoundException("Shortlist not found");
    }

    const listings = await this.listingsService.findAllByIds(shortlist.items.map((item) => item.clusterId));
    const listingMap = new Map(listings.map((listing) => [listing.id, listing]));

    return {
      id: shortlist.id,
      name: shortlist.name,
      description: shortlist.description ?? undefined,
      members: shortlist.members.map((member) => ({
        id: member.user.id,
        email: member.user.email,
        name: member.user.name ?? undefined,
        role: member.role
      })),
      items: shortlist.items
        .map((item) => {
          const listing = listingMap.get(item.clusterId);

          if (!listing) {
            return null;
          }

          return {
            id: item.id,
            clusterId: item.clusterId,
            note: item.note ?? undefined,
            addedAt: item.createdAt.toISOString(),
            listing
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
      comments: shortlist.comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        listingId: comment.listingId ?? undefined,
        createdAt: comment.createdAt.toISOString(),
        author: {
          id: comment.author.id,
          email: comment.author.email,
          name: comment.author.name ?? undefined
        }
      })),
      createdAt: shortlist.createdAt.toISOString(),
      updatedAt: shortlist.updatedAt.toISOString()
    };
  }

  async createShortlistItem(userId: string, shortlistId: string, clusterId: string, note?: string) {
    await this.assertMembership(shortlistId, userId);
    await this.listingsService.findOne(clusterId);

    await this.prisma.shortlistItem.upsert({
      where: {
        shortlistId_clusterId: {
          shortlistId,
          clusterId
        }
      },
      update: {
        ...(note !== undefined ? { note } : {})
      },
      create: {
        shortlistId,
        clusterId,
        addedById: userId,
        note
      }
    });

    return this.getShortlist(userId, shortlistId);
  }

  async addComment(userId: string, shortlistId: string, body: string, clusterId?: string) {
    await this.assertMembership(shortlistId, userId);

    if (clusterId) {
      await this.listingsService.findOne(clusterId);
    }

    await this.prisma.shortlistComment.create({
      data: {
        shortlistId,
        authorId: userId,
        body,
        listingId: clusterId
      }
    });

    return this.getShortlist(userId, shortlistId);
  }

  async getShortlistsForUser(userId: string) {
    const shortlists = await this.prisma.shortlist.findMany({
      where: {
        members: {
          some: {
            userId
          }
        }
      },
      include: {
        _count: {
          select: {
            items: true,
            comments: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return shortlists.map((shortlist) => ({
      id: shortlist.id,
      name: shortlist.name,
      description: shortlist.description ?? undefined,
      itemCount: shortlist._count.items,
      commentCount: shortlist._count.comments,
      updatedAt: shortlist.updatedAt.toISOString()
    }));
  }

  private async assertMembership(shortlistId: string, userId: string) {
    const membership = await this.prisma.shortlistMember.findFirst({
      where: {
        shortlistId,
        userId
      }
    });

    if (!membership) {
      throw new ForbiddenException("You do not have access to this shortlist");
    }
  }
}
