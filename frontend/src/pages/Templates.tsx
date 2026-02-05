import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { FileText, Upload, Loader2, AlertCircle, User, CheckCircle2, Sparkles, X, Download, Check, Calendar, ChevronDown } from 'lucide-react';
import { Header, PageContent } from '../components/layout';
import { extractCaseInfo, improveDocumentName, generateFilename, generateDocument } from '../api/templates';
import { request } from '../api/common';
import { useAuth } from '../context/AuthContext';
import type { CaseInfo } from '../types/template';

// Document sections that can be included/excluded
const DOCUMENT_SECTIONS = [
  { key: 'notice', label: 'Notice of Motion', description: 'Required for motions' },
  { key: 'meet_confer', label: 'Meet & Confer', description: 'L.R. 7-3 compliance statement' },
  { key: 'toc', label: 'Table of Contents', description: 'Auto-generated TOC' },
  { key: 'toa', label: 'Table of Authorities', description: 'Case citations index' },
  { key: 'memo', label: 'Memorandum', description: 'Memorandum of Points and Authorities' },
  { key: 'declaration', label: 'Declaration', description: 'Declaration in support' },
  { key: 'joint_stip', label: 'Joint Stipulation', description: 'Joint stipulation document' },
  { key: 'generic', label: 'Generic Pleading', description: 'Generic pleading body' },
  { key: 'cert_compliance', label: 'Certificate of Compliance', description: 'Word count certification' },
] as const;

type SectionKey = typeof DOCUMENT_SECTIONS[number]['key'];

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
  rightElement?: React.ReactNode;
  autoExpand?: boolean;
}

