import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { UnitsSearchWorkspace } from "./units-search-workspace";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/en/search/units",
  useSearchParams: () => new URLSearchParams()
}));

vi.mock("./favorite-button", () => ({
  FavoriteButton: () => <button type="button">favorite</button>
}));

vi.mock("./create-alert-form", () => ({
  CreateAlertForm: () => <div>alert form</div>
}));

vi.mock("./search-map-panel", () => ({
  SearchMapPanel: () => <div>map</div>
}));

describe("UnitsSearchWorkspace", () => {
  it("syncs filter state into the URL on submit", () => {
    render(
      <UnitsSearchWorkspace
        locale="en"
        listings={[]}
        favoriteIds={[]}
        areas={[
          {
            id: "area_1",
            slug: "new-cairo",
            name: {
              en: "New Cairo",
              ar: "القاهرة الجديدة"
            }
          }
        ]}
        initialFilters={{}}
        labels={{
          title: "Search",
          body: "Body",
          filters: "Filters",
          searchPlaceholder: "Search area, title, or compound",
          searchAction: "Search",
          sort: "Sort",
          area: "Area",
          purpose: "Purpose",
          marketSegment: "Segment",
          propertyType: "Type",
          bedrooms: "Bedrooms",
          bathrooms: "Bathrooms",
          minPrice: "Min price",
          maxPrice: "Max price",
          minArea: "Min area",
          maxArea: "Max area",
          allAreas: "All areas",
          allPurposes: "All purposes",
          allSegments: "All segments",
          allPropertyTypes: "All property types",
          allBedrooms: "Any bedrooms",
          allBathrooms: "Any bathrooms",
          sortNewest: "Newest",
          sortRelevance: "Relevance",
          sortPriceAsc: "Price ascending",
          sortPriceDesc: "Price descending",
          mapTitle: "Map",
          mapShow: "Open map",
          mapHide: "Hide map",
          mapSearchArea: "Search this area",
          mapUnavailable: "Map unavailable"
        }}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Search area, title, or compound"), {
      target: { value: "new cairo" }
    });
    fireEvent.submit(screen.getByRole("button", { name: "Search" }).closest("form")!);

    expect(push).toHaveBeenCalledWith("/en/search/units?q=new+cairo&sort=relevance");
  });
});
