export type SchemaIssue = {
  type: string;
  severity: "error" | "warning";
  message: string;
};

export type SchemaReport = {
  types: string[];
  issues: SchemaIssue[];
  validCount: number;
};

/**
 * Required and recommended properties for the schema types Google uses
 * for rich results. Missing a required property loses the rich result.
 */
const RULES: Record<string, { required: string[]; recommended: string[] }> = {
  Article: {
    required: ["headline"],
    recommended: ["image", "datePublished", "author"],
  },
  NewsArticle: {
    required: ["headline"],
    recommended: ["image", "datePublished", "author"],
  },
  BlogPosting: {
    required: ["headline"],
    recommended: ["image", "datePublished", "author"],
  },
  Product: {
    required: ["name"],
    recommended: ["image", "offers", "aggregateRating", "brand"],
  },
  Offer: { required: ["price", "priceCurrency"], recommended: ["availability"] },
  Recipe: {
    required: ["name", "image"],
    recommended: ["recipeIngredient", "recipeInstructions", "author"],
  },
  Event: {
    required: ["name", "startDate", "location"],
    recommended: ["endDate", "offers", "image"],
  },
  FAQPage: { required: ["mainEntity"], recommended: [] },
  Question: { required: ["name", "acceptedAnswer"], recommended: [] },
  HowTo: { required: ["name", "step"], recommended: ["image", "totalTime"] },
  Organization: { required: ["name"], recommended: ["logo", "url"] },
  LocalBusiness: {
    required: ["name", "address"],
    recommended: ["telephone", "openingHours", "geo"],
  },
  Person: { required: ["name"], recommended: ["url", "image"] },
  BreadcrumbList: { required: ["itemListElement"], recommended: [] },
  VideoObject: {
    required: ["name", "thumbnailUrl", "uploadDate"],
    recommended: ["description", "duration"],
  },
  WebSite: { required: ["name"], recommended: ["url", "potentialAction"] },
};

export function validateSchemas(nodes: unknown[]): SchemaReport {
  const issues: SchemaIssue[] = [];
  const types: string[] = [];
  let validCount = 0;

  for (const node of flatten(nodes)) {
    const type = typeOf(node);
    if (!type) {
      issues.push({ type: "unknown", severity: "error", message: "Node has no @type." });
      continue;
    }
    types.push(type);
    const rule = RULES[type];
    if (!rule) {
      validCount++;
      continue;
    }
    const missingRequired = rule.required.filter((field) => !has(node, field));
    const missingRecommended = rule.recommended.filter((field) => !has(node, field));

    for (const field of missingRequired)
      issues.push({
        type,
        severity: "error",
        message: `${type} is missing required property "${field}".`,
      });
    if (missingRecommended.length)
      issues.push({
        type,
        severity: "warning",
        message: `${type} is missing recommended: ${missingRecommended.join(", ")}.`,
      });
    if (!missingRequired.length) validCount++;
  }

  return { types: [...new Set(types)], issues, validCount };
}

/** Expands @graph containers and nested arrays into a flat node list. */
function flatten(nodes: unknown[]): Record<string, unknown>[] {
  const output: Record<string, unknown>[] = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 5 || !value) return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (Array.isArray(node["@graph"])) {
      node["@graph"].forEach((item) => visit(item, depth + 1));
      return;
    }
    output.push(node);
  };
  nodes.forEach((node) => visit(node, 0));
  return output;
}

function typeOf(node: Record<string, unknown>): string | null {
  const value = node["@type"];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function has(node: Record<string, unknown>, field: string): boolean {
  const value = node[field];
  if (value === undefined || value === null || value === "") return false;
  return !(Array.isArray(value) && value.length === 0);
}
