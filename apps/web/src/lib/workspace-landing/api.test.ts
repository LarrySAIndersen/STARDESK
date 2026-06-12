import { describe, expect, it } from "vitest";

import { mapApiLayoutToClient } from "@/lib/workspace-landing/api";

describe("mapApiLayoutToClient", () => {
  it("maps API widget instances to client layout", () => {
    const layout = mapApiLayoutToClient({
      personal: [
        {
          instance_id: "p-1",
          kind: "personal-dashboard",
          order: 0,
          span: "full",
          hidden: false,
        },
      ],
      team: [
        {
          instance_id: "t-1",
          kind: "team-chat",
          order: 1,
          span: "half",
          hidden: true,
        },
      ],
    });

    expect(layout.personal).toEqual([
      {
        instanceId: "p-1",
        kind: "personal-dashboard",
        order: 0,
        span: "full",
        hidden: false,
      },
    ]);
    expect(layout.team[0]).toMatchObject({
      instanceId: "t-1",
      kind: "team-chat",
      hidden: true,
    });
  });
});
