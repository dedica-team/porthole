import type { MetricTransformationTemplate } from '@/types/landmark';

export const GITLAB_OPEN_PRS_TEMPLATE: MetricTransformationTemplate = {
  id: 'gitlab-open-pull-requests',
  name: 'GitLab Open Pull Requests',
  description:
    'Transforms open merge requests / pull requests count across GitLab group projects via REST API into metric values with direct web links.',
  requestUrl:
    'https://gitlab.netrtl.com/api/v4/groups/$group_id/merge_requests?state=opened&include_subgroups=true&per_page=100',
  httpMethod: 'GET',
  parameters: {
    group_id: '1234',
    per_page: '100',
  },
  authHeader: 'PRIVATE-TOKEN: $PRIVATE_TOKEN',
  matchBy: 'ALIAS',
  matchKey: '',
  jqFilter: `group_by(.project_id) | [.[] | {
  element: (.[0].references.full | split("!")[0] | split("/")[-1]),
  value: "\\(length) open MRs",
  level: (
    if length > 3 then "ERROR"
    elif length > 0 then "WARNING"
    else "OK"
    end
  ),
  description: "\\(.[0].references.full | split("!")[0]): \\(length) open merge request(s)",
  link: "\\(.[0].web_url | split("/-/merge_requests/")[0])/-/merge_requests",
  linkText: "MRs (\\(length))",
  badges: {
    mrs: "\\(.[0].web_url | split("/-/merge_requests/")[0])/-/merge_requests"
  }
}]`,
  samplePayload: JSON.stringify(
    [
      {
        id: 101,
        iid: 1,
        project_id: 456,
        title: 'Production infrastructure improvements',
        state: 'opened',
        web_url: 'https://gitlab.netrtl.com/infra/prod-web-infra/-/merge_requests/1',
        references: {
          short: '!1',
          relative: '!1',
          full: 'infra/prod-web-infra!1',
        },
      },
      {
        id: 102,
        iid: 2,
        project_id: 456,
        title: 'Fix configuration drift',
        state: 'opened',
        web_url: 'https://gitlab.netrtl.com/infra/prod-web-infra/-/merge_requests/2',
        references: {
          short: '!2',
          relative: '!2',
          full: 'infra/prod-web-infra!2',
        },
      },
      {
        id: 103,
        iid: 1,
        project_id: 789,
        title: 'Payment gateway integration',
        state: 'opened',
        web_url: 'https://gitlab.netrtl.com/services/payment-gateway/-/merge_requests/1',
        references: {
          short: '!1',
          relative: '!1',
          full: 'services/payment-gateway!1',
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
        value: '2 open MRs',
        level: 'WARNING',
        description: 'infra/prod-web-infra: 2 open merge request(s)',
        link: 'https://gitlab.netrtl.com/infra/prod-web-infra/-/merge_requests',
        linkText: 'MRs (2)',
        badges: {
          mrs: 'https://gitlab.netrtl.com/infra/prod-web-infra/-/merge_requests',
        },
      },
      {
        element: 'payment-gateway',
        value: '1 open MRs',
        level: 'WARNING',
        description: 'services/payment-gateway: 1 open merge request(s)',
        link: 'https://gitlab.netrtl.com/services/payment-gateway/-/merge_requests',
        linkText: 'MRs (1)',
        badges: {
          mrs: 'https://gitlab.netrtl.com/services/payment-gateway/-/merge_requests',
        },
      },
    ],
  },
};
