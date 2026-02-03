import { getAuthToken } from '../context/AuthContext';

export async function exportCaseListPdf(): Promise<void> {
  const token = getAuthToken();
  const response = await fetch('/api/v1/export?format=pdf', {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error('Export failed');
  }

  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = 'galipo_cases.pdf';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+)"/);
    if (match) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
