#!/usr/bin/env node
import { Command } from "commander";
import { run } from "./app.js";

new Command()
  .name("sitebot")
  .description("Fast terminal SEO checker")
  .version("0.2.0")
  .argument("[url]", "website URL to inspect")
  .option("-b, --bot <profile>", "google or browser", "google")
  .option("-t, --timeout <seconds>", "request timeout", "10")
  .option("--json", "print JSON")
  .option("--quiet", "print score only")
  .option("--pages <paths>", "comma-separated paths to audit")
  .option("--render", "also audit browser-rendered HTML")
  .option("--no-color", "disable colors")
  .action(run)
  .parseAsync()
  .catch((error: Error) => {
    console.error(`sitebot: ${error.message}`);
    process.exitCode = 1;
  });
