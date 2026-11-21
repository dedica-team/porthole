import type { MetricTransformationTemplate } from '@/types/landmark';

export const SONARQUBE_QUALITY_GATE_TEMPLATE: MetricTransformationTemplate = {
  id: 'sonarqube-quality-gate',
  name: 'SonarQube Quality Gate',
  description: 'Parses SonarQube quality gate statuses and conditions into metric entries.',
  requestUrl: 'https://sonarqube.example.com/api/qualitygates/project_status?projectKey=my_project',
  httpMethod: 'GET',
  parameters: {
    projectKey: 'my_project',
  },
  authHeader: 'Authorization: Bearer $SONAR_TOKEN',
  matchBy: 'NAME',
  matchKey: '',
  jqFilter: `[{
  element: "prod-web-server-01",
  value: .projectStatus.status,
  level: (if .projectStatus.status == "OK" then "OK" elif .projectStatus.status == "WARN" then "WARNING" else "ERROR" end)
}]`,
  samplePayload: JSON.stringify(
    {
      projectStatus: {
        status: 'ERROR',
        conditions: [
          { metricKey: 'coverage', status: 'ERROR', actualValue: '72.4' },
        ],
      },
    },
    null,
    2,
  ),
  directPayloadSample: {
    matchBy: 'NAME',
    values: [{ element: 'prod-web-server-01', value: 'ERROR', level: 'ERROR' }],
  },
};
