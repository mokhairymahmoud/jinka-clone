import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsArray, IsIn, IsNumber, IsOptional, IsString } from "class-validator";

import type { SearchFilters, SearchSort } from "@jinka-eg/types";

import { ListingsService } from "./listings.service.js";

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => String(entry).split(",")).map((entry) => entry.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  }

  return [];
}

function toNumberArray(value: unknown) {
  return toStringArray(value)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
}

function toOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function asOptionalNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  return undefined;
}

class ListingsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(["rent", "sale"])
  purpose?: SearchFilters["purpose"];

  @IsOptional()
  @IsIn(["resale", "primary", "off_plan"])
  marketSegment?: SearchFilters["marketSegment"];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  propertyTypes?: SearchFilters["propertyTypes"];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  areaIds?: string[];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toNumberArray(value))
  bedrooms?: number[];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => toNumberArray(value))
  bathrooms?: number[];

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => toOptionalNumber(value))
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => toOptionalNumber(value))
  maxPrice?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => toOptionalNumber(value))
  minAreaSqm?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => toOptionalNumber(value))
  maxAreaSqm?: number;

  @IsOptional()
  @IsIn(["relevance", "newest", "price_asc", "price_desc"])
  sort?: SearchSort;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => toOptionalNumber(value))
  north?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => toOptionalNumber(value))
  south?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => toOptionalNumber(value))
  east?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => toOptionalNumber(value))
  west?: number;
}

@Controller("listings")
export class ListingsController {
  constructor(@Inject(ListingsService) private readonly listingsService: ListingsService) {}

  @Get()
  getListings(@Query() query: ListingsQueryDto) {
    return this.listingsService.searchClusters({
      query: query.q,
      purpose: query.purpose,
      marketSegment: query.marketSegment,
      propertyTypes: query.propertyTypes,
      areaIds: query.areaIds,
      bedrooms: query.bedrooms,
      bathrooms: query.bathrooms,
      minPrice: asOptionalNumber(query.minPrice),
      maxPrice: asOptionalNumber(query.maxPrice),
      minAreaSqm: asOptionalNumber(query.minAreaSqm),
      maxAreaSqm: asOptionalNumber(query.maxAreaSqm),
      sort: query.sort,
      bbox:
        [query.north, query.south, query.east, query.west].every((value) => value !== undefined)
          ? {
              north: asOptionalNumber(query.north) ?? 0,
              south: asOptionalNumber(query.south) ?? 0,
              east: asOptionalNumber(query.east) ?? 0,
              west: asOptionalNumber(query.west) ?? 0
            }
          : undefined
    });
  }

  @Get(":id")
  getListing(@Param("id") id: string) {
    return this.listingsService.findOne(id);
  }

  @Get(":id/variants")
  getListingVariants(@Param("id") id: string) {
    return this.listingsService.findVariants(id);
  }
}
