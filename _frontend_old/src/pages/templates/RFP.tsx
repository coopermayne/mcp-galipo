import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { FileSearch, Loader2, AlertCircle, CheckCircle2, Sparkles, Download, ChevronDown, Settings, AlertTriangle, Upload, RotateCcw, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header, PageContent } from '../../components/layout';
import { extractRFP, analyzeRFPRequests, generateRFPResponse } from '../../api/rfp';
import { getObjections } from '../../api/objections';
import { request } from '../../api/common';
import { useAuth } from '../../context/AuthContext';
import type { RFPCaseInfo, RFPRequestWithObjections, Objection } from '../../types/rfp';

interface Attorney {
  id: number;
  firstName: string;
  lastName: string;
  initials: string;
  barNumber?: string | null;
  email?: string | null;
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  showValidation?: boolean;
  autoExpand?: boolean;
}

function FormField({
  label, value, onChange, required = false, multiline = false,
  rows = 1, placeholder, showValidation = false, autoExpand = false,
}: FormFieldProps) {
  const isEmpty = !value?.trim();
  const hasError = showValidation && required && isEmpty;
  const isValid = showValidation && required && !isEmpty;

  const inputClasses = `
    w-full px-2.5 py-1.5 bg-bg border rounded text-sm text-text placeholder-text-muted
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:border-transparent
    ${hasError
      ? 'border-red-300 dark:border-red-500/50 focus:ring-red-500/30 bg-red-50 dark:bg-red-900/10'
      : isValid
        ? 'border-green-300 dark:border-green-500/50 focus:ring-green-500/30'
        : 'border-border focus:ring-primary-500/30 focus:border-primary-500'
    }
    ${(multiline || autoExpand) ? 'resize-none overflow-hidden' : ''}
  `;

  const getAutoExpandRows = () => {
    if (!autoExpand || !value) return 1;
    return Math.max(1, Math.min(Math.ceil(value.length / 40), 3));
  };

  const useTextarea = multiline || autoExpand;
  const effectiveRows = autoExpand ? getAutoExpandRows() : rows;

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1 text-xs font-medium text-text-secondary">
        {label}
        {required && <span className={`${hasError ? 'text-red-600 dark:text-red-400' : 'text-text-muted'}`}>*</span>}
        {isValid && <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />}
      </label>
      {useTextarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={effectiveRows} className={inputClasses} placeholder={placeholder} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className={inputClasses} placeholder={placeholder} />
      )}
      {hasError && (
        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> Required
        </p>
      )}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle, rightElement }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-2.5 border-b border-border bg-bg-hover/50 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {subtitle && <span className="text-xs text-text-muted">{subtitle}</span>}
      </div>
      {rightElement}
    </div>
  );
}

