import type { MetricTransformationTemplate } from '@/types/landmark';

export const GITLAB_CI_TEMPLATE: MetricTransformationTemplate = {
  id: 'gitlab-ci-pipelines',
  name: 'GitLab CI Pipelines',
  description: 'Transforms GitLab CI pipeline status and test coverage into metric entries.',
  requestUrl: 'https://gitlab.example.com/api/v4/projects/123/pipelines',
  httpMethod: 'GET',
  parameters: {
    projectId: '123',
  },
  authHeader: 'PRIVATE-TOKEN: $GITLAB_TOKEN',
  matchBy: 'NAME',
  matchKey: '',
  jqFilter: `[.[] | {
  element: .ref,
  value: (.coverage | tostring),
  level: (if .status == "success" then "OK" elif .status == "failed" then "ERROR" else "WARNING" end)
}]`,
  samplePayload: JSON.stringify(
    [
      { ref: 'prod-web-server-01', coverage: 88.5, status: 'success' },
      { ref: 'auth-service', coverage: 94.2, status: 'success' },
    ],
    null,
    2,
  ),
  directPayloadSample: {
    matchBy: 'NAME',
    values: [
      { element: 'prod-web-server-01', value: '88.5', level: 'OK' },
      { element: 'auth-service', value: '94.2', level: 'OK' },
    ],
  },
};
