import { describe, expect, it } from "vitest";

import { groupWorkboardTasks, type WorkboardColumnId } from "./workboard-columns";

import type { WorkboardTask } from "@/types/workboard";

describe("workboard-columns", () => {
  const tasks: WorkboardTask[] = [
    {
      id: "t-2",
      number: 2,
      title: "Active",
      description: "",
      status: "In Progress",
      priority: "P2",
      owner: "",
      tags: "",
      source: "Backlog",
    },
    {
      id: "t-1",
      number: 1,
      title: "Later",
      description: "",
      status: "Backlog",
      priority: "P2",
      owner: "",
      tags: "",
      source: "Backlog",
    },
    {
      id: "t-3",
      number: 3,
      title: "Done",
      description: "",
      status: "Done",
      priority: "P2",
      owner: "",
      tags: "",
      source: "Backlog",
    },
  ];

  it("groups tasks into later, active, and done", () => {
    const grouped = groupWorkboardTasks(tasks);
    expect(grouped.later.map((t) => t.number)).toEqual([1]);
    expect(grouped.active.map((t) => t.number)).toEqual([2]);
    expect(grouped.done.map((t) => t.number)).toEqual([3]);
  });

  it("maps status to column", () => {
    const grouped = groupWorkboardTasks(tasks);
    const columns = Object.keys(grouped) as WorkboardColumnId[];
    expect(columns).toHaveLength(3);
  });
});
