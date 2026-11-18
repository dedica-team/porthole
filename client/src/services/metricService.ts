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
 * Parses parameters input (Record or string) into a key-value Record<string, string>.
 */
export function parseParameters(
  parameters?: string | Record<string, string>,
): Record<string, string> {
  if (!parameters) return {};
  if (typeof parameters === 'object') {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(parameters)) {
      if (k && k.trim()) {
        result[k.trim()] = typeof v === 'string' ? v.trim() : String(v);
      }
    }
    return result;
  }

  const trimmed = parameters.trim();
  if (!trimmed) return {};

  const result: Record<string, string> = {};
  const linesOrPairs = trimmed.split(/[\n,]+/);
  let hasExplicitKeys = false;

  for (const item of linesOrPairs) {
    const trimmedItem = item.trim();
    if (!trimmedItem) continue;

    const eqIdx = trimmedItem.indexOf('=');
    const colonIdx = trimmedItem.indexOf(':');
    const separatorIdx = eqIdx !== -1 ? eqIdx : colonIdx;

    if (separatorIdx !== -1) {
      hasExplicitKeys = true;
      const rawKey = trimmedItem.slice(0, separatorIdx).trim();
      let rawVal = trimmedItem.slice(separatorIdx + 1).trim();
      if (
        (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
        (rawVal.startsWith("'") && rawVal.endsWith("'"))
      ) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawKey) {
        result[rawKey] = rawVal;
      }
    }
  }

  if (!hasExplicitKeys && trimmed) {
    result['group_path'] = trimmed;
  }

  return result;
}

/**
 * Converts an array of key-value parameter entries into a Record<string, string>.
 */
export function parameterEntriesToRecord(
  entries: Array<{ key: string; value: string }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { key, value } of entries) {
    const k = key.trim();
    if (k) {
      result[k] = value;
    }
  }
  return result;
}

/**
 * Converts a Record or string parameters object into an array of key-value entries.
 */
export function recordToParameterEntries(
  parameters?: Record<string, string> | string,
): Array<{ key: string; value: string }> {
  const parsed = parseParameters(parameters);
  return Object.entries(parsed).map(([key, value]) => ({ key, value }));
}

/**
 * Formats a parameters Record or string into a single comma-separated string representation for display.
 */
export function formatParameters(
  parameters?: Record<string, string> | string,
): string {
  if (!parameters) return '';
  if (typeof parameters === 'string') return parameters;
  return Object.entries(parameters)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
}

/**
 * Substitutes parameter values into URL path/query parameters, request body, and auth header placeholders.
 */
