import { Suspense } from "react";

import Kp2SoegPage from "./page-client";

export default function Kp2SoegRoute() {
  return (
    <Suspense fallback={<p className="kp2-page p-6">Indlæser…</p>}>
      <Kp2SoegPage />
    </Suspense>
  );
}
