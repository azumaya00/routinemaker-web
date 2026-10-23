"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

export function GoogleAnalytics() {
  const pathname = usePathname();

  if (pathname === "/reset-password" || pathname.startsWith("/reset-password/")) {
    return null;
  }

  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-0JZNBNKFVF"
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-0JZNBNKFVF');
        `}
      </Script>
    </>
  );
}
