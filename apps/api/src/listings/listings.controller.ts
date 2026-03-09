import { Controller, Get, Param, Query } from "@nestjs/common";

import { ListingsService } from "./listings.service.js";

@Controller("listings")
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  getListings(@Query("q") q?: string) {
    return this.listingsService.findAll(q);
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
