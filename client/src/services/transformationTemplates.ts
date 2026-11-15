import type { MetricTransformationTemplate } from '@/types/landmark';

/**
 * Built-in transformation template for Wiz Vulnerability Findings.
 * Aggregates Wiz project CVE counts per severity (Critical, High, Medium, Low) into metric values with direct portal links.
 */
export const WIZ_VULNERABILITY_TEMPLATE: MetricTransformationTemplate = {
  id: 'wiz-vulnerabilities',
  name: 'Wiz Vulnerability Findings',
  description: 'Aggregates Wiz project CVE counts per severity (Critical, High, Medium, Low) into metric values with direct portal links.',
  requestUrl: 'https://api.wiz.io/graphql',
  httpMethod: 'POST',
  matchBy: 'ALIAS',
  matchKey: '',
  jqFilter: `[.data.projects.nodes[] | {
  element: .slug,
  value: "\\(.vulnerabilitySummary.critical)C / \\(.vulnerabilitySummary.high)H / \\(.vulnerabilitySummary.medium)M / \\(.vulnerabilitySummary.low)L",
  level: (
    if .vulnerabilitySummary.critical > 0 then "ERROR"
    elif .vulnerabilitySummary.high > 0 then "WARNING"
    elif .vulnerabilitySummary.medium > 0 or .vulnerabilitySummary.low > 0 then "OK"
    else "OK"
    end
  ),
  description: "Vulnerabilities: \\(.vulnerabilitySummary.critical) Critical, \\(.vulnerabilitySummary.high) High, \\(.vulnerabilitySummary.medium) Medium, \\(.vulnerabilitySummary.low) Low (Total: \\(.vulnerabilitySummary.total))",
  link: "https://app.wiz.io/vulnerabilities?projectId=\\(.id)",
  linkText: "View in Wiz",
  badges: {
    dashboard: "https://app.wiz.io/security/projects/\\(.id)/vulnerabilities"
  }
}]`,
  samplePayload: JSON.stringify(
    {
      data: {
        projects: {
          nodes: [
            {
              id: '8a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
              name: 'Production Web Infrastructure',
              slug: 'prod-web-infra',
              businessUnit: 'E-Commerce',
              riskScore: 850,
              vulnerabilitySummary: {
                critical: 3,
                high: 12,
                medium: 27,
                low: 15,
                total: 57,
              },
            },
            {
              id: '1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e',
              name: 'Payment Gateway Service',
              slug: 'payment-gateway',
              businessUnit: 'Fintech',
              riskScore: 320,
              vulnerabilitySummary: {
                critical: 0,
                high: 4,
                medium: 9,
                low: 2,
                total: 15,
              },
            },
            {
              id: '2c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f',
              name: 'Analytics Pipeline',
              slug: 'analytics-pipeline',
              businessUnit: 'Data Platform',
              riskScore: 50,
              vulnerabilitySummary: {
                critical: 0,
                high: 0,
                medium: 2,
                low: 8,
                total: 10,
              },
            },
          ],
          pageInfo: {
            hasNextPage: false,
            endCursor: 'eyJpZCI6IjJjM2Q0ZTVmIn0=',
          },
          totalCount: 3,
        },
      },
    },
    null,
    2,
  ),
  directPayloadSample: {
    matchBy: 'ALIAS',
    values: [
      {
        element: 'prod-web-infra',
        value: '3C / 12H / 27M / 15L',
        level: 'ERROR',
        description:
          'Vulnerabilities: 3 Critical, 12 High, 27 Medium, 15 Low (Total: 57)',
        link: 'https://app.wiz.io/vulnerabilities?projectId=8a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        linkText: 'View in Wiz',
        badges: {
          dashboard:
            'https://app.wiz.io/security/projects/8a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d/vulnerabilities',
        },
      },
      {
        element: 'payment-gateway',
        value: '0C / 4H / 9M / 2L',
        level: 'WARNING',
        description:
          'Vulnerabilities: 0 Critical, 4 High, 9 Medium, 2 Low (Total: 15)',
        link: 'https://app.wiz.io/vulnerabilities?projectId=1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e',
        linkText: 'View in Wiz',
        badges: {
          dashboard:
            'https://app.wiz.io/security/projects/1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e/vulnerabilities',
        },
      },
      {
        element: 'analytics-pipeline',
        value: '0C / 0H / 2M / 8L',
        level: 'OK',
        description:
          'Vulnerabilities: 0 Critical, 0 High, 2 Medium, 8 Low (Total: 10)',
        link: 'https://app.wiz.io/vulnerabilities?projectId=2c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f',
        linkText: 'View in Wiz',
        badges: {
          dashboard:
            'https://app.wiz.io/security/projects/2c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f/vulnerabilities',
        },
      },
    ],
  },
};

