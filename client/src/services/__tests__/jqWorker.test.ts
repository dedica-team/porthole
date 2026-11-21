import { describe, it, expect } from 'vitest';
import { runJqTransform } from '../jqWorker';
import { evaluateJq } from '../jqEvaluator';
import {
  canonicalUrl,
  reconcileMetricPush,
  generateSamplePayload,
  generateCurlSnippet,
  generateForeignCurlSnippet,
  generateAutomationScript,
  insertParameters,
  parseParameters,
  formatParameters,
  WIZ_VULNERABILITY_TEMPLATE,
  GITLAB_OPEN_PRS_TEMPLATE,
  TRANSFORMATION_TEMPLATES,
} from '../metricService';
import type { Landmark, PushMetricValuesRequest } from '@/types/landmark';

describe('jqEvaluator & jqWorker', () => {
  it('evaluates identity filter', () => {
    const input = { a: 1, b: 'test' };
    const res = evaluateJq(input, '.');
    expect(res.success).toBe(true);
    expect(res.data).toEqual(input);
  });

  it('evaluates property path access', () => {
    const input = { user: { name: 'Alice', details: { score: 98 } } };
    const res = evaluateJq(input, '.user.details.score');
    expect(res.success).toBe(true);
    expect(res.data).toBe(98);
  });

  it('transforms array with object construction and pipe', async () => {
    const input = [
      { title: 'Auth Service', upvotes: 5 },
      { title: 'Billing Service', upvotes: 12 },
    ];
    const res = await runJqTransform(input, '[.[] | { element: .title, value: (.upvotes | tostring), level: "OK" }]');
    expect(res.success).toBe(true);
    expect(res.data).toEqual([
      { element: 'Auth Service', value: '5', level: 'OK' },
      { element: 'Billing Service', value: '12', level: 'OK' },
    ]);
  });

  it('transforms Wiz vulnerability findings template sample payload', async () => {
    const sample = JSON.parse(WIZ_VULNERABILITY_TEMPLATE.samplePayload);
    const res = await runJqTransform(sample, WIZ_VULNERABILITY_TEMPLATE.jqFilter);
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    const rows = res.data as Array<Record<string, unknown>>;
    expect(rows.length).toBe(3);
    expect(rows[0].element).toBe('prod-web-infra');
    expect(rows[0].value).toBe('3C / 12H / 27M / 15L');
    expect(rows[0].level).toBe('ERROR');
    expect(rows[0].badges).toEqual({
      dashboard: 'https://app.wiz.io/security/projects/8a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d/vulnerabilities',
    });

    expect(rows[1].element).toBe('payment-gateway');
    expect(rows[1].value).toBe('0C / 4H / 9M / 2L');
    expect(rows[1].level).toBe('WARNING');

    expect(rows[2].element).toBe('analytics-pipeline');
    expect(rows[2].value).toBe('0C / 0H / 2M / 8L');
    expect(rows[2].level).toBe('OK');
  });

  it('transforms GitLab open merge requests template sample payload', async () => {
    const sample = JSON.parse(GITLAB_OPEN_PRS_TEMPLATE.samplePayload);
    const res = await runJqTransform(sample, GITLAB_OPEN_PRS_TEMPLATE.jqFilter);
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    const rows = res.data as Array<Record<string, unknown>>;
    expect(rows.length).toBe(2);

    expect(rows[0].element).toBe('prod-web-infra');
    expect(rows[0].value).toBe('2');
    expect(rows[0].level).toBe('OK');
    expect(rows[0].link).toBe('https://gitlab.example.com/infra/prod-web-infra/-/merge_requests');
    expect(rows[0].linkText).toBe('MRs (2)');
    expect(rows[0].badges).toEqual({});

    expect(rows[1].element).toBe('payment-gateway');
    expect(rows[1].value).toBe('1');
    expect(rows[1].level).toBe('OK');
    expect(rows[1].link).toBe('https://gitlab.example.com/services/payment-gateway/-/merge_requests');
    expect(rows[1].linkText).toBe('MRs (1)');
    expect(rows[1].badges).toEqual({});
  });

  it('includes built-in transformation templates', () => {
    expect(TRANSFORMATION_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(TRANSFORMATION_TEMPLATES.some((t) => t.id === 'wiz-vulnerabilities')).toBe(true);
    expect(TRANSFORMATION_TEMPLATES.some((t) => t.id === 'gitlab-open-pull-requests')).toBe(true);
  });

  it('handles empty and malformed JQ filters gracefully', async () => {
    const input = { hello: 'world' };
    const res = await runJqTransform(input, '');
    expect(res.success).toBe(true);
    expect(res.data).toEqual(input);
  });

  it('traverses nested arrays preserving iterator tokens in .groups[].items[].name', () => {
    const input = {
      groups: [
        { items: [{ name: 'svc-auth' }, { name: 'svc-billing' }] },
        { items: [{ name: 'svc-gateway' }] },
      ],
    };
    const res = evaluateJq(input, '[.groups[].items[].name]');
    expect(res.success).toBe(true);
    expect(res.data).toEqual(['svc-auth', 'svc-billing', 'svc-gateway']);
  });

  it('models empty streams through pipelines and drops non-matching items in select(...)', () => {
    const input = [
      { name: 'svc-a', active: true, score: 90 },
      { name: 'svc-b', active: false, score: 40 },
      { name: 'svc-c', active: true, score: 85 },
    ];
    const res = evaluateJq(
      input,
      '[.[] | select(.active == true) | { element: .name, value: (.score | tostring) }]',
    );
    expect(res.success).toBe(true);
    expect(res.data).toEqual([
      { element: 'svc-a', value: '90' },
      { element: 'svc-c', value: '85' },
    ]);
  });

  it('explicitly rejects unrecognized or misspelled expressions instead of returning identity', () => {
    const input = [{ name: 'test' }];
    const res = evaluateJq(input, 'sort_by(.name)');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Unsupported JQ filter: sort_by(.name)');
  });
});

describe('metricService', () => {
  it('canonicalizes various git and http URLs', () => {
    expect(canonicalUrl('git@github.com:org/repo.git')).toBe('https://github.com/org/repo');
    expect(canonicalUrl('http://gitlab.example.com/team/service.git/')).toBe('https://gitlab.example.com/team/service');
    expect(canonicalUrl('https://GITHUB.COM/team/repo/')).toBe('https://github.com/team/repo');
    expect(canonicalUrl('ssh://git@gitlab.com/group/project.git')).toBe('https://gitlab.com/group/project');
  });

  it('reconciles batch push elements gracefully when items are malformed or non-string', () => {
    const landmarks: Landmark[] = [
      { id: 'lm1', name: 'Auth Service', type: 'KEEP', ownerId: null },
    ];

    const req: PushMetricValuesRequest = {
      matchBy: 'NAME',
      values: [
        // @ts-expect-error testing runtime malformed data from custom JQ
        null,
        // @ts-expect-error testing runtime number element
        { element: 12345, value: '10' },
        { element: 'Auth Service', value: '99%' },
      ],
    };

    const summary = reconcileMetricPush(landmarks, req);
    expect(summary.matchedCount).toBe(1);
    expect(summary.unmatchedCount).toBe(1);
  });

  it('reconciles batch push elements against map landmarks by name', () => {
    const landmarks: Landmark[] = [
      { id: 'lm1', name: 'Auth Service', type: 'KEEP', ownerId: null },
      { id: 'lm2', name: 'Billing Service', type: 'KEEP', ownerId: null },
    ];

    const req: PushMetricValuesRequest = {
      matchBy: 'NAME',
      values: [
        { element: 'auth service', value: '99%' },
        { element: 'Unknown Service', value: '50%' },
      ],
    };

    const summary = reconcileMetricPush(landmarks, req);
    expect(summary.matchedCount).toBe(1);
    expect(summary.unmatchedCount).toBe(1);
    expect(summary.rows[0].status).toBe('MATCHED');
    expect(summary.rows[1].status).toBe('UNMATCHED');
  });

  it('reconciles batch push elements against map landmarks by link', () => {
    const landmarks: Landmark[] = [
      {
        id: 'lm1',
        name: 'Auth Service',
        type: 'KEEP',
        ownerId: null,
        links: { repository: 'https://github.com/org/auth-service.git' },
      },
    ];

    const req: PushMetricValuesRequest = {
      matchBy: 'LINK',
      matchKey: 'repository',
      values: [
        { element: 'git@github.com:org/auth-service.git', value: '10' },
      ],
    };

    const summary = reconcileMetricPush(landmarks, req);
    expect(summary.matchedCount).toBe(1);
    expect(summary.rows[0].status).toBe('MATCHED');
  });

  it('generates sample payload, cURL snippets, and shell-quoted automation scripts', () => {
    const landmarks: Landmark[] = [
      { id: 'lm1', name: 'Gateway', type: 'KEEP', ownerId: null },
    ];

    const payload = generateSamplePayload(landmarks, 'NAME');
    expect(payload.values.length).toBe(1);
    expect(payload.values[0].element).toBe('Gateway');

    const curl = generateCurlSnippet('sess123', 'm-cov-123', payload, 'jwt_token', 'https://porthole.test');
    expect(curl).toContain('POST "https://porthole.test/api/sessions/sess123/metrics/m-cov-123/values"');
    expect(curl).toContain('-H "X-Requested-With: XMLHttpRequest"');
    expect(curl).toContain('Authorization: Bearer jwt_token');

    const foreignCurl = generateForeignCurlSnippet(
      'https://gitlab.example.com/api/graphql',
      'POST',
      'group_path=my-backend-group',
      '{"query": "query { group(fullPath: \\"$group_path\\") { id } }"}',
      'PRIVATE-TOKEN: glpat-secret-123',
    );
    expect(foreignCurl).toContain('curl -s -X POST "https://gitlab.example.com/api/graphql"');
    expect(foreignCurl).toContain('-H "PRIVATE-TOKEN: glpat-secret-123"');
    expect(foreignCurl).toContain('-H "Content-Type: application/json"');
    expect(foreignCurl).toContain('-d \'{"query": "query { group(fullPath: \\"my-backend-group\\") { id } }"}\'');

    const paginatedCurl = generateForeignCurlSnippet(
      GITLAB_OPEN_PRS_TEMPLATE.requestUrl,
      GITLAB_OPEN_PRS_TEMPLATE.httpMethod,
      GITLAB_OPEN_PRS_TEMPLATE.parameters,
      undefined,
      GITLAB_OPEN_PRS_TEMPLATE.authHeader,
      GITLAB_OPEN_PRS_TEMPLATE.jqFilter,
    );
    expect(paginatedCurl).toContain('page=1');
    expect(paginatedCurl).toContain('while :; do');
    expect(paginatedCurl).toContain('https://gitlab.example.com/api/v4/groups/1234/merge_requests?state=opened&include_subgroups=true&per_page=100&page=$page');
    expect(paginatedCurl).toContain('-H "PRIVATE-TOKEN: $PRIVATE_TOKEN"');
    expect(paginatedCurl).toContain('jq -s \'add // []\'');
    expect(paginatedCurl).toContain('| jq \'group_by(.project_id)');

    const substituted = insertParameters(
      'https://gitlab.example.com/api/v4/projects/:projectId/pipelines',
      'query { group(fullPath: "$group_path") { id } }',
      'projectId=789, group_path=custom-group',
      'PRIVATE-TOKEN: $group_path-token',
    );
    expect(substituted.url).toBe('https://gitlab.example.com/api/v4/projects/789/pipelines');
    expect(substituted.body).toBe('query { group(fullPath: "custom-group") { id } }');
    expect(substituted.authHeader).toBe('PRIVATE-TOKEN: custom-group-token');

    const script = generateAutomationScript(
      'https://api.test/prs?query=foo bar',
      'POST',
      "[.[] | { element: .name, value: .count }]",
      'sess123',
      'm-cov-456',
      'ALIAS',
      'repo key',
      'https://porthole.test',
      '{"query": "query { group(fullPath: \\"$group_path\\") { id } }"}',
      'group_path=my-group',
      'Authorization: Bearer $MY_TOKEN',
    );
    expect(script).toContain("curl -s -X 'POST' 'https://api.test/prs?query=foo bar'");
    expect(script).toContain('# Request Parameters: group_path=my-group');
    expect(script).toContain('-H "Authorization: Bearer $MY_TOKEN"');
    expect(script).toContain("-H \"Content-Type: application/json\" \\\n      -d '{\"query\": \"query { group(fullPath: \\\"my-group\\\") { id } }\"}'");
    expect(script).toContain("--arg matchBy 'ALIAS' --arg matchKey 'repo key'");
    expect(script).toContain("https://porthole.test/api/sessions/sess123/metrics/m-cov-456/values");
    expect(script).toContain('-H "Authorization: Bearer $PORTHOLE_TOKEN"');
    expect(script).toContain('-H "X-Requested-With: XMLHttpRequest"');
  });

  it('parses and formats parameter key-value maps accurately', () => {
    expect(parseParameters('group_path=my-org/my-group, state=open')).toEqual({
      group_path: 'my-org/my-group',
      state: 'open',
    });
    expect(parseParameters('single-bare-value')).toEqual({
      group_path: 'single-bare-value',
    });
    expect(parseParameters({ projectKey: 'my-key', branch: 'main' })).toEqual({
      projectKey: 'my-key',
      branch: 'main',
    });
    expect(formatParameters({ projectKey: 'my-key', branch: 'main' })).toBe('projectKey=my-key, branch=main');
    expect(formatParameters('projectKey=my-key')).toBe('projectKey=my-key');
    expect(formatParameters(undefined)).toBe('');

    const substitutedMap = insertParameters(
      'https://gitlab.example.com/api/v4/projects/:projectId/pipelines',
      'query { group(fullPath: "group-path") { id } }',
      { projectId: '456', group_path: 'custom-team' },
    );
    expect(substitutedMap.url).toBe('https://gitlab.example.com/api/v4/projects/456/pipelines');
    expect(substitutedMap.body).toBe('query { group(fullPath: "custom-team") { id } }');
  });
});
