export type Env = {
  interactive: boolean;
  ci: boolean;
  color: boolean;
};

export function detectEnv(
  colorFlag: boolean,
  json?: boolean,
  quiet?: boolean,
): Env {
  const ci = isCi();
  const interactive =
    !ci &&
    !json &&
    !quiet &&
    Boolean(process.stdin.isTTY && process.stdout.isTTY);
  return { interactive, ci, color: colorFlag && !json && supportsColor() };
}

function isCi(): boolean {
  const e = process.env;
  if (e.SITEBOT_NON_INTERACTIVE) return true;
  return Boolean(
    e.CI ||
    e.CONTINUOUS_INTEGRATION ||
    e.GITHUB_ACTIONS ||
    e.GITLAB_CI ||
    e.BUILDKITE ||
    e.CIRCLECI ||
    e.TEAMCITY_VERSION ||
    e.JENKINS_URL,
  );
}

function supportsColor(): boolean {
  const e = process.env;
  if (e.NO_COLOR) return false;
  if (e.FORCE_COLOR && e.FORCE_COLOR !== "0") return true;
  return Boolean(process.stdout.isTTY) && e.TERM !== "dumb";
}