export const GITLAB_CI_TEMPLATE: MetricTransformationTemplate = {
  id: 'gitlab-ci-pipelines',
  name: 'GitLab CI Pipelines',
  description: 'Transforms GitLab CI pipeline status and test coverage into metric entries.',
  requestUrl: 'https://gitlab.example.com/api/v4/projects/123/pipelines',
  httpMethod: 'GET',
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

export const GITLAB_OPEN_PRS_TEMPLATE: MetricTransformationTemplate = {
  id: 'gitlab-open-pull-requests',
  name: 'GitLab Open Pull Requests',
  description:
    'Transforms open merge requests / pull requests count across GitLab projects into metric values with direct web links.',
  requestUrl: 'https://gitlab.example.com/api/v4/groups/123/projects',
  httpMethod: 'GET',
  matchBy: 'ALIAS',
  matchKey: '',
  jqFilter: `[.[] | {
  element: .path,
  value: "\\(.open_merge_requests_count) open MRs",
  level: (
    if .open_merge_requests_count > 3 then "ERROR"
    elif .open_merge_requests_count > 0 then "WARNING"
    else "OK"
    end
  ),
  description: "\\(.name): \\(.open_merge_requests_count) open merge request(s)",
  link: "\\(.web_url)/-/merge_requests",
  linkText: "MRs (\\(.open_merge_requests_count))",
  badges: {
    mrs: "\\(.web_url)/-/merge_requests"
  }
}]`,
  samplePayload: JSON.stringify(
    [
      {
        id: 278964,
        name: 'Production Web Infrastructure',
        name_with_namespace: 'Infrastructure / Production Web Infrastructure',
        path: 'prod-web-infra',
        path_with_namespace: 'infra/prod-web-infra',
        created_at: '2026-01-10T08:00:00.000Z',
        default_branch: 'main',
        web_url: 'https://gitlab.example.com/infra/prod-web-infra',
        open_issues_count: 8,
        open_merge_requests_count: 5,
        star_count: 14,
        forks_count: 3,
        last_activity_at: '2026-11-14T20:15:00.000Z',
        visibility: 'private',
      },
      {
        id: 278965,
        name: 'Payment Gateway Service',
        name_with_namespace: 'Fintech / Payment Gateway Service',
        path: 'payment-gateway',
        path_with_namespace: 'services/payment-gateway',
        created_at: '2026-02-15T10:30:00.000Z',
        default_branch: 'main',
        web_url: 'https://gitlab.example.com/services/payment-gateway',
        open_issues_count: 3,
        open_merge_requests_count: 2,
        star_count: 7,
        forks_count: 1,
        last_activity_at: '2026-11-14T18:40:00.000Z',
        visibility: 'private',
      },
      {
        id: 278966,
        name: 'Analytics Pipeline',
        name_with_namespace: 'Data Platform / Analytics Pipeline',
        path: 'analytics-pipeline',
        path_with_namespace: 'data/analytics-pipeline',
        created_at: '2026-03-01T14:00:00.000Z',
        default_branch: 'main',
        web_url: 'https://gitlab.example.com/data/analytics-pipeline',
        open_issues_count: 0,
        open_merge_requests_count: 0,
        star_count: 22,
        forks_count: 5,
        last_activity_at: '2026-11-14T16:10:00.000Z',
        visibility: 'private',
      },
    ],
    null,
    2,
  ),
  directPayloadSample: {
    matchBy: 'ALIAS',
    values: [
      {
        element: 'prod-web-infra',
        value: '5 open MRs',
        level: 'ERROR',
        description: 'Production Web Infrastructure: 5 open merge request(s)',
        link: 'https://gitlab.example.com/infra/prod-web-infra/-/merge_requests',
        linkText: 'MRs (5)',
        badges: {
          mrs: 'https://gitlab.example.com/infra/prod-web-infra/-/merge_requests',
        },
      },
      {
        element: 'payment-gateway',
        value: '2 open MRs',
        level: 'WARNING',
        description: 'Payment Gateway Service: 2 open merge request(s)',
        link: 'https://gitlab.example.com/services/payment-gateway/-/merge_requests',
        linkText: 'MRs (2)',
        badges: {
          mrs: 'https://gitlab.example.com/services/payment-gateway/-/merge_requests',
        },
      },
      {
        element: 'analytics-pipeline',
        value: '0 open MRs',
        level: 'OK',
        description: 'Analytics Pipeline: 0 open merge request(s)',
        link: 'https://gitlab.example.com/data/analytics-pipeline/-/merge_requests',
        linkText: 'MRs (0)',
        badges: {
          mrs: 'https://gitlab.example.com/data/analytics-pipeline/-/merge_requests',
        },
      },
    ],
  },
};

export const GITHUB_PRS_TEMPLATE: MetricTransformationTemplate = {
  id: 'github-pull-requests',
  name: 'GitHub Open Pull Requests',
  description: 'Extracts open pull request counts and titles from GitHub repository endpoints.',
  requestUrl: 'https://api.github.com/repos/owner/repo/pulls',
  httpMethod: 'GET',
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

export const SONARQUBE_QUALITY_GATE_TEMPLATE: MetricTransformationTemplate = {
  id: 'sonarqube-quality-gate',
  name: 'SonarQube Quality Gate',
  description: 'Parses SonarQube quality gate statuses and conditions into metric entries.',
  requestUrl: 'https://sonarqube.example.com/api/qualitygates/project_status?projectKey=my_project',
  httpMethod: 'GET',
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

export const TRANSFORMATION_TEMPLATES: MetricTransformationTemplate[] = [
  WIZ_VULNERABILITY_TEMPLATE,
  GITLAB_CI_TEMPLATE,
  GITLAB_OPEN_PRS_TEMPLATE,
  GITHUB_PRS_TEMPLATE,
  SONARQUBE_QUALITY_GATE_TEMPLATE,
];
