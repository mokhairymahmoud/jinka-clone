import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/alerts",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

describe("AppShell", () => {
  it("renders customer navigation without admin switch for regular users", () => {
    render(
      <AppShell
        locale="en"
        labels={{
          brand: "Jinka",
          navSearch: "Search",
          navAlerts: "Alerts",
          navFavorites: "Favorites",
          navInbox: "Announcements",
          navAccount: "Account",
          admin: "Admin"
        }}
        user={{
          id: "user_1",
          email: "demo@example.com",
          name: "Demo",
          locale: "en",
          role: "user",
          notificationPrefs: {}
        }}
      >
        <div>content</div>
      </AppShell>
    );

    expect(screen.getAllByText("Alerts").length).toBeGreaterThan(0);
    expect(screen.getByText("Announcements")).toBeTruthy();
    expect(screen.queryByText("Admin")).toBeNull();
  });
});
