import greetingsData from "./greetings-data.json";

export const HOME_LANDING_GREETINGS_MORNING = greetingsData.morning;
export const HOME_LANDING_GREETINGS_AFTERNOON = greetingsData.afternoon;
export const HOME_LANDING_GREETINGS_EVENING = greetingsData.evening;
export const HOME_LANDING_GREETINGS_NIGHT = greetingsData.night;
export const HOME_LANDING_GREETINGS_THIRD_VISIT = greetingsData.thirdVisit;
export const HOME_LANDING_GREETINGS_REPEAT_VISIT = greetingsData.repeatVisit;

export const HOME_LANDING_GREETING_COUNT =
  HOME_LANDING_GREETINGS_MORNING.length +
  HOME_LANDING_GREETINGS_AFTERNOON.length +
  HOME_LANDING_GREETINGS_EVENING.length +
  HOME_LANDING_GREETINGS_NIGHT.length +
  HOME_LANDING_GREETINGS_THIRD_VISIT.length +
  HOME_LANDING_GREETINGS_REPEAT_VISIT.length;