function ObjectionChip({
  objection, selected, onToggle,
}: {
  objection: Objection;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-all duration-150 border
        ${selected
          ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 border-primary-300 dark:border-primary-700'
          : 'bg-bg text-text-muted border-border hover:border-primary-300 dark:hover:border-primary-700'
        }
      `}
      title={objection.formal_language}
    >
      {objection.name}
    </button>
  );
}

export function RFP() {
  const { user } = useAuth();

  const emptyCase: RFPCaseInfo = {
    court_name: null, case_no: null, header_plaintiffs: null, header_defendants: null,
    propounding_party: null, responding_party: null, set_number: null,
    document_title: null, response_document_title: null, multiple_plaintiffs: false, multiple_defendants: false,
  };

  // State
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [caseInfo, setCaseInfo] = useState<RFPCaseInfo>(emptyCase);
  const [requests, setRequests] = useState<RFPRequestWithObjections[]>([]);
  const [objections, setObjections] = useState<Objection[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [filename, setFilename] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attorney picker
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [selectedAttorneyId, setSelectedAttorneyId] = useState<number | null>(null);

  // Fetch attorneys + objections on mount
  useEffect(() => {
    async function init() {
      try {
        const [attData, objData] = await Promise.all([
          request<{ success: boolean; data: Attorney[] }>('/attorneys'),
          getObjections(),
        ]);
        const filtered = attData.data.filter(a => !(a.firstName === 'Dale' && a.lastName === 'Galipo'));
        setAttorneys(filtered);
        setObjections(objData);

        if (user) {
          const match = filtered.find(a => a.id === user.id);
          if (match) setSelectedAttorneyId(match.id);
        }
      } catch {
        // Silently fail
      }
    }
    init();
  }, [user]);

  const selectedAttorney = useMemo(
    () => attorneys.find(a => a.id === selectedAttorneyId) || null,
    [attorneys, selectedAttorneyId]
  );

  // File handling
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported');
      return;
    }

    setUploadedFile(file);
    setError(null);
    setIsExtracting(true);
    setHasAnalyzed(false);
    setHasAttemptedSubmit(false);

    try {
      const response = await extractRFP(file);
      setCaseInfo(response.case_info);
      setRequests(
        response.requests.map(r => ({
          ...r,
          objection_short_names: [],
          will_produce: false,
          withheld_on_objections: false,
        }))
      );
      // Auto-generate filename
      const set = response.case_info.set_number || 'One';
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
      setFilename(`${today} RFP Responses Set ${set}.docx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract RFP');
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleClearFile = useCallback(() => {
    setUploadedFile(null);
    setCaseInfo(emptyCase);
    setRequests([]);
    setHasAnalyzed(false);
    setHasAttemptedSubmit(false);
    setFilename('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const updateCaseInfo = useCallback((field: keyof RFPCaseInfo, value: string | boolean) => {
    setCaseInfo(prev => ({ ...prev, [field]: value || null }));
  }, []);

  // Analyze requests
  const handleAnalyze = useCallback(async () => {
    if (requests.length === 0) {
      setError('No requests to analyze');
      return;
    }
    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeRFPRequests(requests.map(r => ({ number: r.number, text: r.text })));
      // Apply suggested objections
      setRequests(prev => prev.map(req => {
        const analysis = result.analyses[String(req.number)];
        if (analysis) {
          return { ...req, objection_short_names: analysis.objections || [] };
        }
        return { ...req, objection_short_names: req.objection_short_names || [] };
      }));
      setHasAnalyzed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze requests');
    } finally {
      setIsAnalyzing(false);
    }
  }, [requests]);

  // Toggle objection on a request
  const toggleObjection = useCallback((reqIndex: number, shortName: string) => {
    setRequests(prev => prev.map((req, i) => {
      if (i !== reqIndex) return req;
      const names = new Set(req.objection_short_names ?? []);
      if (names.has(shortName)) names.delete(shortName);
      else names.add(shortName);
      return { ...req, objection_short_names: Array.from(names) };
    }));
  }, []);

  // Toggle will_produce / withheld
  const toggleRequestField = useCallback((reqIndex: number, field: 'will_produce' | 'withheld_on_objections') => {
    setRequests(prev => prev.map((req, i) => {
      if (i !== reqIndex) return req;
      return { ...req, [field]: !req[field] };
    }));
  }, []);

  // Update request text
  const updateRequestText = useCallback((reqIndex: number, text: string) => {
    setRequests(prev => prev.map((req, i) => i === reqIndex ? { ...req, text } : req));
  }, []);

  const updateRequestNumber = useCallback((reqIndex: number, num: number) => {
    setRequests(prev => prev.map((req, i) => i === reqIndex ? { ...req, number: num } : req));
  }, []);

  // Generate document
  const handleGenerate = useCallback(async () => {
    setHasAttemptedSubmit(true);

    if (!caseInfo.case_no?.trim()) {
      setError('Case number is required');
      return;
    }
    if (!selectedAttorney) {
      setError('Select a signing attorney');
      return;
    }
    if (!filename.trim()) {
      setError('Enter a filename');
      return;
    }
    if (requests.length === 0) {
      setError('No requests to respond to');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const signingAttorney = {
        name: `${selectedAttorney.firstName} ${selectedAttorney.lastName}`,
        bar_number: selectedAttorney.barNumber || null,
        email: selectedAttorney.email || '',
      };
      await generateRFPResponse(caseInfo, requests, signingAttorney, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate document');
    } finally {
      setIsGenerating(false);
    }
  }, [caseInfo, requests, selectedAttorney, filename]);

  const fileUrl = useMemo(
    () => uploadedFile ? URL.createObjectURL(uploadedFile) : null,
    [uploadedFile]
  );

  const hasExtracted = !isExtracting && uploadedFile && requests.length > 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header
        title="Templates"
        subtitle="RFP Response Generator"
        actions={
          <Link
            to="/templates/rfp/objections"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-bg-hover text-text-secondary hover:text-text transition-colors"
          >
            <Settings className="w-4 h-4" />
            Objections
          </Link>
        }
      />

      <PageContent variant="full" className="space-y-3 scrollbar-hide">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-fadeSlideIn">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Upload zone — hero when empty, slim bar after extraction */}
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />

        {isExtracting ? (
          /* Extracting state — centered spinner */
          <div
            className="flex flex-col items-center justify-center gap-4 py-24 border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-xl bg-primary-50/30 dark:bg-primary-900/10"
          >
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-text">Extracting RFP...</p>
              <p className="text-xs text-text-muted mt-1">{uploadedFile?.name}</p>
            </div>
          </div>
        ) : hasExtracted ? (
          /* Collapsed bar — file uploaded and extracted */
          <div className="flex items-center gap-3 px-4 py-2.5 bg-bg-surface border border-border rounded-lg">
            <FileSearch className="w-4 h-4 text-primary-500 flex-shrink-0" />
            <span className="text-sm font-medium text-text truncate">{uploadedFile.name}</span>
            <span className="text-xs text-text-muted flex-shrink-0">{(uploadedFile.size / 1024).toFixed(1)} KB</span>
            {fileUrl && (
              <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0">
                <ExternalLink className="w-3 h-3" />
                Open
              </a>
            )}
            <div className="flex-1" />
            <button
              onClick={handleClearFile}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-muted hover:text-text hover:bg-bg-hover transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Restart
            </button>
          </div>
        ) : (
          /* Hero drop zone — no file yet */
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
            onClick={() => fileInputRef.current?.click()}
            className={`
              flex flex-col items-center justify-center gap-4 py-24 border-2 border-dashed rounded-xl cursor-pointer
              transition-all duration-200
              ${isDragging
                ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 scale-[1.01]'
                : 'border-primary-300 dark:border-primary-700 bg-primary-50/30 dark:bg-primary-900/10 hover:border-primary-400 dark:hover:border-primary-600'
              }
            `}
          >
            <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
              <Upload className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text">
                Drop an RFP PDF here
              </p>
              <p className="text-xs text-text-muted mt-1">
                or click to browse — AI will extract case info & requests
              </p>
            </div>
          </div>
        )}

        {/* Two-column grid: Case Info | Output — only shown after extraction */}
        {hasExtracted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          {/* Case Info */}
          <section className="bg-bg-surface rounded-lg border border-border overflow-hidden">
            <SectionHeader
              icon={<FileSearch className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
              title="Case Information"
            />

            <div className="p-4 space-y-3">
              <FormField label="Court" value={caseInfo.court_name || ''} onChange={v => updateCaseInfo('court_name', v)} multiline rows={2} placeholder="SUPERIOR COURT OF CALIFORNIA&#10;COUNTY OF LOS ANGELES" />
              <FormField label="Case Number" value={caseInfo.case_no || ''} onChange={v => updateCaseInfo('case_no', v)} required placeholder="BC123456" showValidation={hasAttemptedSubmit} />
              <div className="grid gap-3 grid-cols-2">
                <FormField label="Plaintiff(s)" value={caseInfo.header_plaintiffs || ''} onChange={v => updateCaseInfo('header_plaintiffs', v)} placeholder="JOHN DOE" autoExpand />
                <FormField label="Defendant(s)" value={caseInfo.header_defendants || ''} onChange={v => updateCaseInfo('header_defendants', v)} placeholder="CITY OF LOS ANGELES" autoExpand />
              </div>
              <div className="grid gap-3 grid-cols-2">
                <FormField label="Propounding Party" value={caseInfo.propounding_party || ''} onChange={v => updateCaseInfo('propounding_party', v)} placeholder="Defendant CITY OF LOS ANGELES" autoExpand />
                <FormField label="Responding Party" value={caseInfo.responding_party || ''} onChange={v => updateCaseInfo('responding_party', v)} placeholder="Plaintiff JOHN DOE" autoExpand />
              </div>
              <FormField label="Set Number" value={caseInfo.set_number || ''} onChange={v => updateCaseInfo('set_number', v)} placeholder="One" />
            </div>
          </section>

          {/* Output Document */}
          <section className="bg-bg-surface rounded-lg border border-border overflow-hidden">
            <SectionHeader
              icon={<Download className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
              title="Output Document"
            />
            <div className="p-4 space-y-4">
              <FormField label="Document Title" value={caseInfo.response_document_title || ''} onChange={v => updateCaseInfo('response_document_title', v)} placeholder="PLAINTIFF'S RESPONSES TO DEFENDANT'S FIRST SET OF REQUESTS FOR PRODUCTION OF DOCUMENTS" autoExpand />
              <FormField label="Filename" value={filename} onChange={setFilename} required placeholder="2026.02.12 RFP Responses Set One.docx" showValidation={hasAttemptedSubmit} />

              <div className="flex items-center gap-3 flex-wrap">
                {selectedAttorney ? (
                  <label className="relative flex items-center gap-2.5 cursor-pointer group">
                    <select value={selectedAttorneyId ?? ''} onChange={e => setSelectedAttorneyId(e.target.value ? Number(e.target.value) : null)} className="absolute inset-0 opacity-0 cursor-pointer">
                      {attorneys.map(a => (
                        <option key={a.id} value={a.id}>{a.firstName} {a.lastName}{a.barNumber ? ` (SBN ${a.barNumber})` : ''}</option>
                      ))}
                    </select>
                    <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 group-hover:bg-primary-600 transition-colors">
                      {selectedAttorney.initials}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      {selectedAttorney.barNumber && <span>Bar No. <span className="font-mono">{selectedAttorney.barNumber}</span></span>}
                      {selectedAttorney.barNumber && selectedAttorney.email && <span>&middot;</span>}
                      {selectedAttorney.email && <span>{selectedAttorney.email}</span>}
                    </div>
                  </label>
                ) : attorneys.length > 0 ? (
                  <div className="relative">
                    <select value="" onChange={e => setSelectedAttorneyId(e.target.value ? Number(e.target.value) : null)}
                      className="appearance-none px-2.5 py-1.5 pr-8 bg-bg border border-border rounded text-sm text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all">
                      <option value="">Select attorney...</option>
                      {attorneys.map(a => (
                        <option key={a.id} value={a.id}>{a.firstName} {a.lastName}{a.barNumber ? ` (SBN ${a.barNumber})` : ''}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                  </div>
                ) : null}

                <button onClick={handleGenerate} disabled={isGenerating}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Generate Document
                </button>
              </div>
            </div>
          </section>
        </div>
        )}

        {/* Requests Section */}
        {hasExtracted && (
          <section className="bg-bg-surface rounded-lg border border-border overflow-hidden">
            <SectionHeader
              icon={<FileSearch className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
              title="Requests"
              subtitle={`${requests.length} request${requests.length !== 1 ? 's' : ''}`}
              rightElement={
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/70 disabled:opacity-50 transition-colors"
                  >
                    {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {hasAnalyzed ? 'Re-analyze' : 'Apply Objections'}
                  </button>
                </div>
              }
            />

            <div className="divide-y divide-border">
              {requests.map((req, idx) => (
                <div key={idx} className="p-4 space-y-2">
                  {/* Request header */}
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-text-muted">No.</span>
                      <input
                        type="number"
                        value={req.number}
                        onChange={e => updateRequestNumber(idx, parseInt(e.target.value) || 0)}
                        className="w-12 px-1.5 py-0.5 bg-bg border border-border rounded text-xs text-text text-center focus:outline-none focus:ring-1 focus:ring-primary-500/30"
                      />
                    </div>
                    <textarea
                      value={req.text}
                      onChange={e => updateRequestText(idx, e.target.value)}
                      rows={Math.max(2, Math.min(Math.ceil(req.text.length / 80), 6))}
                      className="flex-1 px-2.5 py-1.5 bg-bg border border-border rounded text-sm text-text resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    />
                  </div>

                  {/* Objection chips */}
                  {objections.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-16">
                      {objections.map(obj => (
                        <ObjectionChip
                          key={obj.short_name}
                          objection={obj}
                          selected={(req.objection_short_names ?? []).includes(obj.short_name)}
                          onToggle={() => toggleObjection(idx, obj.short_name)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Response options */}
                  <div className="flex items-center gap-4 pl-16">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={req.will_produce}
                        onChange={() => toggleRequestField(idx, 'will_produce')}
                        className="w-3.5 h-3.5 rounded border-border text-primary-600 focus:ring-primary-500/30"
                      />
                      <span className="text-xs text-text-muted">Will produce documents</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={req.withheld_on_objections}
                        onChange={() => toggleRequestField(idx, 'withheld_on_objections')}
                        className="w-3.5 h-3.5 rounded border-border text-primary-600 focus:ring-primary-500/30"
                      />
                      <span className="text-xs text-text-muted">Documents withheld on objections</span>
                    </label>
                    {req.withheld_on_objections && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        Privilege log may be required
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </PageContent>
    </div>
  );
}
