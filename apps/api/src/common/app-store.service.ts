import { Injectable } from "@nestjs/common";

import { mockAlerts, mockListings, mockProjects } from "@jinka-eg/fixtures";
import type { AlertDefinition, FraudAssessment, ListingCluster, ProjectSummary } from "@jinka-eg/types";

interface FavoriteItem {
  id: string;
  clusterId: string;
  note?: string;
  state: "saved" | "shortlisted";
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  type: "new_listing" | "price_drop";
}

interface FraudCase {
  id: string;
  clusterId: string;
  label: FraudAssessment["label"];
  score: number;
  explanation: string[];
  resolved: boolean;
}

@Injectable()
export class AppStoreService {
  private readonly user = {
    id: "user-001",
    email: "demo@example.com",
    name: "Demo User",
    locale: "en",
    role: "admin"
  };

  private readonly listings = structuredClone(mockListings);
  private readonly projects = structuredClone(mockProjects);
  private readonly alerts = structuredClone(mockAlerts);
  private readonly favorites: FavoriteItem[] = [];
  private readonly notifications: NotificationItem[] = [
    {
      id: "notif-001",
      title: "New listing in New Cairo",
      body: "A 3BR apartment from Nawy matched your alert.",
      createdAt: new Date().toISOString(),
      type: "new_listing"
    }
  ];
  private readonly shortlists = [
    {
      id: "shortlist-001",
      name: "Family shortlist",
      members: ["demo@example.com", "partner@example.com"],
      listingIds: ["cluster-new-cairo-001"]
    }
  ];
  private readonly pushSubscriptions: { endpoint: string; platform?: string }[] = [];
  private readonly fraudCases: FraudCase[] = [
    {
      id: "fraud-001",
      clusterId: "cluster-new-cairo-001",
      label: "review",
      score: 0.44,
      explanation: ["Price slightly below area benchmark", "Contact appears across multiple brokers"],
      resolved: false
    }
  ];
  private readonly connectorHealth = [
    { source: "nawy", status: "healthy", lastSuccessAt: new Date().toISOString(), parserCoverage: 0.97 },
    { source: "property_finder", status: "healthy", lastSuccessAt: new Date().toISOString(), parserCoverage: 0.95 },
    { source: "aqarmap", status: "degraded", lastSuccessAt: new Date().toISOString(), parserCoverage: 0.73 },
    { source: "facebook", status: "limited", lastSuccessAt: new Date().toISOString(), parserCoverage: 0.68 }
  ];
  private readonly ingestionRuns = [
    {
      id: "run-001",
      source: "nawy",
      status: "completed",
      discoveredCount: 108,
      parsedCount: 102,
      failedCount: 6,
      extractionRate: 0.94,
      startedAt: new Date(Date.now() - 300000).toISOString(),
      completedAt: new Date().toISOString()
    }
  ];

  getCurrentUser() {
    return this.user;
  }

  getListings() {
    return this.listings;
  }

  getListingById(id: string) {
    return this.listings.find((listing) => listing.id === id);
  }

  getProjects() {
    return this.projects;
  }

  getProjectById(id: string) {
    return this.projects.find((project) => project.id === id);
  }

  getAlerts() {
    return this.alerts;
  }

  createAlert(payload: Omit<AlertDefinition, "id">) {
    const alert = { ...payload, id: `alert-${Date.now()}` };
    this.alerts.unshift(alert);
    return alert;
  }

  updateAlert(id: string, payload: Partial<AlertDefinition>) {
    const alert = this.alerts.find((item) => item.id === id);
    if (!alert) return null;
    Object.assign(alert, payload);
    return alert;
  }

  getFavorites() {
    return this.favorites;
  }

  addFavorite(clusterId: string, note?: string) {
    const favorite = {
      id: `favorite-${Date.now()}`,
      clusterId,
      note,
      state: "saved" as const
    };
    this.favorites.unshift(favorite);
    return favorite;
  }

  updateFavorite(id: string, payload: Partial<FavoriteItem>) {
    const favorite = this.favorites.find((item) => item.id === id);
    if (!favorite) return null;
    Object.assign(favorite, payload);
    return favorite;
  }

  getNotifications() {
    return this.notifications;
  }

  createPushSubscription(endpoint: string, platform?: string) {
    const subscription = { endpoint, platform };
    this.pushSubscriptions.push(subscription);
    return subscription;
  }

  createShortlist(name: string) {
    const shortlist = {
      id: `shortlist-${Date.now()}`,
      name,
      members: [this.user.email],
      listingIds: []
    };
    this.shortlists.unshift(shortlist);
    return shortlist;
  }

  shareShortlist(id: string, email: string) {
    const shortlist = this.shortlists.find((item) => item.id === id);
    if (!shortlist) return null;
    shortlist.members.push(email);
    return shortlist;
  }

  getShortlist(id: string) {
    return this.shortlists.find((item) => item.id === id);
  }

  createReport(clusterId: string, reason: string, details?: string) {
    return {
      id: `report-${Date.now()}`,
      clusterId,
      reason,
      details,
      createdAt: new Date().toISOString()
    };
  }

  getConnectorHealth() {
    return this.connectorHealth;
  }

  getIngestionRuns() {
    return this.ingestionRuns;
  }

  getFraudCases() {
    return this.fraudCases;
  }

  resolveFraudCase(id: string, label: FraudAssessment["label"]) {
    const fraudCase = this.fraudCases.find((item) => item.id === id);
    if (!fraudCase) return null;
    fraudCase.label = label;
    fraudCase.resolved = true;
    return fraudCase;
  }

  mergeCluster(id: string, targetClusterId: string) {
    const source = this.getListingById(id);
    const target = this.getListingById(targetClusterId);
    if (!source || !target) return null;
    target.variants.push(...source.variants);
    target.variantCount = target.variants.length;
    return { mergedInto: target.id, mergedFrom: source.id };
  }

  splitCluster(id: string, variantIds: string[]) {
    const cluster = this.getListingById(id);
    if (!cluster) return null;
    const kept = cluster.variants.filter((variant) => !variantIds.includes(variant.id));
    const splitOut = cluster.variants.filter((variant) => variantIds.includes(variant.id));
    cluster.variants = kept;
    cluster.variantCount = kept.length;
    return {
      sourceClusterId: id,
      newClusterId: `cluster-split-${Date.now()}`,
      splitVariants: splitOut
    };
  }

  searchListings(query?: string) {
    if (!query) return this.listings;
    const needle = query.toLowerCase();
    return this.listings.filter((listing) =>
      [listing.title.en, listing.title.ar, listing.area.name.en, listing.area.name.ar]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }

  getListingsByIds(ids: string[]) {
    return this.listings.filter((listing) => ids.includes(listing.id));
  }
}
