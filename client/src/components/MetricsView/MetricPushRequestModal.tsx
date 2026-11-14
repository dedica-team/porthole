import React, { useState, useEffect, useMemo } from 'react';
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
  FileCode,
  Sparkles,
} from 'lucide-react';
import { Popup } from '@/components/ui/popup';
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
  Landmark,
} from '@/types/landmark';
import {
  generateSamplePayload,
  generateCurlSnippet,
  generateAutomationScript,
  reconcileMetricPush,
} from '@/services/metricService';
import { runJqTransform } from '@/services/jqWorker';
import { pushMetricValues, saveMetricPreset, deleteMetricPreset } from '@/api/mapApi';
import MetricDryRunPreview from './MetricDryRunPreview';

interface Props {
  metric: QualityMetric | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const MetricPushRequestModal: React.FC<Props> = ({
  metric,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const currentMap = useMapStore((s) => s.currentMap);
  const token = useAuthStore((s) => s.token);
  const landmarks: Landmark[] = useMemo(() => {
    return Object.values(currentMap?.landmarks ?? {});
  }, [currentMap?.landmarks]);

  const [activeTab, setActiveTab] = useState<'direct' | 'jq'>('direct');

  // ── Direct JSON Tab State ──────────────────────────────────────────────────
  const [directMatchBy, setDirectMatchBy] = useState<MatchStrategy>('NAME');
  const [directMatchKey, setDirectMatchKey] = useState<string>('');
  const [directJson, setDirectJson] = useState<string>('');
  const [directJsonError, setDirectJsonError] = useState<string>('');
  const [copiedDirectCurl, setCopiedDirectCurl] = useState(false);

  // ── JQ Builder Tab State ───────────────────────────────────────────────────
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [presetName, setPresetName] = useState<string>('');
  const [requestUrl, setRequestUrl] = useState<string>('');
  const [httpMethod, setHttpMethod] = useState<string>('GET');
  const [jqFilter, setJqFilter] = useState<string>('[.[] | { element: .name, value: (.count | tostring), level: "OK" }]');
  const [samplePayload, setSamplePayload] = useState<string>('[\n  { "name": "Auth Service", "count": 5 },\n  { "name": "Billing Service", "count": 12 }\n]');
  const [jqMatchBy, setJqMatchBy] = useState<MatchStrategy>('NAME');
  const [jqMatchKey, setJqMatchKey] = useState<string>('');
  const [jqTransformedReq, setJqTransformedReq] = useState<PushMetricValuesRequest | null>(null);
  const [jqTransformError, setJqTransformError] = useState<string>('');
  const [copiedScript, setCopiedScript] = useState(false);

  // ── Execution State ────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<PushMetricValuesResponse | null>(null);
  const [submitError, setSubmitError] = useState<string>('');

  // Initialize sample payload when modal opens
  useEffect(() => {
    if (open && metric && landmarks.length >= 0) {
      const sample = generateSamplePayload(landmarks, 'NAME');
      setDirectJson(JSON.stringify(sample, null, 2));
      setDirectMatchBy('NAME');
      setDirectMatchKey('');
      setSubmitResult(null);
      setSubmitError('');
      setDirectJsonError('');
      setJqTransformError('');

      // If metric has presets, select the first preset by default
      if (metric.presets && metric.presets.length > 0) {
        const first = metric.presets[0];
        setSelectedPresetId(first.id);
        setPresetName(first.name);
        setRequestUrl(first.requestUrl);
        setHttpMethod(first.httpMethod || 'GET');
        setJqFilter(first.jqFilter || '.');
        setJqMatchBy(first.matchBy || 'NAME');
        setJqMatchKey(first.matchKey || '');
        if (first.lastPayloadSample) setSamplePayload(first.lastPayloadSample);
      } else {
        setSelectedPresetId('');
        setPresetName('');
      }
    }
  }, [open, metric, landmarks]);

  if (!metric || !currentMap) return null;

  const sessionId = currentMap.id;
  const endpointPath = `/api/sessions/${sessionId}/metrics/${metric.id}/values`;

  // ── Preset Selection Handler ──────────────────────────────────────────────
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId) {
      setPresetName('');
      return;
    }
    const preset = (metric.presets || []).find((p) => p.id === presetId);
    if (preset) {
      setPresetName(preset.name);
      setRequestUrl(preset.requestUrl);
      setHttpMethod(preset.httpMethod || 'GET');
      setJqFilter(preset.jqFilter || '.');
      setJqMatchBy(preset.matchBy || 'NAME');
      setJqMatchKey(preset.matchKey || '');
      if (preset.lastPayloadSample) setSamplePayload(preset.lastPayloadSample);
    }
  };