function FormField({
  label,
  value,
  onChange,
  required = false,
  multiline = false,
  rows = 1,
  placeholder,
  showValidation = false,
  rightElement,
  autoExpand = false,
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
    ${rightElement ? 'pr-10' : ''}
  `;

  const getAutoExpandRows = () => {
    if (!autoExpand || !value) return 1;
    const estimatedLines = Math.ceil(value.length / 40);
    return Math.max(1, Math.min(estimatedLines, 3));
  };

  const useTextarea = multiline || autoExpand;
  const effectiveRows = autoExpand ? getAutoExpandRows() : rows;

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1 text-xs font-medium text-text-secondary">
        {label}
        {required && (
          <span className={`${hasError ? 'text-red-600 dark:text-red-400' : 'text-text-muted'}`}>*</span>
        )}
        {isValid && <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />}
      </label>
      <div className="relative">
        {useTextarea ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={effectiveRows}
            className={inputClasses}
            placeholder={placeholder}
            title={value || undefined}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
            placeholder={placeholder}
            title={value || undefined}
          />
        )}
        {rightElement && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
      {hasError && (
        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Required
        </p>
      )}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="px-4 py-2.5 border-b border-border bg-bg-hover/50">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {subtitle && <span className="text-xs text-text-muted">{subtitle}</span>}
      </div>
    </div>
  );
}

export function Templates() {
  const { user } = useAuth();

  const emptyCaseInfo: CaseInfo = {
    court: null, case_number: null, plaintiffs: null, defendants: null,
    judge: null, magistrate_judge: null, motion_title: null,
    hearing_date: null, hearing_time: null, courtroom: null,
  };

  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [caseInfo, setCaseInfo] = useState<CaseInfo>(emptyCaseInfo);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const [filename, setFilename] = useState('');
  const [isImprovingName, setIsImprovingName] = useState(false);
  const [isGeneratingFilename, setIsGeneratingFilename] = useState(false);
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Set<SectionKey>>(new Set(['toc', 'toa']));
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attorney selection
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [selectedAttorneyId, setSelectedAttorneyId] = useState<number | null>(null);

  // Fetch attorneys on mount
  useEffect(() => {
    async function fetchAttorneys() {
      try {
        const data = await request<{ success: boolean; data: Attorney[] }>('/attorneys');
        // Exclude Dale Galipo (he's the firm owner, always on signature block)
        const filtered = data.data.filter(a =>
          !(a.firstName === 'Dale' && a.lastName === 'Galipo')
        );
        setAttorneys(filtered);

        // Default to current logged-in user if they're in the attorney list
        if (user) {
          const match = filtered.find(a => a.id === user.id);
          if (match) setSelectedAttorneyId(match.id);
        }
      } catch {
        // Silently fail — user can still type manually
      }
    }
    fetchAttorneys();
  }, [user]);

  const selectedAttorney = useMemo(
    () => attorneys.find(a => a.id === selectedAttorneyId) || null,
    [attorneys, selectedAttorneyId]
  );

  const validationState = useMemo(() => {
    const missingFields = [
      !caseInfo.court?.trim() && 'Court',
      !caseInfo.case_number?.trim() && 'Case Number',
      !caseInfo.plaintiffs?.trim() && 'Plaintiff(s)',
      !caseInfo.defendants?.trim() && 'Defendant(s)',
      !caseInfo.judge?.trim() && 'Judge',
    ].filter(Boolean) as string[];

    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  }, [caseInfo]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported');
      return;
    }

    setUploadedFile(file);
    setError(null);
    setIsExtracting(true);
    setHasAttemptedSubmit(false);
    setDocumentName('');
    setFilename('');

    try {
      const response = await extractCaseInfo(file);
      setCaseInfo(response.case_info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract case information');
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleClearFile = useCallback(() => {
    setUploadedFile(null);
    setCaseInfo(emptyCaseInfo);
    setDocumentName('');
    setFilename('');
    setHasAttemptedSubmit(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const updateCaseInfo = useCallback((field: keyof CaseInfo, value: string) => {
    setCaseInfo(prev => ({ ...prev, [field]: value || null }));
  }, []);

  const handleImproveDocumentName = useCallback(async () => {
    setIsImprovingName(true);
    try {
      const result = await improveDocumentName(documentName, caseInfo.motion_title || '');
      setDocumentName(result.document_name);
      setSelectedSections(new Set(result.sections as SectionKey[]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to improve document name');
    } finally {
      setIsImprovingName(false);
    }
  }, [caseInfo, documentName]);

  const toggleSection = useCallback((key: SectionKey) => {
    setSelectedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleGenerateFilename = useCallback(async () => {
    if (!documentName.trim()) {
      setError('Enter a document name first');
      return;
    }
    setIsGeneratingFilename(true);
    try {
      const generated = await generateFilename(documentName);
      setFilename(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate filename');
    } finally {
      setIsGeneratingFilename(false);
    }
  }, [documentName]);

  const handleGenerateDocument = useCallback(async () => {
    setHasAttemptedSubmit(true);

    if (!documentName.trim()) {
      setError('Enter a document name');
      return;
    }
    if (!filename.trim()) {
      setError('Enter a filename');
      return;
    }
    if (!selectedAttorney) {
      setError('Select a signing attorney');
      return;
    }

    setIsGeneratingDocument(true);
    setError(null);
    try {
      const signingAttorney = {
        name: `${selectedAttorney.firstName} ${selectedAttorney.lastName}`,
        bar_number: selectedAttorney.barNumber || null,
        email: selectedAttorney.email || '',
      };
      await generateDocument(caseInfo, signingAttorney, documentName, filename, Array.from(selectedSections));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate document');
    } finally {
      setIsGeneratingDocument(false);
    }
  }, [caseInfo, selectedAttorney, documentName, filename, selectedSections]);

  const sparkleButton = (onClick: () => void, loading: boolean, disabled?: boolean) => (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="p-1 rounded hover:bg-primary-100 dark:hover:bg-primary-800/50 text-primary-600 dark:text-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title="AI suggest"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header title="Templates" subtitle="Generate pleading documents" />

      <PageContent className="space-y-3 scrollbar-hide">
        {/* Upload Zone */}
        <section
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative border border-dashed rounded-lg p-2.5 cursor-pointer
            transition-all duration-200
            ${isDragging
              ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20'
              : 'border-border hover:border-primary-400 hover:bg-bg-hover'
            }
            ${isExtracting ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {isExtracting ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-primary-500 animate-spin flex-shrink-0" />
              <p className="text-xs text-text-muted">Analyzing {uploadedFile?.name}...</p>
            </div>
          ) : uploadedFile ? (
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-primary-500 flex-shrink-0" />
              <a
                href={URL.createObjectURL(uploadedFile)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline truncate flex-1"
                onClick={(e) => e.stopPropagation()}
              >
                {uploadedFile.name}
              </a>
              <span className="text-xs text-text-muted">{(uploadedFile.size / 1024).toFixed(1)} KB</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleClearFile(); }}
                className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text transition-colors"
                title="Clear file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 text-text-muted flex-shrink-0" />
              <p className="text-xs text-text-muted">
                <span className="font-medium text-text">Drop a PDF</span> to auto-fill, or fill in manually below
              </p>
            </div>
          )}
        </section>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-fadeSlideIn">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Validation Summary */}
        {hasAttemptedSubmit && !validationState.isValid && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Missing: {validationState.missingFields.join(', ')}
            </p>
          </div>
        )}

        {/* Case Information */}
        <section className="bg-bg-surface rounded-lg border border-border overflow-hidden">
          <SectionHeader
            icon={<FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
            title="Case Information"
          />
          <div className="p-4 space-y-3">
            <FormField
              label="Court"
              value={caseInfo.court || ''}
              onChange={(v) => updateCaseInfo('court', v)}
              required
              multiline
              rows={2}
              placeholder="UNITED STATES DISTRICT COURT&#10;CENTRAL DISTRICT OF CALIFORNIA"
              showValidation={hasAttemptedSubmit}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                label="Case Number"
                value={caseInfo.case_number || ''}
                onChange={(v) => updateCaseInfo('case_number', v)}
                required
                placeholder="2:24-cv-01234-ABC-XYZ"
                showValidation={hasAttemptedSubmit}
              />
              <FormField
                label="Motion Title"
                value={caseInfo.motion_title || ''}
                onChange={(v) => updateCaseInfo('motion_title', v)}
                placeholder="Motion to Compel Discovery"
                autoExpand
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                label="Plaintiff(s)"
                value={caseInfo.plaintiffs || ''}
                onChange={(v) => updateCaseInfo('plaintiffs', v)}
                required
                placeholder="JOHN DOE"
                showValidation={hasAttemptedSubmit}
                autoExpand
              />
              <FormField
                label="Defendant(s)"
                value={caseInfo.defendants || ''}
                onChange={(v) => updateCaseInfo('defendants', v)}
                required
                placeholder="ACME CORPORATION"
                showValidation={hasAttemptedSubmit}
                autoExpand
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                label="Judge"
                value={caseInfo.judge || ''}
                onChange={(v) => updateCaseInfo('judge', v)}
                required
                placeholder="Hon. John Smith"
                showValidation={hasAttemptedSubmit}
              />
              <FormField
                label="Magistrate Judge"
                value={caseInfo.magistrate_judge || ''}
                onChange={(v) => updateCaseInfo('magistrate_judge', v)}
                placeholder="Magistrate Judge Jane Doe"
              />
            </div>
          </div>
        </section>

        {/* Hearing Information */}
        <section className="bg-bg-surface rounded-lg border border-border overflow-hidden">
          <SectionHeader
            icon={<Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
            title="Hearing Information"
            subtitle="(Optional)"
          />
          <div className="p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <FormField
                label="Hearing Date"
                value={caseInfo.hearing_date || ''}
                onChange={(v) => updateCaseInfo('hearing_date', v)}
                placeholder="January 15, 2025"
              />
              <FormField
                label="Hearing Time"
                value={caseInfo.hearing_time || ''}
                onChange={(v) => updateCaseInfo('hearing_time', v)}
                placeholder="10:00 a.m."
              />
              <FormField
                label="Courtroom"
                value={caseInfo.courtroom || ''}
                onChange={(v) => updateCaseInfo('courtroom', v)}
                placeholder="Courtroom 10A"
              />
            </div>
          </div>
        </section>

        {/* Signing Attorney */}
        <section className="bg-bg-surface rounded-lg border border-border overflow-hidden">
          <SectionHeader
            icon={<User className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
            title="Signing Attorney"
          />
          <div className="p-4">
            {attorneys.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Attorney</label>
                  <div className="relative">
                    <select
                      value={selectedAttorneyId ?? ''}
                      onChange={(e) => setSelectedAttorneyId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full appearance-none px-2.5 py-1.5 pr-8 bg-bg border border-border rounded text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all duration-200"
                    >
                      <option value="">Select attorney...</option>
                      {attorneys.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.firstName} {a.lastName}
                          {a.barNumber ? ` (SBN ${a.barNumber})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                  </div>
                </div>
                {selectedAttorney && (
                  <div className="flex items-center gap-3 px-3 py-2 bg-bg-hover/50 rounded-md">
                    <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-xs">
                      {selectedAttorney.initials}
                    </div>
                    <div className="space-y-0.5 text-xs text-text-muted">
                      {selectedAttorney.barNumber && (
                        <span>Bar No. <span className="font-mono">{selectedAttorney.barNumber}</span></span>
                      )}
                      {selectedAttorney.barNumber && selectedAttorney.email && <span className="mx-1.5">&middot;</span>}
                      {selectedAttorney.email && <span>{selectedAttorney.email}</span>}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-muted">No attorneys found. Add attorneys in the admin panel.</p>
            )}
          </div>
        </section>

        {/* Output Document */}
        <section className="bg-bg-surface rounded-lg border border-border overflow-hidden">
          <SectionHeader
            icon={<Download className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
            title="Output Document"
          />
          <div className="p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                label="Document Name"
                value={documentName}
                onChange={setDocumentName}
                required
                placeholder="Opposition to Motion for Summary Judgment"
                showValidation={hasAttemptedSubmit}
                rightElement={sparkleButton(handleImproveDocumentName, isImprovingName)}
              />
              <FormField
                label="Filename"
                value={filename}
                onChange={setFilename}
                required
                placeholder="2026.02.05 Opp MSJ.docx"
                showValidation={hasAttemptedSubmit}
                rightElement={sparkleButton(handleGenerateFilename, isGeneratingFilename, !documentName.trim())}
              />
            </div>

            {/* Section Selection */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">
                Include Sections
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DOCUMENT_SECTIONS.map((section) => {
                  const isSelected = selectedSections.has(section.key);
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => toggleSection(section.key)}
                      className={`
                        inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
                        transition-all duration-150 border
                        ${isSelected
                          ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 border-primary-300 dark:border-primary-700'
                          : 'bg-bg text-text-secondary border-border hover:border-primary-300 dark:hover:border-primary-700'
                        }
                      `}
                      title={section.description}
                    >
                      <span className={`
                        w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0
                        ${isSelected
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : 'border-current'
                        }
                      `}>
                        {isSelected && <Check className="w-2.5 h-2.5" />}
                      </span>
                      {section.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateDocument}
              disabled={isGeneratingDocument}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGeneratingDocument ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Generate Document
            </button>
          </div>
        </section>
      </PageContent>
    </div>
  );
}
