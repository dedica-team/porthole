import { describe, it, expect } from 'vitest';
import { runJqTransform } from '../jqWorker';
import { evaluateJq } from '../jqEvaluator';
import { canonicalUrl, reconcileMetricPush, generateSamplePayload, generateCurlSnippet, generateAutomationScript } from '../metricService';
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

  it('handles empty and malformed JQ filters gracefully', async () => {
    const input = { hello: 'world' };
    const res = await runJqTransform(input, '');
    expect(res.success).toBe(true);
    expect(res.data).toEqual(input);
  });
});

describe('metricService', () => {
  it('canonicalizes various git and http URLs', () => {
    expect(canonicalUrl('git@github.com:org/repo.git')).toBe('https://github.com/org/repo');
    expect(canonicalUrl('http://gitlab.example.com/team/service.git/')).toBe('https://gitlab.example.com/team/service');
    expect(canonicalUrl('https://GITHUB.COM/team/repo/')).toBe('https://github.com/team/repo');
    expect(canonicalUrl('ssh://git@gitlab.com/group/project.git')).toBe('https://gitlab.com/group/project');
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

  it('generates sample payload, cURL snippets, and automation scripts', () => {
    const landmarks: Landmark[] = [
      { id: 'lm1', name: 'Gateway', type: 'KEEP', ownerId: null },
    ];

    const payload = generateSamplePayload(landmarks, 'NAME');
    expect(payload.values.length).toBe(1);
    expect(payload.values[0].element).toBe('Gateway');

    const curl = generateCurlSnippet('sess123', 'Coverage', payload, 'jwt_token', 'https://porthole.test');
    expect(curl).toContain('POST "https://porthole.test/api/sessions/sess123/metrics/Coverage/values"');
    expect(curl).toContain('Authorization: Bearer jwt_token');

    const script = generateAutomationScript(
      'https://api.test/prs',
      'GET',
      '[.[] | { element: .name, value: .count }]',
      'sess123',
      'Coverage',
      'NAME',
      undefined,
      'https://porthole.test',
    );
    expect(script).toContain('curl -s "https://api.test/prs"');
    expect(script).toContain('https://porthole.test/api/sessions/sess123/metrics/Coverage/values');
  });
});