export function insertParameters(
  url: string,
  body?: string,
  parameters?: Record<string, string> | string,
  authHeader?: string,
): { url: string; body?: string; authHeader?: string } {
  const parsedParams = parseParameters(parameters);
  const paramEntries = Object.entries(parsedParams).map(([key, value]) => ({ key, value }));
  if (paramEntries.length === 0) {
    return { url, body, authHeader };
  }

  let updatedUrl = url;
  let updatedBody = body;
  let updatedAuthHeader = authHeader;

  for (const { key, value } of paramEntries) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const placeholderRegex = new RegExp(
      `(\\$\\{${escapedKey}\\}|\\$${escapedKey}|\\{\\{${escapedKey}\\}\\}|\\{${escapedKey}\\}|<${escapedKey}>)`,
      'g',
    );

    // 1. Substitute in Body
    if (updatedBody) {
      updatedBody = updatedBody.replace(placeholderRegex, value);

      if (key === 'group_path' || key === 'groupPath' || key === 'group-path') {
        updatedBody = updatedBody.replace(/\\?"group-path\\?"/g, (match) => {
          return match.startsWith('\\"') ? `\\"${value}\\"` : `"${value}"`;
        });
        updatedBody = updatedBody.replace(/\\?"group_path\\?"/g, (match) => {
          return match.startsWith('\\"') ? `\\"${value}\\"` : `"${value}"`;
        });
        updatedBody = updatedBody.replace(/\\?"groupPath\\?"/g, (match) => {
          return match.startsWith('\\"') ? `\\"${value}\\"` : `"${value}"`;
        });
        updatedBody = updatedBody.replace(/\$group_path/g, value);
        updatedBody = updatedBody.replace(/\$groupPath/g, value);
        updatedBody = updatedBody.replace(/\$group-path/g, value);
        updatedBody = updatedBody.replace(/group-path/g, value);
        updatedBody = updatedBody.replace(/group_path/g, value);
      }
    }

    // 2. Substitute in Auth Header
    if (updatedAuthHeader) {
      updatedAuthHeader = updatedAuthHeader.replace(placeholderRegex, value);
    }

    // 3. Substitute in URL
    if (updatedUrl) {
      const urlPlaceholderRegex = new RegExp(
        `(:${escapedKey}|\\{${escapedKey}\\}|\\{\\{${escapedKey}\\}\\}|\\$\\{${escapedKey}\\}|\\$${escapedKey}|<${escapedKey}>)`,
        'g',
      );
      const replacedUrl = updatedUrl.replace(urlPlaceholderRegex, encodeURIComponent(value));
      if (replacedUrl !== updatedUrl) {
        updatedUrl = replacedUrl;
      } else if (new RegExp(`([?&])${escapedKey}=([^&#]*)`).test(updatedUrl)) {
        updatedUrl = updatedUrl.replace(
          new RegExp(`([?&])${escapedKey}=([^&#]*)`, 'g'),
          `$1${key}=${encodeURIComponent(value)}`,
        );
      } else if (key === 'group_path' || key === 'groupPath' || key === 'group-path') {
        updatedUrl = updatedUrl.replace(/\$group_path/g, encodeURIComponent(value));
        updatedUrl = updatedUrl.replace(/\$groupPath/g, encodeURIComponent(value));
        updatedUrl = updatedUrl.replace(/\$group-path/g, encodeURIComponent(value));
        updatedUrl = updatedUrl.replace(/group-path/g, encodeURIComponent(value));
        updatedUrl = updatedUrl.replace(/group_path/g, encodeURIComponent(value));
      } else if (key === 'group_id' || key === 'groupId' || key === 'group') {
        updatedUrl = updatedUrl.replace(/\/groups\/\d+\//g, `/groups/${encodeURIComponent(value)}/`);
        updatedUrl = updatedUrl.replace(/\/groups\/[a-zA-Z0-9_-]+\//g, `/groups/${encodeURIComponent(value)}/`);
        updatedUrl = updatedUrl.replace(/\$group_id/g, encodeURIComponent(value));
        updatedUrl = updatedUrl.replace(/\$groupId/g, encodeURIComponent(value));
      } else if (key === 'projectId' || key === 'project_id') {
        updatedUrl = updatedUrl.replace(/\/projects\/\d+\//g, `/projects/${encodeURIComponent(value)}/`);
        updatedUrl = updatedUrl.replace(/\/projects\/[a-zA-Z0-9_-]+\//g, `/projects/${encodeURIComponent(value)}/`);
      } else if (key === 'projectKey' || key === 'project_key') {
        updatedUrl = updatedUrl.replace(/projectKey=[^&#]*/g, `projectKey=${encodeURIComponent(value)}`);
      }
    }
  }

  return { url: updatedUrl, body: updatedBody, authHeader: updatedAuthHeader };
}

/**
 * Builds ready-to-run cURL command for fetching foreign API data with parameters and auth header inserted.
 */
export function generateForeignCurlSnippet(
  requestUrl: string,
  httpMethod: string = 'GET',
  parameters?: Record<string, string> | string,
  requestBody?: string,
  authHeader?: string,
  jqFilter?: string,
): string {
  const method = (httpMethod || 'GET').trim().toUpperCase();
  const { url: finalUrl, body: finalBody, authHeader: finalAuth } = insertParameters(
    requestUrl,
    requestBody,
    parameters,
    authHeader,
  );

  const isGet = method === 'GET';
  const methodFlag = isGet ? '' : `-X ${method} `;
  const headerLines: string[] = [];

  if (finalAuth && finalAuth.trim()) {
    const lines = finalAuth.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (!line.includes(':') && !line.toLowerCase().startsWith('authorization')) {
        headerLines.push(`-H "Authorization: ${line.replace(/"/g, '\\"')}"`);
      } else {
        headerLines.push(`-H "${line.replace(/"/g, '\\"')}"`);
      }
    }
  }

  const jqPipe =
    jqFilter && jqFilter.trim()
      ? ` \\\n  | jq ${shellQuote(jqFilter)}`
      : '';

  const isPaginatedGet = isGet && (finalUrl.includes('per_page') || finalUrl.includes('page='));

  if (isPaginatedGet) {
    const headersFlag = headerLines.length > 0 ? ` \\\n    ${headerLines.join(' \\\n    ')}` : '';
    const separator = finalUrl.includes('?') ? '&' : '?';
    const baseUrlWithPage = `${finalUrl}${separator}page=$page`;

    return `page=1\nwhile :; do\n  res=$(curl -s "${baseUrlWithPage}"${headersFlag})\n  count=$(echo "$res" | jq 'if type=="array" then length else 0 end' 2>/dev/null || echo 0)\n  [ "$count" -eq 0 ] && break\n  echo "$res"\n  [ "$count" -lt 100 ] && break\n  page=$((page+1))\ndone | jq -s 'add // []'${jqPipe}`;
  }

  if (finalBody && finalBody.trim() && !isGet) {
    headerLines.push('-H "Content-Type: application/json"');
    const headersStr = headerLines.length > 0 ? ` \\\n  ${headerLines.join(' \\\n  ')}` : '';
    return `curl -s ${methodFlag}"${finalUrl}"${headersStr} \\\n  -d '${finalBody.trim().replace(/'/g, "'\\''")}'${jqPipe}`;
  }

  if (headerLines.length > 0) {
    const headersStr = ` \\\n  ${headerLines.join(' \\\n  ')}`;
    return `curl -s ${methodFlag}"${finalUrl}"${headersStr}${jqPipe}`;
  }

  if (!isGet) {
    return `curl -s -X ${method} "${finalUrl}"${jqPipe}`;
  }

  return `curl -s "${finalUrl}"${jqPipe}`;
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
  requestBody?: string,
  parameters?: Record<string, string> | string,
  authHeader?: string,
): string {
  const { url: finalUrl, body: finalBody, authHeader: finalAuth } = insertParameters(
    requestUrl,
    requestBody,
    parameters,
    authHeader,
  );
  const targetUrl = `${origin}/api/sessions/${encodeURIComponent(sessionId)}/metrics/${encodeURIComponent(metricIdentifier)}/values`;
  const quotedUrl = shellQuote(finalUrl);
  const quotedTargetUrl = shellQuote(targetUrl);
  const methodFlag =
    httpMethod && httpMethod.trim().toUpperCase() !== 'GET'
      ? ` -X ${shellQuote(httpMethod.trim().toUpperCase())}`
      : '';
  const matchByArg = `--arg matchBy ${shellQuote(matchBy)}`;
  const matchKeyArg = matchKey ? ` --arg matchKey ${shellQuote(matchKey)}` : '';
  const wrapperFilter = `{ matchBy: $matchBy, ${matchKey ? 'matchKey: $matchKey, ' : ''}values: (if type == "array" then . else [.] end) }`;

  const foreignHeaders: string[] = [];
  if (finalAuth && finalAuth.trim()) {
    const lines = finalAuth.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (!line.includes(':') && !line.toLowerCase().startsWith('authorization')) {
        foreignHeaders.push(` \\\n      -H "Authorization: ${line.replace(/"/g, '\\"')}"`);
      } else {
        foreignHeaders.push(` \\\n      -H "${line.replace(/"/g, '\\"')}"`);
      }
    }
  }

  const authHeaderFlags = foreignHeaders.join('');

  const bodyFlag =
    finalBody && finalBody.trim()
      ? ` \\\n      -H "Content-Type: application/json" \\\n      -d ${shellQuote(finalBody.trim())}`
      : '';

  const formattedParams = formatParameters(parameters);
  const paramsHeader =
    formattedParams && formattedParams.trim()
      ? `# Request Parameters: ${formattedParams.trim()}\n`
      : '';

  const isPaginatedGet =
    (!httpMethod || httpMethod.trim().toUpperCase() === 'GET') &&
    (finalUrl.includes('per_page') || finalUrl.includes('page='));
  const separator = finalUrl.includes('?') ? '&' : '?';
  const baseUrlWithPage = `${finalUrl}${separator}page=\\$page`;

  const fetchSection = isPaginatedGet
    ? `page=1
all_items="[]"
while :; do
  res=$(curl -s "${baseUrlWithPage}"${authHeaderFlags})
  count=$(echo "$res" | jq 'if type=="array" then length else 0 end' 2>/dev/null || echo 0)
  [ "$count" -eq 0 ] && break
  all_items=$(jq -s 'add' <(echo "$all_items") <(echo "$res"))
  [ "$count" -lt 100 ] && break
  page=$((page+1))
done

echo "$all_items"`
    : `curl -s${methodFlag} ${quotedUrl}${authHeaderFlags}${bodyFlag}`;

  return `#!/usr/bin/env bash
set -euo pipefail

${paramsHeader}# 1. Fetch data from foreign API
# 2. Transform into Porthole PushMetricValuesRequest
# 3. Post batch update to Porthole session

${fetchSection} \\
  | jq ${shellQuote(jqFilter)} \\
  | jq ${matchByArg}${matchKeyArg} ${shellQuote(wrapperFilter)} \\
  | curl -X POST ${quotedTargetUrl} \\
      -H "Authorization: Bearer \${PORTHOLE_TOKEN:-}" \\
      -H "Content-Type: application/json" \\
      -d @-
`;
}