  const handleSavePreset = async () => {
    if (!presetName.trim() || !requestUrl.trim()) {
      setSubmitError('Preset name and foreign request URL are required.');
      return;
    }
    try {
      setSubmitting(true);
      await saveMetricPreset(sessionId, metric.id, {
        id: selectedPresetId || undefined,
        name: presetName.trim(),
        requestUrl: requestUrl.trim(),
        httpMethod,
        jqFilter: jqFilter.trim(),
        matchBy: jqMatchBy,
        matchKey: jqMatchKey.trim() || undefined,
        lastPayloadSample: samplePayload.trim() || undefined,
      });
      setSubmitError('');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePreset = async () => {
    if (!selectedPresetId) return;
    try {
      setSubmitting(true);
      await deleteMetricPreset(sessionId, metric.id, selectedPresetId);
      setSelectedPresetId('');
      setPresetName('');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

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

  // ── Execute Direct Batch Push ──────────────────────────────────────────────
  const handleExecuteDirectPush = async () => {
    setDirectJsonError('');
    setSubmitError('');
    setSubmitResult(null);

    const req = parseDirectRequest();
    if (!req) {
      setDirectJsonError('Invalid JSON structure. Please check the JSON format.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await pushMetricValues(sessionId, metric.id, req);
      setSubmitResult(res);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Execute JQ Dry-Run ─────────────────────────────────────────────────────
  const handleRunJqTransform = async () => {
    setJqTransformError('');
    setSubmitError('');
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(samplePayload);
    } catch {
      setJqTransformError('Sample payload must be valid JSON');
      return;
    }

    const res = await runJqTransform(parsedJson, jqFilter);
    if (!res.success) {
      setJqTransformError(res.error || 'JQ transformation error');
      setJqTransformedReq(null);
      return;
    }

    const values = Array.isArray(res.data) ? res.data : [res.data];
    const transformed: PushMetricValuesRequest = {
      matchBy: jqMatchBy,
      matchKey: jqMatchKey.trim() || undefined,
      values,
    };
    setJqTransformedReq(transformed);
  };

  const jqReconciliation = useMemo(() => {
    if (!jqTransformedReq) return null;
    return reconcileMetricPush(landmarks, jqTransformedReq);
  }, [landmarks, jqTransformedReq]);

  // ── Execute JQ Batch Push ──────────────────────────────────────────────────
  const handleExecuteJqPush = async () => {
    if (!jqTransformedReq) {
      await handleRunJqTransform();
      return;
    }
    try {
      setSubmitting(true);
      setSubmitError('');
      setSubmitResult(null);
      const res = await pushMetricValues(sessionId, metric.id, jqTransformedReq);
      setSubmitResult(res);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Copy Helpers ───────────────────────────────────────────────────────────
  const handleCopyCurl = () => {
    const req = parseDirectRequest() || { matchBy: directMatchBy, values: [] };
    const curl = generateCurlSnippet(sessionId, metric.id, req, token || undefined);
    navigator.clipboard.writeText(curl);
    setCopiedDirectCurl(true);
    setTimeout(() => setCopiedDirectCurl(false), 2000);
  };

  const handleCopyScript = () => {
    const script = generateAutomationScript(
      requestUrl || 'https://api.example.com/data',
      httpMethod,
      jqFilter,
      sessionId,
      metric.id,
      jqMatchBy,
      jqMatchKey || undefined,
    );
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <Popup
      title={`REST API Push Values: ${metric.name}`}
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-2xl max-h-[90vh] flex flex-col"
      contentClassName="overflow-y-auto flex-1 flex flex-col gap-4 p-4 text-xs"
    >
      {/* ── Metric Header Info ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 p-3 bg-muted/40 rounded-md border border-border">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground text-sm">{metric.name}</span>
          <span className="font-mono text-muted-foreground text-[11px] truncate max-w-xs">{metric.id}</span>
        </div>
        {metric.description && <p className="text-muted-foreground">{metric.description}</p>}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[11px] font-mono bg-muted text-foreground px-2 py-0.5 rounded border border-border">
            POST {endpointPath}
          </span>
        </div>
      </div>

      {/* ── Tabs Navigation ─────────────────────────────────────────────────── */}
      <div className="flex flex-col w-full gap-3">
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-md border border-border">
          <Button
            type="button"
            variant={activeTab === 'direct' ? 'secondary' : 'ghost'}
            className="flex items-center justify-center gap-1.5 text-xs h-7"
            role="tab"
            aria-selected={activeTab === 'direct'}
            onClick={() => setActiveTab('direct')}
          >
            <FileCode className="h-3.5 w-3.5" />
            Direct JSON Push
          </Button>
          <Button
            type="button"
            variant={activeTab === 'jq' ? 'secondary' : 'ghost'}
            className="flex items-center justify-center gap-1.5 text-xs h-7"
            role="tab"
            aria-selected={activeTab === 'jq'}
            onClick={() => setActiveTab('jq')}
          >
            <Sparkles className="h-3.5 w-3.5" />
            JQ Transformation Builder & Presets
          </Button>
        </div>

        {/* ── TAB 1: Direct JSON Push ───────────────────────────────────────── */}
        {activeTab === 'direct' && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Match By:</span>
                <select
                  value={directMatchBy}
                  onChange={(e) => setDirectMatchBy(e.target.value as MatchStrategy)}
                  className="h-7 text-xs bg-muted border border-border rounded px-2 text-foreground"
                >
                  <option value="NAME">Landmark Name (NAME)</option>
                  <option value="LINK">Resource URL (LINK)</option>
                </select>
                {directMatchBy === 'LINK' && (
                  <Input
                    placeholder="Link key (e.g. repository, docs)"
                    value={directMatchKey}
                    onChange={(e) => setDirectMatchKey(e.target.value)}
                    className="h-7 text-xs w-48"
                  />
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  const sample = generateSamplePayload(landmarks, directMatchBy, directMatchKey);
                  setDirectJson(JSON.stringify(sample, null, 2));
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Generate Map Sample
              </Button>
            </div>

            <div className="flex flex-col gap-1">
              <Textarea
                value={directJson}
                onChange={(e) => setDirectJson(e.target.value)}
                className="font-mono text-xs min-h-36 resize-y bg-background"
                placeholder="Paste JSON payload here..."
              />
              {directJsonError && <span className="text-rose-400 text-[11px]">{directJsonError}</span>}
            </div>

            {directReconciliation && (
              <MetricDryRunPreview summary={directReconciliation} metricName={metric.name} />
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Button variant="secondary" size="sm" onClick={handleCopyCurl} className="h-8 text-xs">
                {copiedDirectCurl ? <Check className="h-3.5 w-3.5 text-emerald-400 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copiedDirectCurl ? 'Copied cURL' : 'Copy cURL Snippet'}
              </Button>
              <Button size="sm" onClick={handleExecuteDirectPush} disabled={submitting} className="h-8 text-xs">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                Push Metric Values
              </Button>
            </div>
          </div>
        )}

        {/* ── TAB 2: JQ Transformation Builder ──────────────────────────────── */}
        {activeTab === 'jq' && (
          <div className="flex flex-col gap-3 pt-1">
            {/* Preset Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-muted/30 rounded border border-border">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Preset:</span>
                <select
                  value={selectedPresetId}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="h-7 text-xs bg-muted border border-border rounded px-2 text-foreground"
                >
                  <option value="">-- New / Custom Preset --</option>
                  {(metric.presets || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Preset Name"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="h-7 text-xs w-44"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={handleSavePreset} disabled={submitting}>
                  <Save className="h-3 w-3 mr-1" />
                  {selectedPresetId ? 'Update Preset' : 'Save Preset'}
                </Button>
                {selectedPresetId && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-400" onClick={handleDeletePreset} disabled={submitting}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Foreign Request Parameters */}
            <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
              <span className="text-muted-foreground font-medium">Foreign Endpoint:</span>
              <div className="flex items-center gap-1.5">
                <select
                  value={httpMethod}
                  onChange={(e) => setHttpMethod(e.target.value)}
                  className="h-7 text-xs bg-muted border border-border rounded px-1.5 text-foreground"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
                <Input
                  placeholder="https://gitlab.example.com/api/v4/projects/123/merge_requests"
                  value={requestUrl}
                  onChange={(e) => setRequestUrl(e.target.value)}
                  className="h-7 text-xs flex-1"
                />
              </div>

              <span className="text-muted-foreground font-medium">Match Strategy:</span>
              <div className="flex items-center gap-2">
                <select
                  value={jqMatchBy}
                  onChange={(e) => setJqMatchBy(e.target.value as MatchStrategy)}
                  className="h-7 text-xs bg-muted border border-border rounded px-2 text-foreground"
                >
                  <option value="NAME">NAME (Landmark Name)</option>
                  <option value="LINK">LINK (Resource URL)</option>
                </select>
                {jqMatchBy === 'LINK' && (
                  <Input
                    placeholder="Key (e.g. repository)"
                    value={jqMatchKey}
                    onChange={(e) => setJqMatchKey(e.target.value)}
                    className="h-7 text-xs w-40"
                  />
                )}
              </div>
            </div>

            {/* Foreign JSON Sample & JQ Filter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">Foreign JSON Sample:</span>
                <Textarea
                  value={samplePayload}
                  onChange={(e) => setSamplePayload(e.target.value)}
                  className="font-mono text-xs min-h-28 resize-y bg-background"
                  placeholder="Paste response from GitLab / GitHub..."
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">JQ Filter Expression:</span>
                <Textarea
                  value={jqFilter}
                  onChange={(e) => setJqFilter(e.target.value)}
                  className="font-mono text-xs min-h-28 resize-y bg-background"
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

            <div className="flex justify-start">
              <Button variant="secondary" size="sm" onClick={handleRunJqTransform} className="h-7 text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Execute JQ Dry-Run
              </Button>
            </div>

            {jqReconciliation && (
              <MetricDryRunPreview summary={jqReconciliation} metricName={metric.name} />
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Button variant="secondary" size="sm" onClick={handleCopyScript} className="h-8 text-xs">
                {copiedScript ? <Check className="h-3.5 w-3.5 text-emerald-400 mr-1" /> : <Terminal className="h-3.5 w-3.5 mr-1" />}
                {copiedScript ? 'Copied CI Script' : 'Copy CI/CD Automation Script'}
              </Button>
              <Button size="sm" onClick={handleExecuteJqPush} disabled={submitting} className="h-8 text-xs">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                Push Transformed Values
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Feedback & Diagnostic Banners ───────────────────────────────────── */}
      {submitError && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{submitError}</AlertDescription>
        </Alert>
      )}

      {submitResult && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md flex flex-col gap-1.5 text-xs text-foreground">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <Check className="h-4 w-4" />
            Batch push completed successfully! Updated {submitResult.updatedCount} landmark(s).
          </div>
          {submitResult.unmatchedElements && submitResult.unmatchedElements.length > 0 && (
            <div className="text-amber-400 text-[11px]">
              ⚠️ Unmatched element(s): {submitResult.unmatchedElements.join(', ')}
            </div>
          )}
          {submitResult.warnings && submitResult.warnings.length > 0 && (
            <div className="text-muted-foreground text-[11px]">
              {submitResult.warnings.map((w, i) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </Popup>
  );
};

export default MetricPushRequestModal;
