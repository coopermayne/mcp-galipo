import { useState, useCallback, useRef, useMemo } from 'react';
import { FileText, Upload, Loader2, AlertCircle, User, CheckCircle2 } from 'lucide-react';
import { Header, PageContent } from '../components/layout';
import { extractCaseInfo } from '../api/templates';
import type { CaseInfo, SigningAttorney } from '../types/template';

// Field configuration for validation and display
const CASE_INFO_FIELDS = [
  { key: 'court', label: 'Court', required: true, multiline: true, rows: 3 },
  { key: 'case_number', label: 'Case Number', required: true },
  { key: 'plaintiffs', label: 'Plaintiff(s)', required: true },
  { key: 'defendants', label: 'Defendant(s)', required: true },
  { key: 'judge', label: 'Judge', required: true },
  { key: 'magistrate_judge', label: 'Magistrate Judge', required: false },
  { key: 'motion_title', label: 'Motion Title', required: false },
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
}: FormFieldProps) {
  const isEmpty = !value?.trim();
  const hasError = showValidation && required && isEmpty;
  const isValid = showValidation && required && !isEmpty;

  const inputClasses = `
    w-full px-3 py-2 bg-bg border rounded-lg text-text placeholder-text-muted
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:border-transparent
    ${hasError
      ? 'border-red-300 dark:border-red-500/50 focus:ring-red-500/30 bg-red-50 dark:bg-red-900/10'
      : isValid
        ? 'border-green-300 dark:border-green-500/50 focus:ring-green-500/30'
        : 'border-border focus:ring-primary-500/30 focus:border-primary-500'
    }
    ${multiline ? 'resize-none' : ''}
  `;

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-text">
        {label}
        {required && (
          <span className={`text-xs ${hasError ? 'text-red-600 dark:text-red-400' : 'text-text-muted'}`}>*</span>
        )}
        {isValid && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={inputClasses}
          placeholder={placeholder}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
          placeholder={placeholder}
        />
      )}
      {hasError && (
        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          This field is required
        </p>
      )}
    </div>
  );
}

export function Templates() {
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [signingAttorney, setSigningAttorney] = useState<SigningAttorney | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
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

    setFileName(file.name);
    setError(null);
    setIsExtracting(true);
    setHasAttemptedSubmit(false);

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

  const updateCaseInfo = useCallback((field: keyof CaseInfo, value: string) => {
    setCaseInfo(prev => prev ? { ...prev, [field]: value || null } : null);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header
        title="Templates"
        subtitle="Extract case information from legal documents"
      />

      <PageContent className="space-y-6">
        {/* Upload Zone */}
        <section>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
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
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary-500/20 rounded-full animate-ping" />
                  <Loader2 className="w-12 h-12 text-primary-500 animate-spin relative" />
                </div>
                <div>
                  <p className="text-lg font-medium text-text">Analyzing document...</p>
                  <p className="text-sm text-text-muted mt-1">Extracting case information from {fileName}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className={`
                  p-4 rounded-full transition-colors duration-200
                  ${isDragging ? 'bg-primary-100 dark:bg-primary-800' : 'bg-bg-hover'}
                `}>
                  {fileName ? (
                    <FileText className="w-8 h-8 text-primary-500" />
                  ) : (
                    <Upload className="w-8 h-8 text-text-muted" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-medium text-text">
                    {fileName || 'Drag and drop a PDF here, or click to browse'}
                  </p>
                  <p className="text-sm text-text-muted mt-1">
                    {fileName
                      ? 'Drop another PDF to replace'
                      : 'We\'ll analyze the first 2 pages for case information'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-fadeSlideIn">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Form Sections */}
        {caseInfo && (
          <div className="space-y-6 animate-fadeSlideIn">
            {/* Validation Summary */}
            {hasAttemptedSubmit && !validationState.isValid && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Please fill in all required fields
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Missing: {validationState.missingFields.join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Case Information Section */}
            <section className="bg-bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border bg-bg-hover/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
                    <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text">Case Information</h2>
                    <p className="text-sm text-text-muted">Review and edit the extracted details</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Court - Full Width */}
                <FormField
                  label="Court"
                  value={caseInfo.court || ''}
                  onChange={(v) => updateCaseInfo('court', v)}
                  required
                  multiline
                  rows={3}
                  placeholder="UNITED STATES DISTRICT COURT&#10;CENTRAL DISTRICT OF CALIFORNIA"
                  showValidation={hasAttemptedSubmit}
                />

                {/* Two Column Grid */}
                <div className="grid gap-5 md:grid-cols-2">
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
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    label="Plaintiff(s)"
                    value={caseInfo.plaintiffs || ''}
                    onChange={(v) => updateCaseInfo('plaintiffs', v)}
                    required
                    placeholder="JOHN DOE"
                    showValidation={hasAttemptedSubmit}
                  />
                  <FormField
                    label="Defendant(s)"
                    value={caseInfo.defendants || ''}
                    onChange={(v) => updateCaseInfo('defendants', v)}
                    required
                    placeholder="ACME CORPORATION"
                    showValidation={hasAttemptedSubmit}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
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
            <section className="bg-bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border bg-bg-hover/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text">Hearing Information</h2>
                    <p className="text-sm text-text-muted">Optional scheduling details</p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="grid gap-5 md:grid-cols-3">
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
              <section className="bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-800/20 rounded-xl border border-primary-200 dark:border-primary-800 overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-primary-200/50 dark:border-primary-700/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-primary-900/50 rounded-lg shadow-sm">
                      <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-text">Signing Attorney</h2>
                      <p className="text-sm text-text-muted">Auto-populated from your profile</p>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-lg shadow-md">
                      {signingAttorney.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-semibold text-text">{signingAttorney.name}</p>
                      {signingAttorney.bar_number && (
                        <p className="text-sm text-text-secondary">
                          State Bar No. <span className="font-mono">{signingAttorney.bar_number}</span>
                        </p>
                      )}
                      <p className="text-sm text-text-muted">{signingAttorney.email}</p>
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
