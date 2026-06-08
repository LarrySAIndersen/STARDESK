import { Kp2StatsDashboard } from "@/components/kundeportal-2/kp2-stats-dashboard";

export default async function Kp2StatistikPage({
  searchParams,
}: {
  searchParams: Promise<{ vis?: string }>;
}) {
  const { vis } = await searchParams;
  return <Kp2StatsDashboard initialView={vis === "aar" ? "aar" : "maaned"} />;
}
