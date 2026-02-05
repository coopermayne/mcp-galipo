import { useState, useCallback, useRef } from 'react';
import { FileText, Upload, Loader2, AlertCircle, User } from 'lucide-react';
import { Header, PageContent } from '../components/layout';
import { extractCaseInfo } from '../api/templates';
import type { CaseInfo, SigningAttorney } from '../types/template';

export function Templates() {
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [signingAttorney, setSigningAttorney] = useState<SigningAttorney | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported');
      return;
    }

    setFileName(file.name);
    setError(null);
    setIsExtracting(true);

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
    <>
      <Header
        title="Templates"
        subtitle="Extract case information from legal documents"
      />

      <PageContent>
        <div className="space-y-6">
          {/* Upload Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors
              ${isDragging
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
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
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
                <div>
                  <p className="text-lg font-medium text-text">Analyzing document...</p>
                  <p className="text-sm text-text-muted mt-1">Extracting case information from {fileName}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className={`
                  p-3 rounded-full
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
                      : 'Analyzing first 2 pages for case information'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Case Information Form */}
          {caseInfo && (
            <div className="bg-bg-surface rounded-lg border border-border">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="text-lg font-semibold text-text">Case Information</h2>
                <p className="text-sm text-text-muted">Review and edit the extracted information</p>
              </div>

              <div className="p-4 space-y-4">
                {/* Required Fields */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Court <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={caseInfo.court || ''}
                      onChange={(e) => updateCaseInfo('court', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                      placeholder="UNITED STATES DISTRICT COURT&#10;CENTRAL DISTRICT OF CALIFORNIA"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Case Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={caseInfo.case_number || ''}
                      onChange={(e) => updateCaseInfo('case_number', e.target.value)}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., 2:24-cv-01234-ABC-XYZ"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Plaintiff(s) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={caseInfo.plaintiffs || ''}
                      onChange={(e) => updateCaseInfo('plaintiffs', e.target.value)}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., JOHN DOE"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Defendant(s) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={caseInfo.defendants || ''}
                      onChange={(e) => updateCaseInfo('defendants', e.target.value)}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., ACME CORPORATION"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Judge <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={caseInfo.judge || ''}
                      onChange={(e) => updateCaseInfo('judge', e.target.value)}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Honorable John Smith"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Magistrate Judge
                    </label>
                    <input
                      type="text"
                      value={caseInfo.magistrate_judge || ''}
                      onChange={(e) => updateCaseInfo('magistrate_judge', e.target.value)}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Magistrate Judge Jane Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text mb-1">
                    Motion Title
                  </label>
                  <input
                    type="text"
                    value={caseInfo.motion_title || ''}
                    onChange={(e) => updateCaseInfo('motion_title', e.target.value)}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Motion to Compel Discovery"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Hearing Information */}
          {caseInfo && (
            <div className="bg-bg-surface rounded-lg border border-border">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="text-lg font-semibold text-text">Hearing Information</h2>
                <p className="text-sm text-text-muted">Optional hearing details</p>
              </div>

              <div className="p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Hearing Date
                    </label>
                    <input
                      type="text"
                      value={caseInfo.hearing_date || ''}
                      onChange={(e) => updateCaseInfo('hearing_date', e.target.value)}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., January 15, 2025"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Hearing Time
                    </label>
                    <input
                      type="text"
                      value={caseInfo.hearing_time || ''}
                      onChange={(e) => updateCaseInfo('hearing_time', e.target.value)}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., 10:00 a.m."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Courtroom
                    </label>
                    <input
                      type="text"
                      value={caseInfo.courtroom || ''}
                      onChange={(e) => updateCaseInfo('courtroom', e.target.value)}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Courtroom 10A"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Signing Attorney */}
          {signingAttorney && (
            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
              <div className="px-4 py-3 border-b border-primary-200 dark:border-primary-800">
                <h2 className="text-lg font-semibold text-text">Signing Attorney</h2>
                <p className="text-sm text-text-muted">Auto-populated from your profile</p>
              </div>

              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary-100 dark:bg-primary-800 rounded-full">
                    <User className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-text">{signingAttorney.name}</p>
                    {signingAttorney.bar_number && (
                      <p className="text-sm text-text-muted">Bar Number: {signingAttorney.bar_number}</p>
                    )}
                    <p className="text-sm text-text-muted">{signingAttorney.email}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageContent>
    </>
  );
}
