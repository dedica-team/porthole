import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Terminal,
  Copy,
  Check,
  Send,
  Loader2,
  Save,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle2,
  FileCode,
  Sparkles,
  ArrowLeft,
  BarChart2,
  ExternalLink,
  Table,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useMapStore } from '@/store/mapStore';
import type {
  QualityMetric,
  MatchStrategy,
  PushMetricValuesRequest,
  PushMetricValuesResponse,
  MetricElementValueDto,
  Landmark,
} from '@/types/landmark';
import {
  generateForeignCurlSnippet,
  parseParameters,
  parameterEntriesToRecord,
  recordToParameterEntries,
  reconcileMetricPush,
  TRANSFORMATION_TEMPLATES,
} from '@/services/metricService';
import { runJqTransform } from '@/services/jqWorker';
import { pushMetricValues, saveMetricTransformation, deleteMetricTransformation } from '@/api/mapApi';
import MetricDryRunPreview from './MetricDryRunPreview';

export interface MetricPushViewProps {
  metric?: QualityMetric | null;
  onSuccess?: () => void;
}

export const MetricPushView: React.FC<MetricPushViewProps> = ({
  metric: propMetric,
  onSuccess,
}) => {
  const { id: routeSessionId, metricId: routeMetricId } = useParams<{ id: string; metricId?: string }>();
  const navigate = useNavigate();

  const currentMap = useMapStore((s) => s.currentMap);
  const storeMetrics = useMapStore((s) => s.metrics);
  const setMetrics = useMapStore((s) => s.setMetrics);
  const updateMap = useMapStore((s) => s.updateMap);

  const sessionId = currentMap?.id || routeSessionId || '';
  const allMetrics: QualityMetric[] = useMemo(() => {
    return Object.values(storeMetrics || {});
  }, [storeMetrics]);

  const [selectedMetricId, setSelectedMetricId] = useState<string>(() => {
    if (propMetric) return propMetric.id;
    if (routeMetricId) return routeMetricId;
    return '';
  });

  // Resolve active metric: from prop, from state, from route param, or first available metric
  const metric = useMemo(() => {
    if (selectedMetricId) {
      const found = allMetrics.find((m) => m.id === selectedMetricId);
      if (found) return found;
    }
    if (propMetric) {
      const found = allMetrics.find((m) => m.id === propMetric.id);
      if (found) return found;
      return propMetric;
    }
    if (routeMetricId) {
      const found = allMetrics.find((m) => m.id === routeMetricId);
      if (found) return found;
    }
    return allMetrics[0] || null;
  }, [propMetric, selectedMetricId, routeMetricId, allMetrics]);

  const landmarks: Landmark[] = useMemo(() => {
    return Object.values(currentMap?.landmarks ?? {});
  }, [currentMap?.landmarks]);

  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);

  // ── Transformation Configuration State ─────────────────────────────────────
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTransformationId, setSelectedTransformationId] = useState<string>('');
  const [transformationName, setTransformationName] = useState<string>('');
  const [requestUrl, setRequestUrl] = useState<string>('');
  const [httpMethod, setHttpMethod] = useState<string>('GET');
  const [parameters, setParameters] = useState<Array<{ key: string; value: string }>>([]);
  const [authHeader, setAuthHeader] = useState<string>('');
  const [requestBody, setRequestBody] = useState<string>('');
  const [jqFilter, setJqFilter] = useState<string>('[.[] | { element: .name, value: (.count | tostring), level: "OK" }]');
  const [samplePayload, setSamplePayload] = useState<string>('[\n  { "name": "Auth Service", "count": 5 },\n  { "name": "Billing Service", "count": 12 }\n]');
  const [jqMatchBy, setJqMatchBy] = useState<MatchStrategy>('NAME');
  const [jqMatchKey, setJqMatchKey] = useState<string>('');
  const [transformedJson, setTransformedJson] = useState<string>('');
  const [jqTransformError, setJqTransformError] = useState<string>('');
  const [jqPreviewMode, setJqPreviewMode] = useState<'table' | 'payload'>('table');
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [confirmDeleteTransformation, setConfirmDeleteTransformation] = useState(false);

  // ── Execution State ────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<PushMetricValuesResponse | null>(null);
  const [submitError, setSubmitError] = useState<string>('');

  const transformations = useMemo(() => {
    return metric?.transformations || [];
  }, [metric]);

  // Initialize sample payload when metric or landmarks change
  useEffect(() => {
    if (metric && landmarks.length >= 0) {
      setSelectedTemplateId('');
      setConfirmDeleteTransformation(false);
      setSubmitResult(null);
      setSubmitError('');
      setJqTransformError('');
      setTransformedJson('');

      // If metric has transformations, select the first transformation by default
      const list = metric.transformations || [];
      if (list.length > 0) {
        const first = list[0];
        setSelectedTransformationId(first.id);
        setTransformationName(first.name);
        setRequestUrl(first.requestUrl);
        setHttpMethod(first.httpMethod || 'GET');
        setParameters(recordToParameterEntries(first.parameters));
        setAuthHeader(first.authHeader || '');
        setRequestBody(first.requestBody || '');
        setJqFilter(first.jqFilter || '.');
        setJqMatchBy(first.matchBy || 'NAME');
        setJqMatchKey(first.matchKey || '');
        if (first.lastPayloadSample) setSamplePayload(first.lastPayloadSample);
      } else {
        setSelectedTransformationId('');
        setTransformationName('');
        setRequestUrl('');
        setHttpMethod('GET');
        setParameters([]);
        setAuthHeader('');
        setRequestBody('');
        setJqFilter('[.[] | { element: .name, value: (.count | tostring), level: "OK" }]');
        setSamplePayload('[\n  { "name": "Auth Service", "count": 5 },\n  { "name": "Billing Service", "count": 12 }\n]');
        setJqMatchBy('NAME');
        setJqMatchKey('');
      }
    }
  }, [metric?.id, landmarks.length]);

  // Parse Transformed JSON into PushMetricValuesRequest
  const parsedTransformedReq: PushMetricValuesRequest | null = useMemo(() => {
    if (!transformedJson.trim()) return null;
    try {
      const parsed = JSON.parse(transformedJson);
      if (Array.isArray(parsed)) {
        return {
          matchBy: jqMatchBy,
          matchKey: jqMatchKey.trim() || undefined,
          values: parsed as MetricElementValueDto[],
        };
      } else if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        return {
          matchBy: (obj.matchBy as MatchStrategy) || jqMatchBy,
          matchKey: (obj.matchKey as string) || (jqMatchKey.trim() || undefined),
          values: Array.isArray(obj.values) ? (obj.values as MetricElementValueDto[]) : [],
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [transformedJson, jqMatchBy, jqMatchKey]);

  const jqReconciliation = useMemo(() => {
    if (!parsedTransformedReq) return null;
    return reconcileMetricPush(landmarks, parsedTransformedReq);
  }, [landmarks, parsedTransformedReq]);

  // ── Transformation State & Dirty Tracking ──────────────────────────────────
  const selectedTransformation = useMemo(() => {
    return transformations.find((p) => p.id === selectedTransformationId) || null;
  }, [transformations, selectedTransformationId]);

  const isDuplicateTransformationName = useMemo(() => {
    if (selectedTransformationId) return false;
    const trimmed = transformationName.trim().toLowerCase();
    if (!trimmed || !metric) return false;
    return transformations.some(
      (p) => p.name.trim().toLowerCase() === trimmed
    );
  }, [transformationName, metric, selectedTransformationId, transformations]);

  const isTransformationDirty = useMemo(() => {
    const currentParams = parameterEntriesToRecord(parameters);
    if (!selectedTransformation) {
      return Boolean(
        transformationName.trim() ||
        requestUrl.trim() ||
        Object.keys(currentParams).length > 0 ||
        authHeader.trim() ||
        (requestBody && requestBody.trim()) ||
        (jqFilter && jqFilter !== '.') ||
        samplePayload.trim()
      );
    }
    const savedParams = parseParameters(selectedTransformation.parameters);
    const paramsChanged = JSON.stringify(currentParams) !== JSON.stringify(savedParams);

    return (
      transformationName.trim() !== selectedTransformation.name.trim() ||
      requestUrl.trim() !== selectedTransformation.requestUrl.trim() ||
      (httpMethod || 'GET') !== (selectedTransformation.httpMethod || 'GET') ||
      paramsChanged ||
      (authHeader.trim() || '') !== (selectedTransformation.authHeader?.trim() || '') ||
      (requestBody.trim() || '') !== (selectedTransformation.requestBody?.trim() || '') ||
      (jqFilter.trim() || '.') !== (selectedTransformation.jqFilter?.trim() || '.') ||
      jqMatchBy !== (selectedTransformation.matchBy || 'NAME') ||
      (jqMatchKey.trim() || '') !== (selectedTransformation.matchKey?.trim() || '') ||
      (samplePayload || '') !== (selectedTransformation.lastPayloadSample || '')
    );
  }, [selectedTransformation, transformationName, requestUrl, httpMethod, parameters, authHeader, requestBody, jqFilter, jqMatchBy, jqMatchKey, samplePayload]);

  // ── Template Selection Handlers ───────────────────────────────────────────
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setSubmitError('');
    setConfirmDeleteTransformation(false);
    if (!templateId) return;
    const template = TRANSFORMATION_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setTransformationName(template.name);
      setRequestUrl(template.requestUrl);
      setHttpMethod(template.httpMethod);
      setParameters(recordToParameterEntries(template.parameters));
      setAuthHeader(template.authHeader || '');
      setRequestBody(template.requestBody || '');
      setJqFilter(template.jqFilter);
      setSamplePayload(template.samplePayload);
      setJqMatchBy(template.matchBy);
      setJqMatchKey(template.matchKey || '');
      setSelectedTransformationId('');
    }
  };

  // ── Transformation Handlers ────────────────────────────────────────────────
  const handleSelectTransformation = (transformationId: string) => {
    setSelectedTransformationId(transformationId);
    setSelectedTemplateId('');
    setSubmitError('');
    setConfirmDeleteTransformation(false);
    if (!transformationId) {
      setTransformationName('');
      setParameters([]);
      setAuthHeader('');
      setRequestBody('');
      return;
    }
    const item = transformations.find((p) => p.id === transformationId);
    if (item) {
      setTransformationName(item.name);
      setRequestUrl(item.requestUrl);
      setHttpMethod(item.httpMethod || 'GET');
      setParameters(recordToParameterEntries(item.parameters));
      setAuthHeader(item.authHeader || '');
      setRequestBody(item.requestBody || '');
      setJqFilter(item.jqFilter || '.');
      setJqMatchBy(item.matchBy || 'NAME');
      setJqMatchKey(item.matchKey || '');
      if (item.lastPayloadSample) setSamplePayload(item.lastPayloadSample);
    }
  };

  const handleSaveTransformation = async () => {
    if (!metric || !currentMap) return;
    setSubmitError('');
    setConfirmDeleteTransformation(false);

    const trimmedName = transformationName.trim();
    const trimmedUrl = requestUrl.trim();

    if (!trimmedName || !trimmedUrl) {
      setSubmitError('Transformation name and foreign request URL are required.');
      return;
    }

    if (isDuplicateTransformationName) {
      setSubmitError(`A transformation with the name "${trimmedName}" already exists.`);
      return;
    }

    try {
      setSubmitting(true);
      const paramMap = parameterEntriesToRecord(parameters);
      const updatedState = await saveMetricTransformation(currentMap.id, metric.id, {
        id: selectedTransformationId || undefined,
        name: trimmedName,
        requestUrl: trimmedUrl,
        httpMethod,
        parameters: Object.keys(paramMap).length > 0 ? paramMap : undefined,
        authHeader: authHeader.trim() || undefined,
        requestBody: requestBody.trim() || undefined,
        jqFilter,
        matchBy: jqMatchBy,
        matchKey: jqMatchKey || undefined,
        lastPayloadSample: samplePayload || undefined,
      });

      if (updatedState?.metrics) {
        setMetrics(updatedState.metrics);
      }
      if (updatedState) {
        updateMap(updatedState);
      }

      // Update selectedTransformationId to the saved transformation's id
      const updatedMetric = updatedState.metrics?.[metric.id];
      const updatedList = updatedMetric?.transformations || [];
      const saved = (selectedTransformationId && updatedList.find((p) => p.id === selectedTransformationId))
        || updatedList.find((p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase());
      if (saved) {
        setSelectedTransformationId(saved.id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save transformation.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransformation = async () => {
    if (!metric || !currentMap || !selectedTransformationId) return;
    setSubmitError('');
    try {
      setSubmitting(true);
      const updatedState = await deleteMetricTransformation(currentMap.id, metric.id, selectedTransformationId);
      if (updatedState?.metrics) {
        setMetrics(updatedState.metrics);
      }
      if (updatedState) {
        updateMap(updatedState);
      }
      setSelectedTransformationId('');
      setTransformationName('');
      setRequestUrl('');
      setHttpMethod('GET');
      setParameters([]);
      setAuthHeader('');
      setRequestBody('');
      setJqFilter('[.[] | { element: .name, value: (.count | tostring), level: "OK" }]');
      setSamplePayload('[\n  { "name": "Auth Service", "count": 5 },\n  { "name": "Billing Service", "count": 12 }\n]');
      setJqMatchBy('NAME');
      setJqMatchKey('');
      setTransformedJson('');
      setConfirmDeleteTransformation(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete transformation.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Run JQ Dry-Run Transformation ──────────────────────────────────────────
  const handleRunJqTransform = async () => {
    setJqTransformError('');

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(samplePayload);
    } catch {
      setJqTransformError('Input data sample is not valid JSON.');
      return;
    }

    try {
      const transformed = await runJqTransform(parsedPayload, jqFilter);
      if (!transformed.success) {
        setJqTransformError(transformed.error || 'JQ Evaluation failed.');
        return;
      }
      if (!Array.isArray(transformed.data)) {
        setJqTransformError(`JQ Transformation output must evaluate to an array of metric elements, but got ${typeof transformed.data}.`);
        return;
      }
      setTransformedJson(JSON.stringify(transformed.data, null, 2));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'JQ Evaluation failed.';
      setJqTransformError(message);
    }
  };

  // ── Execute Batch Push ─────────────────────────────────────────────────────
  const handleExecuteJqPush = async () => {
    if (!metric || !currentMap) return;
    let req = parsedTransformedReq;
    if (!req) {
      if (!transformedJson.trim()) {
        await handleRunJqTransform();
        return;
      }
      setSubmitError('Transformed data is not valid JSON or does not contain metric values.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError('');
      setSubmitResult(null);
      const res = await pushMetricValues(currentMap.id, metric.id, req);
      setSubmitResult(res);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to push transformed metric values.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Copy Helpers ───────────────────────────────────────────────────────────
  const handleCopyTransformedPayload = () => {
    const payloadToCopy = transformedJson || (parsedTransformedReq ? JSON.stringify(parsedTransformedReq, null, 2) : '');
    if (!payloadToCopy) return;
    navigator.clipboard.writeText(payloadToCopy);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleCopyForeignCurl = () => {
    const paramMap = parameterEntriesToRecord(parameters);
    const curl = generateForeignCurlSnippet(
      requestUrl || 'https://api.example.com/data',
      httpMethod,
      paramMap,
      requestBody || undefined,
      authHeader || undefined,
      jqFilter,
    );
    navigator.clipboard.writeText(curl);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const cardBtnCls = 'flex items-center gap-1.5 px-3 text-xs text-foreground bg-secondary/70 hover:text-muted-foreground hover:bg-secondary border-l border-border transition-colors cursor-pointer shrink-0';

  if (!metric) {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex flex-col rounded-lg bg-card overflow-hidden mx-3 sm:mx-6 my-3 shrink-0">
          {/* Card header */}
          <div className="flex items-stretch border-b border-border shrink-0">
            <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-foreground flex-1">
              <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
              REST API Push Values
            </div>
            <Link
              to={sessionId ? `/session/${sessionId}/metrics` : '/lobby'}
              className={cardBtnCls}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Metrics
            </Link>
          </div>
          <div className="p-8 text-center flex flex-col items-center gap-3">
            <BarChart2 className="h-8 w-8 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">No Metric Selected</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              There are no metrics defined for this session yet, or the requested metric could not be found.
            </p>
            {sessionId && (
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate(`/session/${sessionId}/metrics`)}
                className="mt-2 text-xs"
              >
                Go to Metrics Overview
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const endpointPath = `/api/sessions/${sessionId}/metrics/${metric.id}/values`;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* ── Main card ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col rounded-lg bg-card overflow-hidden mx-3 sm:mx-6 my-3 shrink-0">
        {/* Card header */}
        <div className="flex items-stretch border-b border-border shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 text-md font-semibold text-foreground flex-1 min-w-0">
            <BarChart2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate" title={metric.description}>REST API Push Values: {metric.name}</span>
          </div>

          {/* Load Transformation Button (opens modal) */}
          <button
            type="button"
            className={cardBtnCls}
            onClick={() => setIsLoadModalOpen(true)}
            aria-label="Load Transformation"
          >
            <FolderOpen className="h-3.5 w-3.5" /> Load Transformation
          </button>

          <Link
            to={sessionId ? `/session/${sessionId}/metrics` : '/lobby'}
            className={cardBtnCls}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Metrics
          </Link>
        </div>

        <div className="p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-4 pt-1">
            <h3>Transformation "{transformationName}"
              {/* Persistence / Unsaved Status Badge */}
              {selectedTransformationId ? (
                  !isTransformationDirty ? (
                      <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          title="This transformation matches the persisted configuration"
                          data-testid="transformation-status-saved"
                      >
                        <CheckCircle2 className="h-3 w-3" /> No changes
                      </span>
                  ) : (
                      <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          title="This transformation has unsaved modifications"
                          data-testid="transformation-status-dirty"
                      >
                        <AlertCircle className="h-3 w-3" /> Unsaved changes
                      </span>
                  )
              ) : (
                  <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border"
                      title="Transformation not yet saved to persistence"
                      data-testid="transformation-status-unsaved"
                  >
                      Unsaved transformation
                    </span>
              )}
            </h3>

            {/* Template & Transformation Configuration Bar */}
            <div className="flex flex-col gap-3 p-3 bg-muted/20 rounded-lg border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground font-medium">Name:</span>
                    <Input
                        placeholder="Transformation Name"
                        value={transformationName}
                        onChange={(e) => setTransformationName(e.target.value)}
                        className={`h-8 text-xs w-48 ${isDuplicateTransformationName ? 'border-destructive focus-visible:ring-destructive text-destructive' : ''}`}
                    />
                    {isDuplicateTransformationName && (
                        <span className="text-[11px] text-destructive font-medium whitespace-nowrap">
                        Name already in use
                      </span>
                    )}
                  </div>

                  {/* Metric Selector Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="metric-selector" className="text-muted-foreground font-medium">
                      Target Metric:
                    </label>
                    <select
                      id="metric-selector"
                      aria-label="Select Metric"
                      value={metric.id}
                      onChange={(e) => setSelectedMetricId(e.target.value)}
                      className="h-8 text-xs bg-muted border border-border rounded-md px-2 text-foreground"
                    >
                      {allMetrics.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {!selectedTransformationId && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground font-medium">Load Template:</span>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleSelectTemplate(e.target.value)}
                      className="h-8 text-xs bg-muted border border-border rounded-md px-2 text-foreground"
                      aria-label="Transformation Template"
                    >
                      <option value="">-- Choose Built-in Template... --</option>
                      {TRANSFORMATION_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleSaveTransformation}
                    disabled={submitting || isDuplicateTransformationName}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {selectedTransformationId ? 'Update Transformation' : 'Save Transformation'}
                </Button>
                {selectedTransformationId && (
                    !confirmDeleteTransformation ? (
                        <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            onClick={() => setConfirmDeleteTransformation(true)}
                            disabled={submitting}
                            title="Delete Transformation"
                            aria-label="Delete Transformation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    ) : (
                        <div className="flex items-center gap-1.5 bg-destructive/10 border border-destructive/30 px-2 py-0.5 rounded">
                        <span className="text-xs text-destructive font-medium whitespace-nowrap">
                          Delete transformation?
                        </span>
                          <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 px-2 text-xs"
                              onClick={handleDeleteTransformation}
                              disabled={submitting}
                          >
                            Yes, delete
                          </Button>
                          <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => setConfirmDeleteTransformation(false)}
                              disabled={submitting}
                          >
                            Cancel
                          </Button>
                        </div>
                    )
                )}
              </div>
            </div>

            <h3>Source and Data</h3>
            {/* Foreign Request Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-3 items-center bg-muted/20 p-3 rounded-lg border border-border">
              <span className="text-muted-foreground font-medium text-xs">Foreign Endpoint:</span>
              <div className="flex items-center gap-2">
                <select
                  value={httpMethod}
                  onChange={(e) => setHttpMethod(e.target.value)}
                  className="h-8 text-xs bg-muted border border-border rounded-md px-2 text-foreground"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
                <Input
                  placeholder="https://gitlab.example.com/api/v4/projects/123/merge_requests"
                  value={requestUrl}
                  onChange={(e) => setRequestUrl(e.target.value)}
                  className="h-8 text-xs flex-1"
                />
              </div>

              <span className="text-muted-foreground font-medium text-xs self-start pt-2">Parameters:</span>
              <div className="flex flex-col gap-2">
                {parameters.length === 0 ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground py-1">
                    <span>No parameters configured.</span>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setParameters([{ key: '', value: '' }])}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Parameter
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {parameters.map((param, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="Key (e.g. group_path)"
                          value={param.key}
                          onChange={(e) => {
                            const updated = [...parameters];
                            updated[index] = { ...updated[index], key: e.target.value };
                            setParameters(updated);
                          }}
                          className="h-8 text-xs w-1/3"
                          aria-label={`Parameter Key ${index + 1}`}
                        />
                        <Input
                          placeholder="Value"
                          value={param.value}
                          onChange={(e) => {
                            const updated = [...parameters];
                            updated[index] = { ...updated[index], value: e.target.value };
                            setParameters(updated);
                          }}
                          className="h-8 text-xs flex-1"
                          aria-label={param.key.trim() || `Parameter Value ${index + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            const updated = parameters.filter((_, i) => i !== index);
                            setParameters(updated);
                          }}
                          aria-label={`Remove Parameter ${param.key || index + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex justify-start">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setParameters([...parameters, { key: '', value: '' }])}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Parameter
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <span className="text-muted-foreground font-medium text-xs self-start pt-2">Auth Header:</span>
              <div className="flex flex-col gap-1.5">
                <Input
                  placeholder="e.g. PRIVATE-TOKEN: $GITLAB_TOKEN or Authorization: Bearer <token>"
                  value={authHeader}
                  onChange={(e) => setAuthHeader(e.target.value)}
                  className="h-8 text-xs bg-background"
                  aria-label="Auth Header"
                />
              </div>

              <span className="text-muted-foreground font-medium text-xs self-start pt-2">Request Body:</span>
              <div className="flex flex-col gap-1.5">
                <Textarea
                  placeholder='{ "query": "..." } or payload body for POST requests'
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="font-mono text-xs min-h-24 resize-y bg-background"
                  aria-label="Request Body"
                />
              </div>

              <span className="text-muted-foreground font-medium text-xs">Match Strategy:</span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="JQ Match Strategy"
                  value={jqMatchBy}
                  onChange={(e) => setJqMatchBy(e.target.value as MatchStrategy)}
                  className="h-8 text-xs bg-muted border border-border rounded-md px-2 text-foreground"
                >
                  <option value="NAME">NAME (Element Name)</option>
                  <option value="ALIAS">ALIAS (Element Alias)</option>
                  <option value="LINK">LINK (Resource URL)</option>
                </select>
                {jqMatchBy === 'LINK' && (
                  <Input
                    placeholder="Key (e.g. repository)"
                    value={jqMatchKey}
                    onChange={(e) => setJqMatchKey(e.target.value)}
                    className="h-8 text-xs w-48"
                  />
                )}
              </div>
            </div>

            {/* Foreign JSON Sample & JQ Filter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground font-medium text-xs">Input Data / Sample:</label>
                <Textarea
                  value={samplePayload}
                  onChange={(e) => setSamplePayload(e.target.value)}
                  className="font-mono text-xs min-h-48 resize-y bg-background"
                  placeholder="Paste response from GitLab / GitHub..."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground font-medium text-xs">JQ Filter Expression:</label>
                  <a
                    href="https://jqlang.github.io/jq/manual/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-link hover:text-link-hover hover:underline inline-flex items-center gap-1"
                    title="Open jq documentation"
                  >
                    <span>jq documentation</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Textarea
                  value={jqFilter}
                  onChange={(e) => setJqFilter(e.target.value)}
                  className="font-mono text-xs min-h-48 resize-y bg-background"
                  placeholder="[.[] | { element: .title, value: (.upvotes | tostring), level: 'OK' }]"
                />
              </div>
            </div>

            {/* ── Preview Section ───────────────────────────────────────────── */}
            <h3>Preview</h3>


            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="text-muted-foreground font-medium">
                  Transformed Data (JSON):
                  {parsedTransformedReq && (
                    <span className="ml-1.5 text-muted-foreground font-normal">
                      ({parsedTransformedReq.values.length} element
                      {parsedTransformedReq.values.length === 1 ? '' : 's'})
                    </span>
                  )}
                </label>

                {transformedJson && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleCopyTransformedPayload}
                  >
                    {copiedPayload ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400 mr-1" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" /> Copy Payload
                      </>
                    )}
                  </Button>
                )}
              </div>
              <Textarea
                value={transformedJson}
                onChange={(e) => {
                  setTransformedJson(e.target.value);
                  setJqTransformError('');
                }}
                className="font-mono text-xs min-h-36 resize-y bg-background"
                placeholder="Transformed metric element values (generated by Execute JQ Dry-Run or edited directly)..."
                aria-label="Transformed Data"
                data-testid="transformed-payload-preview"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">

              <Button
                  type="button"
                  size="sm"
                  onClick={handleRunJqTransform}
                  className="h-8 text-xs flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Execute JQ Dry-Run
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCopyForeignCurl} className="h-8 text-xs">
                {copiedScript ? <Check className="h-3.5 w-3.5 text-emerald-400 mr-1.5" /> : <Terminal className="h-3.5 w-3.5 mr-1.5" />}
                {copiedScript ? 'Copied curl Request' : 'Copy curl Request'}
              </Button>
            </div>

            {jqTransformError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{jqTransformError}</AlertDescription>
              </Alert>
            )}

            {parsedTransformedReq && jqPreviewMode === 'payload' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Transformed Request Payload ({parsedTransformedReq.values.length} element
                    {parsedTransformedReq.values.length === 1 ? '' : 's'}):
                  </span>
                </div>
                <pre
                  className="font-mono text-xs p-3 bg-background rounded-md border border-border overflow-x-auto select-all text-foreground whitespace-pre"
                >
                  {JSON.stringify(parsedTransformedReq, null, 2)}
                </pre>
              </div>
            )}

            {parsedTransformedReq && (
                <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border">
                  <button
                      type="button"
                      onClick={() => setJqPreviewMode('table')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                          jqPreviewMode === 'table'
                              ? 'bg-background text-foreground font-medium shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                      }`}
                      aria-label="Table Preview"
                  >
                    <Table className="h-3.5 w-3.5" />
                    <span>Table</span>
                  </button>
                  <button
                      type="button"
                      onClick={() => setJqPreviewMode('payload')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                          jqPreviewMode === 'payload'
                              ? 'bg-background text-foreground font-medium shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                      }`}
                      aria-label="Inspect Payload"
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    <span>Inspect Payload</span>
                  </button>
                </div>
            )}
            {parsedTransformedReq && jqPreviewMode === 'table' && jqReconciliation && (
              <div className="mt-1">
                <MetricDryRunPreview summary={jqReconciliation} metricName={metric.name} />
              </div>
            )}

            {!parsedTransformedReq && !jqTransformError && (
              <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-md">
                Click &ldquo;Execute JQ Dry-Run&rdquo; or enter transformed JSON data above to preview matched elements.
              </div>
            )}

            <h3>Push</h3>
            {/* Endpoint Information Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-muted/40 rounded-lg border border-border text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-muted-foreground">API Endpoint:</span>
                <span className="font-mono bg-muted text-foreground px-2 py-0.5 rounded border border-border text-[11px]">
                  POST {endpointPath}
                </span>
              </div>
              <div className="text-muted-foreground font-mono text-[11px]">
                Session: {sessionId} • Metric: {metric.id}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button size="sm" onClick={handleExecuteJqPush} disabled={submitting} className="h-8 text-xs">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                Push Transformed Values
              </Button>
            </div>
          </div>
        </div>

        {/* ── Feedback & Diagnostic Banners ─────────────────────────────────── */}
        {submitError && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{submitError}</AlertDescription>
          </Alert>
        )}

        {submitResult && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex flex-col gap-1.5 text-xs text-foreground">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Check className="h-4 w-4" />
              Batch push completed successfully! Updated {submitResult.updatedCount} element(s).
            </div>
            {submitResult.unmatchedElements && submitResult.unmatchedElements.length > 0 && (
              <div className="text-amber-400 text-xs mt-1">
                ⚠️ Unmatched element(s): {submitResult.unmatchedElements.join(', ')}
              </div>
            )}
            {submitResult.warnings && submitResult.warnings.length > 0 && (
              <div className="text-muted-foreground text-xs mt-1">
                {submitResult.warnings.map((w, i) => (
                  <div key={i}>• {w}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Load Transformation Modal ───────────────────────────────────────── */}
      <Dialog open={isLoadModalOpen} onOpenChange={setIsLoadModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-4 w-4 text-primary" />
              Load Transformation
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select a saved transformation for {metric.name} or start with a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-2 max-h-80 overflow-y-auto">
            {/* New Transformation Option */}
            <button
              type="button"
              onClick={() => {
                handleSelectTransformation('');
                setIsLoadModalOpen(false);
              }}
              className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                !selectedTransformationId
                  ? 'bg-primary/10 border-primary text-foreground'
                  : 'bg-muted/30 border-border hover:bg-muted/60 text-foreground'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Plus className="h-4 w-4 text-primary shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">-- New / Custom Transformation --</span>
                  <span className="text-[11px] text-muted-foreground">Start with a clean transformation configuration</span>
                </div>
              </div>
              {!selectedTransformationId && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </button>

            {/* Saved Transformations List */}
            {transformations.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                No saved transformations for this metric yet.
              </div>
            ) : (
              transformations.map((t) => {
                const isSelected = t.id === selectedTransformationId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      handleSelectTransformation(t.id);
                      setIsLoadModalOpen(false);
                    }}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-foreground'
                        : 'bg-muted/30 border-border hover:bg-muted/60 text-foreground'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                      <span className="text-xs font-semibold truncate">{t.name}</span>
                      <span className="text-[11px] text-muted-foreground truncate font-mono">
                        {t.httpMethod || 'GET'} {t.requestUrl}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setIsLoadModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MetricPushView;
