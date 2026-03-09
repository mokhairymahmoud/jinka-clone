import { Injectable, NotFoundException } from "@nestjs/common";

import { AppStoreService } from "../common/app-store.service.js";

@Injectable()
export class ListingsService {
  constructor(private readonly store: AppStoreService) {}

  findAll(query?: string) {
    return this.store.searchListings(query);
  }

  findOne(id: string) {
    const listing = this.store.getListingById(id);
    if (!listing) throw new NotFoundException("Listing not found");
    return listing;
  }

  findVariants(id: string) {
    return this.findOne(id).variants;
  }
}
