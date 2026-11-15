import { describe, it, expect } from 'vitest';
import { reconcileMetricPush, generateSamplePayload } from '@/services/metricService';
import type { Landmark, PushMetricValuesRequest } from '@/types/landmark';

describe('metricService - ALIAS matching strategy', () => {
  const landmarks: Landmark[] = [
    {
      id: 'lm-1',
      name: 'Auth Service',
      type: 'KEEP',
      ownerId: null,
      aliases: ['auth-svc', 'authentication-api', 'oauth2-service'],
    },
    {
      id: 'lm-2',
      name: 'Billing Service',
      type: 'KEEP',
      ownerId: null,
      aliases: ['billing-svc', 'payments'],
    },
    {
      id: 'lm-3',
      name: 'Duplicate Alias Service',
      type: 'KEEP',
      ownerId: null,
      aliases: ['payments'],
    },
    {
      id: 'lm-4',
      name: 'No Alias Service',
      type: 'KEEP',
      ownerId: null,
    },
  ];

  it('matches landmark by alias case-insensitively with whitespace trimmed', () => {
    const request: PushMetricValuesRequest = {
      matchBy: 'ALIAS',
      values: [
        { element: ' AUTH-SVC ', value: '98%', level: 'OK' },
        { element: 'authentication-api', value: '99%', level: 'OK' },
        { element: 'non-existent', value: '0', level: 'ERROR' },
      ],
    };

    const summary = reconcileMetricPush(landmarks, request);

    expect(summary.matchedCount).toBe(2);
    expect(summary.unmatchedCount).toBe(1);
    expect(summary.multipleMatchesCount).toBe(0);

    expect(summary.rows[0].status).toBe('MATCHED');
    expect(summary.rows[0].matchedLandmarks[0].id).toBe('lm-1');

    expect(summary.rows[1].status).toBe('MATCHED');
    expect(summary.rows[1].matchedLandmarks[0].id).toBe('lm-1');

    expect(summary.rows[2].status).toBe('UNMATCHED');
  });

  it('flags MULTIPLE_MATCHES when more than one landmark shares the same alias', () => {
    const request: PushMetricValuesRequest = {
      matchBy: 'ALIAS',
      values: [{ element: 'payments', value: '100', level: 'OK' }],
    };

    const summary = reconcileMetricPush(landmarks, request);

    expect(summary.multipleMatchesCount).toBe(1);
    expect(summary.rows[0].status).toBe('MULTIPLE_MATCHES');
    expect(summary.rows[0].matchedLandmarks).toHaveLength(2);
  });

  it('generateSamplePayload uses first alias when matching by ALIAS', () => {
    const payload = generateSamplePayload(landmarks, 'ALIAS');

    expect(payload.matchBy).toBe('ALIAS');
    expect(payload.values[0].element).toBe('auth-svc');
    expect(payload.values[1].element).toBe('billing-svc');
    expect(payload.values[3].element).toBe('no-alias-service');
  });
});
