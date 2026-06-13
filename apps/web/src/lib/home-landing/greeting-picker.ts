import {
  HOME_LANDING_GREETINGS_AFTERNOON,
  HOME_LANDING_GREETINGS_EVENING,
  HOME_LANDING_GREETINGS_MORNING,
  HOME_LANDING_GREETINGS_NIGHT,
  HOME_LANDING_GREETINGS_REPEAT_VISIT,
  HOME_LANDING_GREETINGS_THIRD_VISIT,
} from "./greetings";

export type TimeSlot = "morning" | "afternoon" | "evening" | "night";

const TIME_SLOT_POOLS: Record<TimeSlot, readonly string[]> = {
  morning: HOME_LANDING_GREETINGS_MORNING,
  afternoon: HOME_LANDING_GREETINGS_AFTERNOON,
  evening: HOME_LANDING_GREETINGS_EVENING,
  night: HOME_LANDING_GREETINGS_NIGHT,
};

export function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 5 && hour < 12) {
    return "morning";
  }
  if (hour >= 12 && hour < 17) {
    return "afternoon";
  }
  if (hour >= 17 && hour < 22) {
    return "evening";
  }
  return "night";
}

export function formatHomeLandingGreeting(template: string, displayName: string): string {
  return template.replaceAll("{name}", displayName.trim() || "du");
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function stableIndex(seed: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return ((seed % length) + length) % length;
}

export function pickHomeLandingGreeting(options: {
  displayName: string;
  visitCountToday: number;
  now?: Date;
}): string {
  const now = options.now ?? new Date();
  const slot = getTimeSlot(now.getHours());
  const weekday = now.getDay();
  const seed =
    dayOfYear(now) * 13 +
    weekday * 29 +
    now.getHours() * 7 +
    options.visitCountToday * 41;

  let pool: readonly string[];
  if (options.visitCountToday === 3) {
    pool = HOME_LANDING_GREETINGS_THIRD_VISIT;
  } else if (options.visitCountToday >= 4) {
    pool = HOME_LANDING_GREETINGS_REPEAT_VISIT;
  } else {
    pool = TIME_SLOT_POOLS[slot];
  }

  const index = stableIndex(seed, pool.length);
  return formatHomeLandingGreeting(pool[index], options.displayName);
}
