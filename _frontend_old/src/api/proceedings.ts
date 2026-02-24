import type {
  Proceeding,
  CreateProceedingInput,
  UpdateProceedingInput,
  ProceedingJudge,
  AddProceedingJudgeInput,
  UpdateProceedingJudgeInput,
} from '../types/proceeding';
import { request } from './common';

export async function getProceedings(caseId: number): Promise<{ proceedings: Proceeding[]; total: number }> {
  return request(`/cases/${caseId}/proceedings`);
}

export async function getProceeding(proceedingId: number): Promise<Proceeding> {
  return request(`/proceedings/${proceedingId}`);
}

export async function createProceeding(
  caseId: number,
  data: CreateProceedingInput
): Promise<{ success: boolean; proceeding: Proceeding }> {
  return request(`/cases/${caseId}/proceedings`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProceeding(
  proceedingId: number,
  data: UpdateProceedingInput
): Promise<{ success: boolean; proceeding: Proceeding }> {
  return request(`/proceedings/${proceedingId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProceeding(proceedingId: number): Promise<{ success: boolean }> {
  return request(`/proceedings/${proceedingId}`, {
    method: 'DELETE',
  });
}

// Proceeding Judges API (now uses standalone judges table)

export async function getProceedingJudges(
  proceedingId: number
): Promise<{ success: boolean; judges: ProceedingJudge[] }> {
  return request(`/proceedings/${proceedingId}/judges`);
}

export async function addProceedingJudge(
  proceedingId: number,
  data: AddProceedingJudgeInput
): Promise<{ success: boolean; proceeding_judge: ProceedingJudge }> {
  return request(`/proceedings/${proceedingId}/judges`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProceedingJudge(
  proceedingId: number,
  judgeId: number,
  data: UpdateProceedingJudgeInput
): Promise<{ success: boolean; proceeding_judge: ProceedingJudge }> {
  return request(`/proceedings/${proceedingId}/judges/${judgeId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function removeProceedingJudge(
  proceedingId: number,
  judgeId: number
): Promise<{ success: boolean }> {
  return request(`/proceedings/${proceedingId}/judges/${judgeId}`, {
    method: 'DELETE',
  });
}
