import type { MetricTransformationTemplate } from '@/types/landmark';
import { WIZ_VULNERABILITY_TEMPLATE } from './wizVulnerabilityTemplate';
import { GITLAB_CI_TEMPLATE } from './gitlabCiTemplate';
import { GITLAB_OPEN_PRS_TEMPLATE } from './gitlabOpenPrsTemplate';
import { GITHUB_PRS_TEMPLATE } from './githubPrsTemplate';
import { SONARQUBE_QUALITY_GATE_TEMPLATE } from './sonarqubeQualityGateTemplate';

export * from './wizVulnerabilityTemplate';
export * from './gitlabCiTemplate';
export * from './gitlabOpenPrsTemplate';
export * from './githubPrsTemplate';
export * from './sonarqubeQualityGateTemplate';

export const TRANSFORMATION_TEMPLATES: MetricTransformationTemplate[] = [
  WIZ_VULNERABILITY_TEMPLATE,
  GITLAB_CI_TEMPLATE,
  GITLAB_OPEN_PRS_TEMPLATE,
  GITHUB_PRS_TEMPLATE,
  SONARQUBE_QUALITY_GATE_TEMPLATE,
];
