/** Pipeline bucket accents — shared by reports and operations dashboard. */
export const BUCKET_ACCENTS: Record<string, string> = {
  modtaget: "border-t-star-blue",
  igangsat: "border-t-star-navy",
  lost: "border-t-emerald-600",
  lukket: "border-t-gray-500",
  genaabnet: "border-t-star-red",
};

export const BUCKET_DESCRIPTIONS_DA: Record<string, string> = {
  modtaget: "Afventer behandling (ny / tildelt)",
  igangsat: "Under aktiv behandling",
  lost: "Løst — afventer evt. lukning",
  lukket: "Afsluttede sager",
  genaabnet: "Genåbnede sager",
};
