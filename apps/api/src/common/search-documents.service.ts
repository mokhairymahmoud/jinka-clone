import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { refreshSearchDocumentsStatements } from "@jinka-eg/config";
import type { SearchFilters, SearchSort } from "@jinka-eg/types";
import { PrismaService } from "./prisma.service.js";

type ListingDocumentRow = {
  clusterId: string;
};

type ProjectDocumentRow = {
  projectId: string;
};

function hasTextQuery(query?: string) {
  return typeof query === "string" && query.trim().length > 0;
}

function resolveSearchSort(sort: SearchSort | undefined, query?: string) {
  if (sort) {
    return sort;
  }

  return hasTextQuery(query) ? "relevance" : "newest";
}

@Injectable()
export class SearchDocumentsService {
  private readonly logger = new Logger(SearchDocumentsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async refreshAll() {
    for (const statement of refreshSearchDocumentsStatements) {
      await this.prisma.$executeRawUnsafe(statement);
    }
  }

  async searchListingClusterIds(filters: SearchFilters, limit = 60) {
    const query = hasTextQuery(filters.query) ? filters.query!.trim() : undefined;
    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query) {
      conditions.push(Prisma.sql`query_document @@ websearch_to_tsquery('simple', ${query})`);
    }

    if (filters.purpose) {
      conditions.push(Prisma.sql`purpose = ${filters.purpose}`);
    }

    if (filters.marketSegment) {
      conditions.push(Prisma.sql`market_segment = ${filters.marketSegment}`);
    } else {
      conditions.push(Prisma.sql`market_segment <> 'off_plan'`);
    }

    if (filters.propertyTypes?.length) {
      conditions.push(Prisma.sql`property_type IN (${Prisma.join(filters.propertyTypes)})`);
    }

    if (filters.areaIds?.length) {
      conditions.push(Prisma.sql`area_slug IN (${Prisma.join(filters.areaIds)})`);
    }

    if (filters.bedrooms?.length) {
      conditions.push(Prisma.sql`bedrooms IN (${Prisma.join(filters.bedrooms)})`);
    }

    if (filters.bathrooms?.length) {
      conditions.push(Prisma.sql`bathrooms IN (${Prisma.join(filters.bathrooms)})`);
    }

    if (typeof filters.minPrice === "number") {
      conditions.push(Prisma.sql`best_price >= ${filters.minPrice}`);
    }

    if (typeof filters.maxPrice === "number") {
      conditions.push(Prisma.sql`best_price <= ${filters.maxPrice}`);
    }

    if (typeof filters.minAreaSqm === "number") {
      conditions.push(Prisma.sql`area_sqm >= ${filters.minAreaSqm}`);
    }

    if (typeof filters.maxAreaSqm === "number") {
      conditions.push(Prisma.sql`area_sqm <= ${filters.maxAreaSqm}`);
    }

    if (filters.bbox) {
      conditions.push(
        Prisma.sql`location IS NOT NULL AND ST_Intersects(location, ST_MakeEnvelope(${filters.bbox.west}, ${filters.bbox.south}, ${filters.bbox.east}, ${filters.bbox.north}, 4326))`
      );
    }

    const sort = resolveSearchSort(filters.sort, query);
    const orderClause =
      sort === "price_asc"
        ? Prisma.sql`best_price ASC NULLS LAST, updated_at DESC`
        : sort === "price_desc"
          ? Prisma.sql`best_price DESC NULLS LAST, updated_at DESC`
          : sort === "newest"
            ? Prisma.sql`updated_at DESC`
            : query
              ? Prisma.sql`rank DESC, updated_at DESC`
              : Prisma.sql`updated_at DESC`;

    return this.prisma.$queryRaw<ListingDocumentRow[]>(Prisma.sql`
      SELECT cluster_id AS "clusterId"
      FROM (
        SELECT
          cluster_id,
          updated_at,
          best_price,
          query_document,
          purpose,
          market_segment,
          property_type,
          area_slug,
          bedrooms,
          bathrooms,
          area_sqm,
          location,
          ${query ? Prisma.sql`ts_rank_cd(query_document, websearch_to_tsquery('simple', ${query}))` : Prisma.sql`0`} AS rank
        FROM listing_search_documents
      ) listing_documents
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY ${orderClause}
      LIMIT ${limit}
    `);
  }

  async searchProjectIds(query?: string, sort?: SearchSort, limit = 60) {
    const searchQuery = hasTextQuery(query) ? query!.trim() : undefined;
    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (searchQuery) {
      conditions.push(Prisma.sql`query_document @@ websearch_to_tsquery('simple', ${searchQuery})`);
    }

    const resolvedSort = resolveSearchSort(sort, searchQuery);
    const orderClause =
      resolvedSort === "price_asc"
        ? Prisma.sql`starting_price ASC NULLS LAST, updated_at DESC`
        : resolvedSort === "price_desc"
          ? Prisma.sql`starting_price DESC NULLS LAST, updated_at DESC`
          : resolvedSort === "newest"
            ? Prisma.sql`updated_at DESC`
            : searchQuery
              ? Prisma.sql`rank DESC, updated_at DESC`
              : Prisma.sql`updated_at DESC`;

    return this.prisma.$queryRaw<ProjectDocumentRow[]>(Prisma.sql`
      SELECT project_id AS "projectId"
      FROM (
        SELECT
          project_id,
          starting_price,
          updated_at,
          query_document,
          ${searchQuery ? Prisma.sql`ts_rank_cd(query_document, websearch_to_tsquery('simple', ${searchQuery}))` : Prisma.sql`0`} AS rank
        FROM project_search_documents
      ) project_documents
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY ${orderClause}
      LIMIT ${limit}
    `);
  }

  async refreshAllSafely(context: string) {
    try {
      await this.refreshAll();
    } catch (error) {
      this.logger.warn(`Unable to refresh search documents after ${context}: ${(error as Error).message}`);
    }
  }
}
