import type {
  Landmark,
  MatchStrategy,
  MetricElementValueDto,
  PushMetricValuesRequest,
} from '@/types/landmark';

/**
 * Normalizes URLs to canonical HTTPS form for deterministic link matching.
 */
export function canonicalUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  let urlToParse = trimmed;
  // Handle SCP-style git URLs: git@github.com:org/repo.git
  const scpMatch = trimmed.match(/^[a-zA-Z0-9._-]+@([a-zA-Z0-9.-]+):(.+)$/);
  if (scpMatch) {
    const host = scpMatch[1];
    const path = scpMatch[2].replace(/^\/+/, '');
    urlToParse = `https://${host}/${path}`;
  } else if (trimmed.toLowerCase().startsWith('ssh://')) {
    const withoutScheme = trimmed.slice(6);
    const atIdx = withoutScheme.indexOf('@');
    const remainder = atIdx !== -1 ? withoutScheme.slice(atIdx + 1) : withoutScheme;
    urlToParse = `https://${remainder}`;
  } else if (!trimmed.includes('://')) {
    urlToParse = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(urlToParse);
    const host = parsed.hostname.toLowerCase();
    let path = parsed.pathname;

    while (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }
    if (path.toLowerCase().endsWith('.git')) {
      path = path.slice(0, -4);
    }
    while (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }

    const portPart = parsed.port && parsed.port !== '80' && parsed.port !== '443' ? `:${parsed.port}` : '';
    const searchPart = parsed.search || '';

    return `https://${host}${portPart}${path}${searchPart}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

export interface ReconciledElementRow {
  element: string;
  matchedLandmarks: Landmark[];
  value?: string;
  level: string;
  description?: string;
  link?: string;
  linkText?: string;
  badges?: Record<string, string>;
  status: 'MATCHED' | 'MULTIPLE_MATCHES' | 'UNMATCHED';
}

export interface ReconciliationSummary {
  rows: ReconciledElementRow[];
  matchedCount: number;
  unmatchedCount: number;
  multipleMatchesCount: number;
}

/**
 * Performs a dry-run reconciliation comparing batch push DTO items against active landmarks.
 */
export function reconcileMetricPush(
  landmarks: Landmark[],
  request: PushMetricValuesRequest,
): ReconciliationSummary {
  const rows: ReconciledElementRow[] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;
  let multipleMatchesCount = 0;

  const values = Array.isArray(request.values) ? request.values : [];

  for (const item of values) {
    if (!item || typeof item !== 'object') continue;
    const elemRaw = typeof item.element === 'string' ? item.element : String(item.element ?? '');
    const elemKey = elemRaw.trim();
    if (!elemKey) continue;

    let matching: Landmark[] = [];

    if (request.matchBy === 'NAME') {
      matching = landmarks.filter((lm) => lm.name.trim().toLowerCase() === elemKey.toLowerCase());
    } else if (request.matchBy === 'ALIAS') {
      matching = landmarks.filter((lm) =>
        (lm.aliases ?? []).some((a) => a.trim().toLowerCase() === elemKey.toLowerCase())
      );
    } else {
      const canonicalTarget = canonicalUrl(elemKey);
      matching = landmarks.filter((lm) => {
        const linksMap = lm.links ?? (lm.link ? { default: lm.link } : {});
        if (request.matchKey) {
          const l = linksMap[request.matchKey];
          return l && canonicalUrl(l) === canonicalTarget;
        } else {
          return Object.values(linksMap).some((l) => canonicalUrl(l) === canonicalTarget);
        }
      });
    }

    let status: ReconciledElementRow['status'] = 'MATCHED';
    if (matching.length === 0) {
      status = 'UNMATCHED';
      unmatchedCount++;
    } else if (matching.length > 1) {
      status = 'MULTIPLE_MATCHES';
      multipleMatchesCount++;
      matchedCount += matching.length;
    } else {
      status = 'MATCHED';
      matchedCount++;
    }

    rows.push({
      element: item.element,
      matchedLandmarks: matching,
      value: item.value,
      level: item.level ?? 'NONE',
      description: item.description,
      link: item.link,
      linkText: item.linkText,
      badges: item.badges,
      status,
    });
  }

  return {
    rows,
    matchedCount,
    unmatchedCount,
    multipleMatchesCount,
  };
}

/**
 * Generates sample JSON payload using actual landmarks and links on the map.
 */
export function generateSamplePayload(
  landmarks: Landmark[],
  matchBy: MatchStrategy = 'NAME',
  matchKey?: string,
): PushMetricValuesRequest {
  const values: MetricElementValueDto[] = [];
  const activeLandmarks = landmarks.filter((l) => l.name);

  const sampleSubset = activeLandmarks.slice(0, 5);

  if (sampleSubset.length === 0) {
    values.push({
      element: matchBy === 'NAME' ? 'Example Service' : matchBy === 'ALIAS' ? 'example-svc' : 'https://github.com/org/example-service',
      value: '95%',
      level: 'OK',
      description: 'Sample metric update',
    });
  } else {
    for (const lm of sampleSubset) {
      let identifier = lm.name;
      if (matchBy === 'ALIAS') {
        identifier = lm.aliases && lm.aliases.length > 0
          ? lm.aliases[0]
          : lm.name.toLowerCase().replace(/\s+/g, '-');
      } else if (matchBy === 'LINK') {
        const linksMap = lm.links ?? (lm.link ? { default: lm.link } : {});
        const linkVal = matchKey ? linksMap[matchKey] : Object.values(linksMap)[0];
        identifier = linkVal || `https://github.com/org/${lm.name.toLowerCase().replace(/\s+/g, '-')}`;
      }
      values.push({
        element: identifier,
        value: '100',
        level: 'OK',
        description: `Status for ${lm.name}`,
      });
    }
  }

  return {
    matchBy,
    matchKey: matchKey || undefined,
    values,
  };
}

