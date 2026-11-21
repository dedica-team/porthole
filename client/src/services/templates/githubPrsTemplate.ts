import type { MetricTransformationTemplate } from '@/types/landmark';

export const GITHUB_PRS_TEMPLATE: MetricTransformationTemplate = {
  id: 'github-pull-requests',
  name: 'GitHub Open Pull Requests',
  description: 'Extracts open pull request counts and titles from GitHub repository endpoints.',
  requestUrl: 'https://api.github.com/repos/owner/repo/pulls',
  httpMethod: 'GET',
  parameters: {
    owner: 'owner',
    repo: 'repo',
    state: 'open',
  },
  authHeader: 'Authorization: Bearer $GITHUB_TOKEN',
  matchBy: 'NAME',
  matchKey: '',
  jqFilter: `[.[] | {
  element: .head.repo.name,
  value: .title,
  level: "OK"
}]`,
  samplePayload: JSON.stringify(
    [
      {
        title: 'Upgrade dependencies',
        head: { repo: { name: 'prod-web-server-01' } },
      },
    ],
    null,
    2,
  ),
  directPayloadSample: {
    matchBy: 'NAME',
    values: [{ element: 'prod-web-server-01', value: 'Upgrade dependencies', level: 'OK' }],
  },
};
