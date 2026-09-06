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
  clientRendered: boolean;
};
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
export type AuditReport = Omit<FetchResult, "body"> & {
  bot: BotProfile;
  metadata: Metadata;
  rawMetadata?: Metadata;
  rendered?: {
    finalUrl: string;
    status: number | null;
    responseTimeMs: number;
    htmlSize: number;
  } | null;
  seo: SeoReport;
  robotsTxt: { url: string; status: number; error: string | null };
  robots: RobotsCheck;
};
