export type BotProfile = "google" | "browser";
export type CheckStatus = "pass" | "warning" | "error";
export type Colors = Pick<
  typeof import("picocolors"),
  "green" | "yellow" | "red" | "bold" | "cyan" | "dim"
>;
export type Metadata = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  h1Count: number;
  h1s: string[];
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  lang: string | null;
  viewport: boolean;
  hreflang: string[];
  wordCount: number;
  imageCount: number;
  imagesWithAlt: number;
  jsonLd: string[];
  jsonLdRaw: unknown[];
  links: PageLink[];
  clientRendered: boolean;
};
export type PageLink = { url: string; text: string; internal: boolean };
export type FetchResult = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  statusText: string;
  contentType: string | null;
  responseTimeMs: number;
  body: string;
  redirects: string[];
  headers: Record<string, string | null>;
};
export type SeoCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  message: string;
};
export type SeoReport = { checks: SeoCheck[]; score: number };
export type RobotsCheck = {
  status: "allowed" | "disallowed" | "unknown";
  matchedRule: string | null;
};
export type Report = Omit<FetchResult, "body"> & {
  body?: undefined;
  bot: BotProfile;
  metadata: Metadata;
  rawMetadata: Metadata;
  rendered:
    | {
        finalUrl: string;
        status: number | null;
        responseTimeMs: number;
        htmlSize: number;
        consoleErrors: string[];
      }
    | null
    | undefined;
  vitals: import("./vitals.js").Vitals | null;
  vitalsChecks: import("./vitals.js").VitalsCheck[] | null;
  deviceVitals: {
    mobile: import("./vitals.js").Vitals | null;
    desktop: import("./vitals.js").Vitals | null;
  } | null;
  seo: SeoReport;
  site: import("./site-checks.js").SiteChecks;
  schema: import("./schema.js").SchemaReport | null;
  links: import("./links.js").LinkReport | null;
  crawl: {
    sitemap: import("./sitemap.js").SitemapResult;
    report: import("./crawl.js").CrawlReport | null;
  } | null;
  pages?: import("./multi.js").PageAudit[];
  robotsTxt: { url: string; status: number; error: string | null };
  robots: RobotsCheck;
  cancelled: boolean;
};
