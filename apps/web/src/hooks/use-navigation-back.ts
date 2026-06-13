"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  browserHistoryCanGoBack,
  navigationBackFallback,
  shouldShowNavigationBack,
} from "@/lib/navigation-back";

export function useNavigationBack() {
  const pathname = usePathname();
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(browserHistoryCanGoBack());
  }, [pathname]);

  const goBack = useCallback(() => {
    if (browserHistoryCanGoBack()) {
      router.back();
      return;
    }
    router.push(navigationBackFallback(pathname));
  }, [pathname, router]);

  const showBack = shouldShowNavigationBack(pathname, canGoBack);

  return { showBack, goBack };
}
