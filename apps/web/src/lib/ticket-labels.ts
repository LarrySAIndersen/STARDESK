const STATUS_LABELS: Record<string, string> = {
  new: "Ny",
  assigned: "Tildelt",
  in_progress: "I gang",
  on_hold: "På hold",
  resolved: "Løst",
  closed: "Lukket",
  cancelled: "Annulleret",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Kritisk",
  high: "Høj",
  medium: "Medium",
  low: "Lav",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function priorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority] ?? priority;
}
