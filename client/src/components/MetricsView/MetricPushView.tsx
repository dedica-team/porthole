import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Terminal,
  Copy,
  Check,
  Send,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  FileCode,
  Sparkles,
  ArrowLeft,
  BarChart2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import type {
  QualityMetric,
  MatchStrategy,
  PushMetricValuesRequest,
  PushMetricValuesResponse,
  MetricElementValueDto,
  Landmark,
} from '@/types/landmark';
import {
  generateSamplePayload,
  generateCurlSnippet,
  generateAutomationScript,
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
  const token = useAuthStore((s) => s.token);

  const sessionId = currentMap?.id || routeSessionId || '';
  const allMetrics: QualityMetric[] = useMemo(() => {
    return Object.values(storeMetrics || {});
  }, [storeMetrics]);

  // Resolve active metric: from prop, from route param, or first available metric
  const metric = useMemo(() => {
    if (propMetric) return propMetric;
    if (routeMetricId) {
      const found = allMetrics.find((m) => m.id === routeMetricId);
      if (found) return found;
    }
    return allMetrics[0] || null;
  }, [propMetric, routeMetricId, allMetrics]);

  const landmarks: Landmark[] = useMemo(() => {
    return Object.values(currentMap?.landmarks ?? {});
  }, [currentMap?.landmarks]);

  const [activeTab, setActiveTab] = useState<'direct' | 'jq'>('jq');

  // ── Direct JSON Tab State ──────────────────────────────────────────────────
  const [directMatchBy, setDirectMatchBy] = useState<MatchStrategy>('NAME');
  const [directMatchKey, setDirectMatchKey] = useState<string>('');
  const [directTemplateId, setDirectTemplateId] = useState<string>('');
  const [directJson, setDirectJson] = useState<string>('');
  const [directJsonError, setDirectJsonError] = useState<string>('');
  const [copiedDirectCurl, setCopiedDirectCurl] = useState(false);

  // ── JQ Builder Tab State ───────────────────────────────────────────────────
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTransformationId, setSelectedTransformationId] = useState<string>('');
  const [transformationName, setTransformationName] = useState<string>('');
  const [requestUrl, setRequestUrl] = useState<string>('');
  const [httpMethod, setHttpMethod] = useState<string>('GET');
  const [jqFilter, setJqFilter] = useState<string>('[.[] | { element: .name, value: (.count | tostring), level: "OK" }]');
  const [samplePayload, setSamplePayload] = useState<string>('[\n  { "name": "Auth Service", "count": 5 },\n  { "name": "Billing Service", "count": 12 }\n]');
  const [jqMatchBy, setJqMatchBy] = useState<MatchStrategy>('NAME');
  const [jqMatchKey, setJqMatchKey] = useState<string>('');
  const [jqTransformedReq, setJqTransformedReq] = useState<PushMetricValuesRequest | null>(null);
  const [jqTransformError, setJqTransformError] = useState<string>('');
  const [copiedScript, setCopiedScript] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string>('');
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
      const sample = generateSamplePayload(landmarks, 'NAME');
      setDirectJson(JSON.stringify(sample, null, 2));
      setDirectMatchBy('NAME');
      setDirectMatchKey('');
      setDirectTemplateId('');
      setSelectedTemplateId('');
      setConfirmDeleteTransformation(false);
      setSubmitResult(null);
      setSubmitError('');
      setDirectJsonError('');
      setJqTransformError('');

      // If metric has transformations, select the first transformation by default
      const list = metric.transformations || [];
      if (list.length > 0) {
        const first = list[0];
        setSelectedTransformationId(first.id);
        setTransformationName(first.name);
        setRequestUrl(first.requestUrl);
        setHttpMethod(first.httpMethod || 'GET');
        setJqFilter(first.jqFilter || '.');
        setJqMatchBy(first.matchBy || 'NAME');
        setJqMatchKey(first.matchKey || '');
        if (first.lastPayloadSample) setSamplePayload(first.lastPayloadSample);
      } else {
        setSelectedTransformationId('');
        setTransformationName('');
        setRequestUrl('');
        setHttpMethod('GET');
        setJqFilter('[.[] | { element: .name, value: (.count | tostring), level: "OK" }]');
        setSamplePayload('[\n  { "name": "Auth Service", "count": 5 },\n  { "name": "Billing Service", "count": 12 }\n]');
        setJqMatchBy('NAME');
        setJqMatchKey('');
      }
      setJqTransformedReq(null);
    }
  }, [metric?.id, landmarks.length]);

  // ── Parse Direct JSON ──────────────────────────────────────────────────────
  const parseDirectRequest = (): PushMetricValuesRequest | null => {
    try {
      const parsed = JSON.parse(directJson);
      if (Array.isArray(parsed)) {
        return {
          matchBy: directMatchBy,
          matchKey: directMatchKey.trim() || undefined,
          values: parsed,
        };
      } else if (parsed && typeof parsed === 'object') {
        return {
          matchBy: parsed.matchBy || directMatchBy,
          matchKey: parsed.matchKey || (directMatchKey.trim() || undefined),
          values: Array.isArray(parsed.values) ? parsed.values : [],
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  const directReq = parseDirectRequest();
  const directReconciliation = useMemo(() => {
    if (!directReq) return null;
    return reconcileMetricPush(landmarks, directReq);
  }, [landmarks, directReq]);

  const jqReconciliation = useMemo(() => {
    if (!jqTransformedReq) return null;
    return reconcileMetricPush(landmarks, jqTransformedReq);
  }, [landmarks, jqTransformedReq]);

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
    if (!selectedTransformation) {
      return Boolean(transformationName.trim() || requestUrl.trim() || (jqFilter && jqFilter !== '.') || samplePayload.trim());
    }
    return (
      transformationName.trim() !== selectedTransformation.name.trim() ||
      requestUrl.trim() !== selectedTransformation.requestUrl.trim() ||
      (httpMethod || 'GET') !== (selectedTransformation.httpMethod || 'GET') ||
      (jqFilter.trim() || '.') !== (selectedTransformation.jqFilter?.trim() || '.') ||
      jqMatchBy !== (selectedTransformation.matchBy || 'NAME') ||
      (jqMatchKey.trim() || '') !== (selectedTransformation.matchKey?.trim() || '') ||
      (samplePayload || '') !== (selectedTransformation.lastPayloadSample || '')
    );
  }, [selectedTransformation, transformationName, requestUrl, httpMethod, jqFilter, jqMatchBy, jqMatchKey, samplePayload]);

  // ── Template Selection Handlers ───────────────────────────────────────────
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setSaveFeedback('');
    setSubmitError('');
    setConfirmDeleteTransformation(false);
    if (!templateId) return;
    const template = TRANSFORMATION_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setTransformationName(template.name);
      setRequestUrl(template.requestUrl);
      setHttpMethod(template.httpMethod);
      setJqFilter(template.jqFilter);
      setSamplePayload(template.samplePayload);
      setJqMatchBy(template.matchBy);
      setJqMatchKey(template.matchKey || '');
      setSelectedTransformationId('');
    }
  };

  const handleSelectDirectTemplate = (templateId: string) => {
    setDirectTemplateId(templateId);
    if (!templateId) return;
    const template = TRANSFORMATION_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setDirectMatchBy(template.matchBy);
      setDirectMatchKey(template.matchKey || '');
      setDirectJson(
        template.directPayloadSample
          ? JSON.stringify(template.directPayloadSample, null, 2)
          : template.samplePayload
      );
    }
  };

  // ── Transformation Handlers ────────────────────────────────────────────────
  const handleSelectTransformation = (transformationId: string) => {
    setSelectedTransformationId(transformationId);
    setSelectedTemplateId('');
    setSaveFeedback('');
    setSubmitError('');
    setConfirmDeleteTransformation(false);
    if (!transformationId) {
      setTransformationName('');
      return;
    }
    const item = transformations.find((p) => p.id === transformationId);
    if (item) {
      setTransformationName(item.name);
      setRequestUrl(item.requestUrl);
      setHttpMethod(item.httpMethod || 'GET');
      setJqFilter(item.jqFilter || '.');
      setJqMatchBy(item.matchBy || 'NAME');
      setJqMatchKey(item.matchKey || '');
      if (item.lastPayloadSample) setSamplePayload(item.lastPayloadSample);
    }
  };

  const handleSaveTransformation = async () => {
    if (!metric || !currentMap) return;
    setSaveFeedback('');
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
      const updatedState = await saveMetricTransformation(currentMap.id, metric.id, {
        id: selectedTransformationId || undefined,
        name: trimmedName,
        requestUrl: trimmedUrl,
        httpMethod,
        jqFilter,
        matchBy: jqMatchBy,
        matchKey: jqMatchKey || undefined,
        lastPayloadSample: samplePayload || undefined,
      });

      // Update selectedTransformationId to the saved transformation's id
      const updatedMetric = updatedState.metrics?.[metric.id];
      const updatedList = updatedMetric?.transformations || [];
      const saved = updatedList.find(
        (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (saved) {
        setSelectedTransformationId(saved.id);
      }

      setSaveFeedback(
        selectedTransformationId
          ? `Transformation "${trimmedName}" updated successfully.`
          : `Transformation "${trimmedName}" saved successfully.`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save transformation.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransformation = async () => {
    if (!metric || !currentMap || !selectedTransformationId) return;
    setSaveFeedback('');
    setSubmitError('');
    try {
      setSubmitting(true);
      await deleteMetricTransformation(currentMap.id, metric.id, selectedTransformationId);
      setSelectedTransformationId('');
      setTransformationName('');
      setRequestUrl('');
      setHttpMethod('GET');
      setJqFilter('[.[] | { element: .name, value: (.count | tostring), level: "OK" }]');
      setSamplePayload('[\n  { "name": "Auth Service", "count": 5 },\n  { "name": "Billing Service", "count": 12 }\n]');
      setJqMatchBy('NAME');
      setJqMatchKey('');
      setJqTransformedReq(null);
      setConfirmDeleteTransformation(false);
      setSaveFeedback('Transformation deleted successfully.');
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
    setJqTransformedReq(null);

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
      setJqTransformedReq({
        matchBy: jqMatchBy,
        matchKey: jqMatchKey.trim() || undefined,
        values: transformed.data as MetricElementValueDto[],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'JQ Evaluation failed.';
      setJqTransformError(message);
    }
  };

  // ── Execute Direct Batch Push ──────────────────────────────────────────────
  const handleExecuteDirectPush = async () => {
    if (!metric || !currentMap) return;
    setDirectJsonError('');
    setSubmitError('');
    setSubmitResult(null);

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(directJson);
    } catch {
      setDirectJsonError('Invalid JSON format.');
      return;
    }

    let requestBody: PushMetricValuesRequest;
    if (Array.isArray(parsedBody)) {
      requestBody = {
        matchBy: directMatchBy,
        matchKey: directMatchKey.trim() || undefined,
        values: parsedBody,
      };
    } else if (parsedBody && typeof parsedBody === 'object') {
      const obj = parsedBody as Record<string, unknown>;
      requestBody = {
        matchBy: (obj.matchBy as MatchStrategy) || directMatchBy,
        matchKey: (obj.matchKey as string) || (directMatchKey.trim() || undefined),
        values: Array.isArray(obj.values) ? obj.values : [],
      };
    } else {
      setDirectJsonError('JSON must be an array of element values or a PushMetricValuesRequest object.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await pushMetricValues(currentMap.id, metric.id, requestBody);
      setSubmitResult(res);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to push metric values.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Execute JQ Batch Push ──────────────────────────────────────────────────
  const handleExecuteJqPush = async () => {
    if (!metric || !currentMap) return;
    if (!jqTransformedReq) {
      await handleRunJqTransform();
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError('');
      setSubmitResult(null);
      const res = await pushMetricValues(currentMap.id, metric.id, jqTransformedReq);
      setSubmitResult(res);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to push transformed metric values.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Copy Helpers ───────────────────────────────────────────────────────────
  const handleCopyCurl = () => {
    if (!metric || !currentMap) return;
    const req = parseDirectRequest() || { matchBy: directMatchBy, values: [] };
    const curl = generateCurlSnippet(currentMap.id, metric.id, req, token || undefined);
    navigator.clipboard.writeText(curl);
    setCopiedDirectCurl(true);
    setTimeout(() => setCopiedDirectCurl(false), 2000);
  };

  const handleCopyScript = () => {
    if (!metric || !currentMap) return;
    const script = generateAutomationScript(
      requestUrl || 'https://api.example.com/data',
      httpMethod,
      jqFilter,
      currentMap.id,
      metric.id,
      jqMatchBy,
      jqMatchKey || undefined,
      token || undefined,
    );
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const cardBtnCls = 'flex items-center gap-1.5 px-3 text-xs text-foreground bg-secondary/70 hover:text-muted-foreground hover:bg-secondary border-l border-border transition-colors cursor-pointer shrink-0';

  if (!metric) {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex flex-col rounded-lg bg-card overflow-hidden mx-3 sm:mx-6 my-3">
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
      <div className="flex flex-col rounded-lg bg-card overflow-hidden mx-3 sm:mx-6 my-3">
        {/* Card header */}
        <div className="flex items-stretch border-b border-border shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 text-md font-semibold text-foreground flex-1 min-w-0">
            <BarChart2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">REST API Push Values: {metric.name}</span>
            {metric.description && (
                <div className="px-4 py-2 text-xs text-muted-foreground  bg-muted/20">
                  {metric.description}
                </div>
            )}
          </div>

          {/* Metric Selector Dropdown (when multiple metrics exist) */}
          {allMetrics.length > 1 && (
            <div className="flex items-center gap-1.5 px-3 text-xs text-foreground bg-secondary/70 border-l border-border shrink-0">
              <label htmlFor="metric-selector" className="text-xs text-muted-foreground font-medium hidden sm:inline">
                Switch Metric:
              </label>
              <select
                id="metric-selector"
                aria-label="Select Metric"
                value={metric.id}
                onChange={(e) => {
                  const targetId = e.target.value;
                  if (targetId && targetId !== metric.id && sessionId) {
                    navigate(`/session/${sessionId}/metrics/${targetId}/push`);
                  }
                }}
                className="h-8 text-xs bg-muted border border-border rounded-md px-2 text-foreground"
              >
                {allMetrics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Link
            to={sessionId ? `/session/${sessionId}/metrics` : '/lobby'}
            className={cardBtnCls}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Metrics
          </Link>
        </div>

        <div className="p-4 sm:p-5 flex flex-col gap-4">

          {/* ── TAB 1: Direct JSON Push ──────────────────────────────────────── */}
          {activeTab === 'direct' && (
            <div className="flex flex-col gap-4 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/20 rounded-lg border border-border">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground font-medium">Match Strategy:</span>
                  <select
                    aria-label="Direct Match Strategy"
                    value={directMatchBy}
                    onChange={(e) => {
                      const next = e.target.value as MatchStrategy;
                      setDirectMatchBy(next);
                      const sample = generateSamplePayload(landmarks, next, directMatchKey);
                      setDirectJson(JSON.stringify(sample, null, 2));
                    }}
                    className="h-8 text-xs bg-muted border border-border rounded-md px-2 text-foreground"
                  >
                    <option value="NAME">NAME (Element Name)</option>
                    <option value="ALIAS">ALIAS (Element Alias)</option>
                    <option value="LINK">LINK (Resource URL)</option>
                  </select>

                  {directMatchBy === 'LINK' && (
                    <Input
                      placeholder="Match Key (e.g. repository)"
                      value={directMatchKey}
                      onChange={(e) => setDirectMatchKey(e.target.value)}
                      className="h-8 text-xs w-48"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground font-medium">Load Template:</span>
                  <select
                    value={directTemplateId}
                    onChange={(e) => handleSelectDirectTemplate(e.target.value)}
                    className="h-8 text-xs bg-muted border border-border rounded-md px-2 text-foreground"
                  >
                    <option value="">-- Choose Template... --</option>
                    {TRANSFORMATION_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground font-medium text-xs">JSON Request Payload:</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const sample = generateSamplePayload(landmarks, directMatchBy, directMatchKey);
                      setDirectJson(JSON.stringify(sample, null, 2));
                      setDirectJsonError('');
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Reset to Workspace Elements
                  </Button>
                </div>
                <Textarea
                  value={directJson}
                  onChange={(e) => {
                    setDirectJson(e.target.value);
                    setDirectJsonError('');
                  }}
                  className="font-mono text-xs min-h-64 resize-y bg-background"
                  placeholder="Paste JSON payload here..."
                />
              </div>

              {directJsonError && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{directJsonError}</AlertDescription>
                </Alert>
              )}

              {directReconciliation && (
                <div className="mt-2">
                  <MetricDryRunPreview summary={directReconciliation} metricName={metric.name} />
                </div>
              )}

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

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
                <Button variant="secondary" size="sm" onClick={handleCopyCurl} className="h-8 text-xs">
                  {copiedDirectCurl ? <Check className="h-3.5 w-3.5 text-emerald-400 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                  {copiedDirectCurl ? 'Copied cURL' : 'Copy cURL Command'}
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs flex items-center gap-1.5"
                    onClick={() => setActiveTab('jq')}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Back to JQ Transformation Builder
                  </Button>
                  <Button size="sm" onClick={handleExecuteDirectPush} disabled={submitting} className="h-8 text-xs">
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                    Push Metric Values
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: JQ Transformation Builder ────────────────────────────── */}
          {activeTab === 'jq' && (
            <div className="flex flex-col gap-4 pt-1">
              <h3>Transformation</h3>
              {/* Template & Transformation Selector Bar */}
              <div className="flex flex-col gap-3 p-3 bg-muted/20 rounded-lg border border-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground font-medium">Built-in Template:</span>
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

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground font-medium">Saved Transformation:</span>
                    <select
                      value={selectedTransformationId}
                      onChange={(e) => handleSelectTransformation(e.target.value)}
                      className="h-8 text-xs bg-muted border border-border rounded-md px-2 text-foreground"
                      aria-label="Transformation"
                    >
                      <option value="">-- New / Custom Transformation --</option>
                      {transformations.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

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

                    <div className="flex items-center gap-1.5">
                      <Input
                        placeholder="Transformation Name"
                        value={transformationName}
                        onChange={(e) => {
                          setTransformationName(e.target.value);
                          if (saveFeedback) setSaveFeedback('');
                        }}
                        className={`h-8 text-xs w-48 ${isDuplicateTransformationName ? 'border-destructive focus-visible:ring-destructive text-destructive' : ''}`}
                      />
                      {isDuplicateTransformationName && (
                        <span className="text-[11px] text-destructive font-medium whitespace-nowrap">
                          Name already in use
                        </span>
                      )}
                    </div>
                  </div>
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

                {/* Save Feedback Alert */}
                {saveFeedback && (
                  <div
                    className="flex items-center justify-between px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs"
                    data-testid="transformation-save-feedback"
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{saveFeedback}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSaveFeedback('')}
                      className="text-muted-foreground hover:text-foreground ml-2 cursor-pointer"
                      aria-label="Dismiss feedback"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              <h3>Data</h3>
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
                  <label className="text-muted-foreground font-medium text-xs">Input Data Sample:</label>
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

              {jqTransformError && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{jqTransformError}</AlertDescription>
                </Alert>
              )}

              {jqReconciliation && (
                <div className="mt-2">
                  <MetricDryRunPreview summary={jqReconciliation} metricName={metric.name} />
                </div>
              )}

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

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
                <Button variant="secondary" size="sm" onClick={handleCopyScript} className="h-8 text-xs">
                  {copiedScript ? <Check className="h-3.5 w-3.5 text-emerald-400 mr-1.5" /> : <Terminal className="h-3.5 w-3.5 mr-1.5" />}
                  {copiedScript ? 'Copied CI Script' : 'Copy CI/CD Automation Script'}
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs flex items-center gap-1.5"
                    onClick={() => setActiveTab('direct')}
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    Direct JSON Push
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleRunJqTransform}
                    className="h-8 text-xs flex items-center gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Execute JQ Dry-Run
                  </Button>
                  <Button size="sm" onClick={handleExecuteJqPush} disabled={submitting} className="h-8 text-xs">
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                    Push Transformed Values
                  </Button>
                </div>
              </div>
            </div>
          )}
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
    </div>
  );
};

export default MetricPushView;