/**
 * Builds ready-to-run cURL command for batch metric push.
 */
export function generateCurlSnippet(
  sessionId: string,
  metricIdentifier: string,
  request: PushMetricValuesRequest,
  token?: string,
  origin: string = window.location.origin,
): string {
  const url = `${origin}/api/sessions/${encodeURIComponent(sessionId)}/metrics/${encodeURIComponent(metricIdentifier)}/values`;
  const jsonBody = JSON.stringify(request, null, 2);
  const authHeader = token ? ` -H "Authorization: Bearer ${token}"` : ' -H "Authorization: Bearer $PORTHOLE_TOKEN"';

  return `curl -X POST "${url}" \\\n  -H "Content-Type: application/json"${authHeader} \\\n  -d '${jsonBody.replace(/'/g, "'\\''")}'`;
}

/**
 * Synthesizes a CI/CD pipeline automation script combining foreign fetch, jq transformation, and batch push.
 */
export {
  TRANSFORMATION_TEMPLATES,
  WIZ_VULNERABILITY_TEMPLATE,
  GITLAB_CI_TEMPLATE,
  GITLAB_OPEN_PRS_TEMPLATE,
  GITHUB_PRS_TEMPLATE,
  SONARQUBE_QUALITY_GATE_TEMPLATE,
} from './transformationTemplates';

/**
 * Helper to safely single-quote arbitrary strings for Bourne/Bash shells.
 */
function shellQuote(str: string): string {
  return `'${str.replace(/'/g, "'\\''")}'`;
}

/**
 * Synthesizes a CI/CD pipeline automation script combining foreign fetch, jq transformation, and batch push.
 */
export function generateAutomationScript(
  requestUrl: string,
  httpMethod: string = 'GET',
  jqFilter: string = '.',
  sessionId: string,
  metricIdentifier: string,
  matchBy: MatchStrategy = 'NAME',
  matchKey?: string,
  origin: string = window.location.origin,
): string {
  const targetUrl = `${origin}/api/sessions/${encodeURIComponent(sessionId)}/metrics/${encodeURIComponent(metricIdentifier)}/values`;
  const quotedUrl = shellQuote(requestUrl);
  const quotedTargetUrl = shellQuote(targetUrl);
  const methodFlag =
    httpMethod && httpMethod.trim().toUpperCase() !== 'GET'
      ? ` -X ${shellQuote(httpMethod.trim())}`
      : '';
  const matchByArg = `--arg matchBy ${shellQuote(matchBy)}`;
  const matchKeyArg = matchKey ? ` --arg matchKey ${shellQuote(matchKey)}` : '';
  const wrapperFilter = `{ matchBy: $matchBy, ${matchKey ? 'matchKey: $matchKey, ' : ''}values: (if type == "array" then . else [.] end) }`;

  return `#!/usr/bin/env bash
set -euo pipefail

# 1. Fetch data from foreign API
# 2. Transform into Porthole PushMetricValuesRequest
# 3. Post batch update to Porthole session

curl -s${methodFlag} ${quotedUrl} \\
  | jq ${shellQuote(jqFilter)} \\
  | jq ${matchByArg}${matchKeyArg} ${shellQuote(wrapperFilter)} \\
  | curl -X POST ${quotedTargetUrl} \\
      -H "Authorization: Bearer \${PORTHOLE_TOKEN:-}" \\
      -H "Content-Type: application/json" \\
      -d @-
`;
}
