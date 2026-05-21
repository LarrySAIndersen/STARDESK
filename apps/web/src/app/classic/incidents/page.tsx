import { ClassicModulePage } from "@/components/classic/classic-module-page";
import { classicModuleBySegment } from "@/lib/classic-modules";

export const dynamic = "force-dynamic";

export default function ClassicIncidentsPage() {
  const classicModule = classicModuleBySegment("incidents");
  if (!classicModule) {
    return null;
  }
  return <ClassicModulePage module={classicModule} />;
}
