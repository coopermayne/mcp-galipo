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

// Proceeding Judges API

export async function getProceedingJudges(
  proceedingId: number
): Promise<{ judges: ProceedingJudge[]; total: number }> {
  return request(`/proceedings/${proceedingId}/judges`);
}

export async function addProceedingJudge(
  proceedingId: number,
  data: AddProceedingJudgeInput
): Promise<{ success: boolean; judge: ProceedingJudge }> {
  return request(`/proceedings/${proceedingId}/judges`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProceedingJudge(
  proceedingId: number,
  personId: number,
  data: UpdateProceedingJudgeInput
): Promise<{ success: boolean; judge: ProceedingJudge }> {
  return request(`/proceedings/${proceedingId}/judges/${personId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function removeProceedingJudge(
  proceedingId: number,
  personId: number
): Promise<{ success: boolean }> {
  return request(`/proceedings/${proceedingId}/judges/${personId}`, {
    method: 'DELETE',
  });
}
