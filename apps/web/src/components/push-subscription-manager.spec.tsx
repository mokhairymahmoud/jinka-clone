import React from "react";
import { render, screen } from "@testing-library/react";

import { PushSubscriptionManager } from "./push-subscription-manager";

describe("PushSubscriptionManager", () => {
  it("shows unsupported copy when browser push APIs are missing", async () => {
    render(
      <PushSubscriptionManager
        enableLabel="Enable"
        disableLabel="Disable"
        connectedLabel="Connected"
        disconnectedLabel="Disconnected"
        unsupportedLabel="Unsupported"
      />
    );

    expect(await screen.findByText("Unsupported")).toBeTruthy();
  });
});
