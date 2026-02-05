import { useState, useCallback, useRef, useMemo } from 'react';
import { FileText, Upload, Loader2, AlertCircle, User, CheckCircle2, Sparkles, X } from 'lucide-react';
import { Header, PageContent } from '../components/layout';
import { extractCaseInfo, improveDocumentName, generateFilename } from '../api/templates';
import type { CaseInfo, SigningAttorney } from '../types/template';

// Field configuration for validation and display
const CASE_INFO_FIELDS = [
  { key: 'court', label: 'Court', required: true, multiline: true, rows: 2 },
  { key: 'case_number', label: 'Case Number', required: true },
  { key: 'plaintiffs', label: 'Plaintiff(s)', required: true, autoExpand: true },
  { key: 'defendants', label: 'Defendant(s)', required: true, autoExpand: true },
  { key: 'judge', label: 'Judge', required: true },
  { key: 'magistrate_judge', label: 'Magistrate Judge', required: false },
  { key: 'motion_title', label: 'Motion Title', required: false, autoExpand: true },
] as const;

const HEARING_INFO_FIELDS = [
  { key: 'hearing_date', label: 'Hearing Date', required: false, placeholder: 'January 15, 2025' },
  { key: 'hearing_time', label: 'Hearing Time', required: false, placeholder: '10:00 a.m.' },
  { key: 'courtroom', label: 'Courtroom', required: false, placeholder: 'Courtroom 10A' },
] as const;

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

  // For auto-expand, calculate minimum rows based on content
  const getAutoExpandRows = () => {
    if (!autoExpand || !value) return 1;
    // Estimate ~40 chars per line in the typical column width
    const estimatedLines = Math.ceil(value.length / 40);
    return Math.max(1, Math.min(estimatedLines, 3)); // Cap at 3 rows
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

export function Templates() {
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [signingAttorney, setSigningAttorney] = useState<SigningAttorney | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const [filename, setFilename] = useState('');
  const [isImprovingName, setIsImprovingName] = useState(false);
  const [isGeneratingFilename, setIsGeneratingFilename] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate validation state
  const validationState = useMemo(() => {
    if (!caseInfo) return { isValid: false, missingFields: [] };

    const missingFields = CASE_INFO_FIELDS
      .filter(f => f.required && !caseInfo[f.key as keyof CaseInfo]?.trim())
      .map(f => f.label);

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
      setSigningAttorney(response.signing_attorney);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract case information');
      setCaseInfo(null);
      setSigningAttorney(null);
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
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
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClearFile = useCallback(() => {
    setUploadedFile(null);
    setCaseInfo(null);
    setSigningAttorney(null);
    setDocumentName('');
    setFilename('');
    setHasAttemptedSubmit(false);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const updateCaseInfo = useCallback((field: keyof CaseInfo, value: string) => {
    setCaseInfo(prev => prev ? { ...prev, [field]: value || null } : null);
  }, []);

  const handleImproveDocumentName = useCallback(async () => {
    if (!caseInfo) return;

    setIsImprovingName(true);
    try {
      const improved = await improveDocumentName(documentName, caseInfo.motion_title || '');
      setDocumentName(improved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to improve document name');
    } finally {
      setIsImprovingName(false);
    }
  }, [caseInfo, documentName]);

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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header
        title="Templates"
        subtitle="Extract case information from legal documents"
      />

      <PageContent className="space-y-4 scrollbar-hide">
        {/* Upload Zone - Full size when no file, compact when file uploaded */}
        {!uploadedFile || isExtracting ? (
          <section
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-all duration-200
              ${isDragging
                ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 scale-[1.01]'
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
              <div className="flex items-center justify-center gap-3 py-2">
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                <div className="text-left">
                  <p className="text-sm font-medium text-text">Analyzing document...</p>
                  <p className="text-xs text-text-muted">Extracting case information from {uploadedFile?.name}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 py-2">
                <div className={`
                  p-2.5 rounded-full transition-colors duration-200
                  ${isDragging ? 'bg-primary-100 dark:bg-primary-800' : 'bg-bg-hover'}
                `}>
                  <Upload className="w-6 h-6 text-text-muted" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-text">
                    Drag and drop a PDF here, or click to browse
                  </p>
                  <p className="text-xs text-text-muted">
                    We'll analyze the first 2 pages for case information
                  </p>
                </div>
              </div>
            )}
          </section>
        ) : (
          /* Compact file display after upload */
          <section className="flex items-center gap-3 p-3 bg-bg-surface border border-border rounded-lg">
            <FileText className="w-5 h-5 text-primary-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <a
                href={URL.createObjectURL(uploadedFile)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline truncate block"
              >
                {uploadedFile.name}
              </a>
              <p className="text-xs text-text-muted">
                {(uploadedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={handleClearFile}
              className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text transition-colors"
              title="Clear file"
            >
              <X className="w-4 h-4" />
            </button>
          </section>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-fadeSlideIn">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Form Sections */}
        {caseInfo && (
          <div className="space-y-4 animate-fadeSlideIn">
            {/* Validation Summary */}
            {hasAttemptedSubmit && !validationState.isValid && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Missing: {validationState.missingFields.join(', ')}
                </p>
              </div>
            )}

            {/* Document Output Section */}
            <section className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-800/20 rounded-lg border border-emerald-200 dark:border-emerald-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-emerald-200/50 dark:border-emerald-700/50">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-sm font-semibold text-text">Output Document</h2>
                </div>
              </div>
              <div className="p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    label="Document Name"
                    value={documentName}
                    onChange={setDocumentName}
                    placeholder="Type a name or click ✨ to suggest"
                    rightElement={
                      <button
                        type="button"
                        onClick={handleImproveDocumentName}
                        disabled={isImprovingName || !caseInfo}
                        className="p-1 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Improve document name"
                      >
                        {isImprovingName ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                      </button>
                    }
                  />
                  <FormField
                    label="Filename"
                    value={filename}
                    onChange={setFilename}
                    placeholder="Click ✨ to generate from name"
                    rightElement={
                      <button
                        type="button"
                        onClick={handleGenerateFilename}
                        disabled={isGeneratingFilename || !documentName.trim()}
                        className="p-1 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Generate filename from document name"
                      >
                        {isGeneratingFilename ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                      </button>
                    }
                  />
                </div>
              </div>
            </section>

            {/* Case Information Section */}
            <section className="bg-bg-surface rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-bg-hover/50">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  <h2 className="text-sm font-semibold text-text">Case Information</h2>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Court - Full Width */}
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

                {/* Two Column Grid */}
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
                    showValidation={hasAttemptedSubmit}
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
                    showValidation={hasAttemptedSubmit}
                  />
                </div>
              </div>
            </section>

            {/* Hearing Information Section */}
            <section className="bg-bg-surface rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-bg-hover/50">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h2 className="text-sm font-semibold text-text">Hearing Information</h2>
                  <span className="text-xs text-text-muted">(Optional)</span>
                </div>
              </div>

              <div className="p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {HEARING_INFO_FIELDS.map((field) => (
                    <FormField
                      key={field.key}
                      label={field.label}
                      value={caseInfo[field.key as keyof CaseInfo] || ''}
                      onChange={(v) => updateCaseInfo(field.key as keyof CaseInfo, v)}
                      placeholder={field.placeholder}
                      showValidation={hasAttemptedSubmit}
                    />
                  ))}
                </div>
              </div>
            </section>

            {/* Signing Attorney Section */}
            {signingAttorney && (
              <section className="bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-800/20 rounded-lg border border-primary-200 dark:border-primary-800 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-primary-200/50 dark:border-primary-700/50">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    <h2 className="text-sm font-semibold text-text">Signing Attorney</h2>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                      {signingAttorney.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-text">{signingAttorney.name}</p>
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        {signingAttorney.bar_number && (
                          <span>Bar No. <span className="font-mono">{signingAttorney.bar_number}</span></span>
                        )}
                        <span>{signingAttorney.email}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </PageContent>
    </div>
  );
}
