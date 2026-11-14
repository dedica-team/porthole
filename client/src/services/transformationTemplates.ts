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
  description: 'Extracts open merge requests/pull requests from GitLab API with branch matching, review status, and direct web links.',
  requestUrl: 'https://gitlab.example.com/api/v4/projects/123/merge_requests?state=opened',
  httpMethod: 'GET',
  matchBy: 'ALIAS',
  matchKey: '',
  jqFilter: `[.[] | {
  element: .source_branch,
  value: "\\(.title) (!\\(.iid))",
  level: (
    if .has_conflicts == true or .detailed_merge_status == "cannot_be_merged" or .detailed_merge_status == "conflict" then "ERROR"
    elif .draft == true or .work_in_progress == true then "WARNING"
    else "OK"
    end
  ),
  description: "MR !\\(.iid) by @\\(.author.username): \\(.title) (Target: \\(.target_branch))",
  link: .web_url,
  linkText: "MR !\\(.iid)",
  badges: {
    mr: .web_url,
    author: .author.web_url
  }
}]`,
  samplePayload: JSON.stringify(
    [
      {
        id: 568093652,
        iid: 42,
        project_id: 278964,
        title: 'Add OAuth2 authentication provider',
        description: 'Implements OAuth2 login and token validation.',
        state: 'opened',
        created_at: '2026-11-14T19:29:22.599Z',
        updated_at: '2026-11-14T19:38:15.545Z',
        merged_by: null,
        merge_user: null,
        merged_at: null,
        closed_by: null,
        closed_at: null,
        target_branch: 'main',
        source_branch: 'prod-web-infra',
        user_notes_count: 3,
        upvotes: 2,
        downvotes: 0,
        author: {
          id: 15767218,
          username: 'alex',
          name: 'Alex Developer',
          state: 'active',
          avatar_url: 'https://gitlab.example.com/uploads/-/system/user/avatar/15767218/avatar.png',
          web_url: 'https://gitlab.example.com/alex',
        },
        assignees: [
          {
            id: 12345,
            username: 'sam',
            name: 'Sam Reviewer',
            state: 'active',
            avatar_url: 'https://gitlab.example.com/uploads/-/system/user/avatar/12345/avatar.png',
            web_url: 'https://gitlab.example.com/sam',
          },
        ],
        reviewers: [
          {
            id: 67890,
            username: 'taylor',
            name: 'Taylor Lead',
            state: 'active',
            avatar_url: 'https://gitlab.example.com/uploads/-/system/user/avatar/67890/avatar.png',
            web_url: 'https://gitlab.example.com/taylor',
          },
        ],
        source_project_id: 278964,
        target_project_id: 278964,
        labels: ['backend', 'security'],
        draft: false,
        work_in_progress: false,
        merge_when_pipeline_succeeds: false,
        merge_status: 'can_be_merged',
        detailed_merge_status: 'mergeable',
        has_conflicts: false,
        blocking_discussions_resolved: true,
        references: {
          short: '!42',
          relative: '!42',
          full: 'my-org/porthole!42',
        },
        web_url: 'https://gitlab.example.com/my-org/porthole/-/merge_requests/42',
        time_stats: {
          time_estimate: 0,
          total_time_spent: 0,
          human_time_estimate: null,
          human_total_time_spent: null,
        },
        squash: true,
        squash_on_merge: true,
        task_completion_status: {
          count: 0,
          completed_count: 0,
        },
      },
      {
        id: 568093653,
        iid: 43,
        project_id: 278964,
        title: 'Draft: Upgrade database connector and migration scripts',
        description: 'WIP: bumping database driver version.',
        state: 'opened',
        created_at: '2026-11-14T19:30:00.000Z',
        updated_at: '2026-11-14T19:35:00.000Z',
        merged_by: null,
        merge_user: null,
        merged_at: null,
        closed_by: null,
        closed_at: null,
        target_branch: 'main',
        source_branch: 'payment-gateway',
        user_notes_count: 1,
        upvotes: 0,
        downvotes: 0,
        author: {
          id: 15767219,
          username: 'jordan',
          name: 'Jordan Engineer',
          state: 'active',
          avatar_url: 'https://gitlab.example.com/uploads/-/system/user/avatar/15767219/avatar.png',
          web_url: 'https://gitlab.example.com/jordan',
        },
        assignees: [],
        reviewers: [],
        source_project_id: 278964,
        target_project_id: 278964,
        labels: ['database', 'wip'],
        draft: true,
        work_in_progress: true,
        merge_when_pipeline_succeeds: false,
        merge_status: 'can_be_merged',
        detailed_merge_status: 'draft_status',
        has_conflicts: false,
        blocking_discussions_resolved: true,
        references: {
          short: '!43',
          relative: '!43',
          full: 'my-org/porthole!43',
        },
        web_url: 'https://gitlab.example.com/my-org/porthole/-/merge_requests/43',
        time_stats: {
          time_estimate: 0,
          total_time_spent: 0,
          human_time_estimate: null,
          human_total_time_spent: null,
        },
        squash: true,
        squash_on_merge: true,
        task_completion_status: {
          count: 0,
          completed_count: 0,
        },
      },
      {
        id: 568093654,
        iid: 44,
        project_id: 278964,
        title: 'Fix real-time event streaming sync',
        description: 'Resolves merge conflicts and streaming sync issues.',
        state: 'opened',
        created_at: '2026-11-14T19:32:00.000Z',
        updated_at: '2026-11-14T19:36:00.000Z',
        merged_by: null,
        merge_user: null,
        merged_at: null,
        closed_by: null,
        closed_at: null,
        target_branch: 'main',
        source_branch: 'analytics-pipeline',
        user_notes_count: 5,
        upvotes: 1,
        downvotes: 0,
        author: {
          id: 15767220,
          username: 'morgan',
          name: 'Morgan Architect',
          state: 'active',
          avatar_url: 'https://gitlab.example.com/uploads/-/system/user/avatar/15767220/avatar.png',
          web_url: 'https://gitlab.example.com/morgan',
        },
        assignees: [],
        reviewers: [],
        source_project_id: 278964,
        target_project_id: 278964,
        labels: ['streaming', 'bug'],
        draft: false,
        work_in_progress: false,
        merge_when_pipeline_succeeds: false,
        merge_status: 'cannot_be_merged',
        detailed_merge_status: 'conflict',
        has_conflicts: true,
        blocking_discussions_resolved: false,
        references: {
          short: '!44',
          relative: '!44',
          full: 'my-org/porthole!44',
        },
        web_url: 'https://gitlab.example.com/my-org/porthole/-/merge_requests/44',
        time_stats: {
          time_estimate: 0,
          total_time_spent: 0,
          human_time_estimate: null,
          human_total_time_spent: null,
        },
        squash: false,
        squash_on_merge: false,
        task_completion_status: {
          count: 0,
          completed_count: 0,
        },
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
        value: 'Add OAuth2 authentication provider (!42)',
        level: 'OK',
        description: 'MR !42 by @alex: Add OAuth2 authentication provider (Target: main)',
        link: 'https://gitlab.example.com/my-org/porthole/-/merge_requests/42',
        linkText: 'MR !42',
        badges: {
          mr: 'https://gitlab.example.com/my-org/porthole/-/merge_requests/42',
          author: 'https://gitlab.example.com/alex',
        },
      },
      {
        element: 'payment-gateway',
        value: 'Draft: Upgrade database connector and migration scripts (!43)',
        level: 'WARNING',
        description: 'MR !43 by @jordan: Draft: Upgrade database connector and migration scripts (Target: main)',
        link: 'https://gitlab.example.com/my-org/porthole/-/merge_requests/43',
        linkText: 'MR !43',
        badges: {
          mr: 'https://gitlab.example.com/my-org/porthole/-/merge_requests/43',
          author: 'https://gitlab.example.com/jordan',
        },
      },
      {
        element: 'analytics-pipeline',
        value: 'Fix real-time event streaming sync (!44)',
        level: 'ERROR',
        description: 'MR !44 by @morgan: Fix real-time event streaming sync (Target: main)',
        link: 'https://gitlab.example.com/my-org/porthole/-/merge_requests/44',
        linkText: 'MR !44',
        badges: {
          mr: 'https://gitlab.example.com/my-org/porthole/-/merge_requests/44',
          author: 'https://gitlab.example.com/morgan',
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
