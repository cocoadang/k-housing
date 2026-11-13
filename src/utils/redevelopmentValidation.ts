/**
 * Phase 8A: Redevelopment Validation Layer
 * 
 * Strict Pure Validation Rules:
 * 1. Lineage Graph Integrity (no empty predecessors/successors, no duplicates, no self-cycle)
 * 2. Cross-Complex Area Ownership Validation (AreaFamily must belong to specified complex)
 * 3. Mapping Status & Type consistency (supports UNKNOWN, 1:N)
 * 4. Contribution vs Construction Cost separation
 * 5. Source hierarchy & Confidence consistency
 * 6. NO automatic similarity inference functions
 */

import {
  RedevelopmentLineage,
  RedevelopmentProject,
  RedevelopmentAreaMapping,
  RedevelopmentCostHistory,
  RedevelopmentConstructionCostHistory,
  RedevelopmentSourceMetadata,
  RedevelopmentSourceType,
  RedevelopmentConfidence,
} from '../types/redevelopment';
import { AREA_FAMILIES_REGISTRY } from '../data/areaFamilies';

export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function createResult(issues: ValidationIssue[]): ValidationResult {
  const errors = issues.filter((i) => i.severity === 'ERROR');
  const warnings = issues.filter((i) => i.severity === 'WARNING');
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// =========================================================================
// 1. Lineage Validation
// =========================================================================

export function validateRedevelopmentLineage(
  lineage: Partial<RedevelopmentLineage>,
  knownComplexIds?: string[]
): ValidationResult {
  const issues: ValidationIssue[] = [];

  const lineageId = lineage.lineageId || lineage.id;
  if (!lineageId || typeof lineageId !== 'string' || lineageId.trim() === '') {
    issues.push({
      field: 'lineageId',
      code: 'LINEAGE_ID_REQUIRED',
      message: 'lineageId is required and must be a non-empty string',
      severity: 'ERROR',
    });
  }

  const lineageName = lineage.lineageName || lineage.name;
  if (!lineageName || typeof lineageName !== 'string' || lineageName.trim() === '') {
    issues.push({
      field: 'lineageName',
      code: 'LINEAGE_NAME_REQUIRED',
      message: 'lineageName is required and must be a non-empty string',
      severity: 'ERROR',
    });
  }

  const predecessors = lineage.predecessorComplexIds;
  if (!Array.isArray(predecessors) || predecessors.length === 0) {
    issues.push({
      field: 'predecessorComplexIds',
      code: 'PREDECESSORS_REQUIRED',
      message: 'predecessorComplexIds must contain at least one predecessor complex ID',
      severity: 'ERROR',
    });
  }

  const successors = lineage.successorComplexIds;
  if (!Array.isArray(successors) || successors.length === 0) {
    issues.push({
      field: 'successorComplexIds',
      code: 'SUCCESSORS_REQUIRED',
      message: 'successorComplexIds must contain at least one successor complex ID',
      severity: 'ERROR',
    });
  }

  if (Array.isArray(predecessors) && Array.isArray(successors)) {
    // 1. Check duplicate predecessors
    const predSet = new Set<string>();
    for (const p of predecessors) {
      if (predSet.has(p)) {
        issues.push({
          field: 'predecessorComplexIds',
          code: 'DUPLICATE_PREDECESSOR',
          message: `Duplicate predecessor complex ID found: ${p}`,
          severity: 'ERROR',
        });
      }
      predSet.add(p);
    }

    // 2. Check duplicate successors
    const succSet = new Set<string>();
    for (const s of successors) {
      if (succSet.has(s)) {
        issues.push({
          field: 'successorComplexIds',
          code: 'DUPLICATE_SUCCESSOR',
          message: `Duplicate successor complex ID found: ${s}`,
          severity: 'ERROR',
        });
      }
      succSet.add(s);
    }

    // 3. Self-cycle check: predecessor == successor
    for (const p of predecessors) {
      if (succSet.has(p)) {
        issues.push({
          field: 'lineage',
          code: 'SELF_CYCLE_PREDECESSOR_EQUALS_SUCCESSOR',
          message: `Complex ID cannot be both predecessor and successor: ${p}`,
          severity: 'ERROR',
        });
      }
    }

    // 4. Known complexes check if provided
    if (knownComplexIds && knownComplexIds.length > 0) {
      const knownSet = new Set(knownComplexIds);
      for (const p of predecessors) {
        if (!knownSet.has(p)) {
          issues.push({
            field: 'predecessorComplexIds',
            code: 'UNKNOWN_PREDECESSOR_COMPLEX',
            message: `Predecessor complex ID not found in registry: ${p}`,
            severity: 'ERROR',
          });
        }
      }
      for (const s of successors) {
        if (!knownSet.has(s)) {
          issues.push({
            field: 'successorComplexIds',
            code: 'UNKNOWN_SUCCESSOR_COMPLEX',
            message: `Successor complex ID not found in registry: ${s}`,
            severity: 'ERROR',
          });
        }
      }
    }
  }

  return createResult(issues);
}

// =========================================================================
// 2. Project Validation
// =========================================================================

export function validateRedevelopmentProject(
  project: Partial<RedevelopmentProject>
): ValidationResult {
  const issues: ValidationIssue[] = [];

  const projectId = project.projectId || project.id;
  if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
    issues.push({
      field: 'projectId',
      code: 'PROJECT_ID_REQUIRED',
      message: 'projectId is required and must be a non-empty string',
      severity: 'ERROR',
    });
  }

  if (!project.lineageId || typeof project.lineageId !== 'string' || project.lineageId.trim() === '') {
    issues.push({
      field: 'lineageId',
      code: 'LINEAGE_ID_REQUIRED',
      message: 'lineageId is required for RedevelopmentProject',
      severity: 'ERROR',
    });
  }

  if (!project.projectName || typeof project.projectName !== 'string' || project.projectName.trim() === '') {
    issues.push({
      field: 'projectName',
      code: 'PROJECT_NAME_REQUIRED',
      message: 'projectName is required',
      severity: 'ERROR',
    });
  }

  if (project.projectType && !['RECONSTRUCTION', 'REDEVELOPMENT', 'URBAN_PUBLIC_HOUSING_COMPLEX'].includes(project.projectType)) {
    issues.push({
      field: 'projectType',
      code: 'INVALID_PROJECT_TYPE',
      message: `Invalid projectType: ${project.projectType}. Allowed: RECONSTRUCTION, REDEVELOPMENT, URBAN_PUBLIC_HOUSING_COMPLEX`,
      severity: 'ERROR',
    });
  }

  return createResult(issues);
}

// =========================================================================
// 3. Area Mapping Validation (with Cross-Complex Area Check)
// =========================================================================

export function validateRedevelopmentAreaMapping(
  mapping: Partial<RedevelopmentAreaMapping>,
  registry: Record<string, Array<{ id: string; complexId: string }>> = AREA_FAMILIES_REGISTRY
): ValidationResult {
  const issues: ValidationIssue[] = [];

  const mappingId = mapping.mappingId || mapping.id;
  if (!mappingId || typeof mappingId !== 'string' || mappingId.trim() === '') {
    issues.push({
      field: 'mappingId',
      code: 'MAPPING_ID_REQUIRED',
      message: 'mappingId is required and must be non-empty',
      severity: 'ERROR',
    });
  }

  if (!mapping.lineageId || typeof mapping.lineageId !== 'string') {
    issues.push({
      field: 'lineageId',
      code: 'LINEAGE_ID_REQUIRED',
      message: 'lineageId is required for AreaMapping',
      severity: 'ERROR',
    });
  }

  // Predecessor Complex & AreaFamily
  if (!mapping.predecessorComplexId) {
    issues.push({
      field: 'predecessorComplexId',
      code: 'PREDECESSOR_COMPLEX_REQUIRED',
      message: 'predecessorComplexId is required',
      severity: 'ERROR',
    });
  }

  if (!mapping.predecessorAreaFamilyId) {
    issues.push({
      field: 'predecessorAreaFamilyId',
      code: 'PREDECESSOR_FAMILY_REQUIRED',
      message: 'predecessorAreaFamilyId is required',
      severity: 'ERROR',
    });
  }

  // Successor Complex & AreaFamily
  if (!mapping.successorComplexId) {
    issues.push({
      field: 'successorComplexId',
      code: 'SUCCESSOR_COMPLEX_REQUIRED',
      message: 'successorComplexId is required',
      severity: 'ERROR',
    });
  }

  if (!mapping.successorAreaFamilyId) {
    issues.push({
      field: 'successorAreaFamilyId',
      code: 'SUCCESSOR_FAMILY_REQUIRED',
      message: 'successorAreaFamilyId is required',
      severity: 'ERROR',
    });
  }

  // CROSS-COMPLEX AREA OWNERSHIP VALIDATION
  if (mapping.predecessorComplexId && mapping.predecessorAreaFamilyId) {
    const predFamilies = registry[mapping.predecessorComplexId] || [];
    const predExists = predFamilies.some((f) => f.id === mapping.predecessorAreaFamilyId);
    if (!predExists) {
      issues.push({
        field: 'predecessorAreaFamilyId',
        code: 'CROSS_COMPLEX_AREA_MISMATCH',
        message: `AreaFamily '${mapping.predecessorAreaFamilyId}' does not belong to predecessor complex '${mapping.predecessorComplexId}'`,
        severity: 'ERROR',
      });
    }
  }

  if (mapping.successorComplexId && mapping.successorAreaFamilyId) {
    const succFamilies = registry[mapping.successorComplexId] || [];
    const succExists = succFamilies.some((f) => f.id === mapping.successorAreaFamilyId);
    if (!succExists) {
      issues.push({
        field: 'successorAreaFamilyId',
        code: 'CROSS_COMPLEX_AREA_MISMATCH',
        message: `AreaFamily '${mapping.successorAreaFamilyId}' does not belong to successor complex '${mapping.successorComplexId}'`,
        severity: 'ERROR',
      });
    }
  }

  // Mapping status validation
  if (mapping.mappingStatus && !['VERIFIED', 'PARTIAL', 'UNKNOWN'].includes(mapping.mappingStatus)) {
    issues.push({
      field: 'mappingStatus',
      code: 'INVALID_MAPPING_STATUS',
      message: `Invalid mappingStatus: ${mapping.mappingStatus}. Allowed: VERIFIED, PARTIAL, UNKNOWN`,
      severity: 'ERROR',
    });
  }

  return createResult(issues);
}

// =========================================================================
// 4. Contribution Validation
// =========================================================================

export function validateRedevelopmentCostHistory(
  cost: Partial<RedevelopmentCostHistory>,
  registry: Record<string, Array<{ id: string; complexId: string }>> = AREA_FAMILIES_REGISTRY
): ValidationResult {
  const issues: ValidationIssue[] = [];

  const costId = cost.costHistoryId || cost.id;
  if (!costId || typeof costId !== 'string') {
    issues.push({
      field: 'costHistoryId',
      code: 'COST_HISTORY_ID_REQUIRED',
      message: 'costHistoryId is required',
      severity: 'ERROR',
    });
  }

  if (!cost.lineageId) {
    issues.push({
      field: 'lineageId',
      code: 'LINEAGE_ID_REQUIRED',
      message: 'lineageId is required for cost record',
      severity: 'ERROR',
    });
  }

  // Ownership checks if complex + areaFamily provided
  if (cost.predecessorComplexId && cost.predecessorAreaFamilyId) {
    const families = registry[cost.predecessorComplexId] || [];
    if (!families.some((f) => f.id === cost.predecessorAreaFamilyId)) {
      issues.push({
        field: 'predecessorAreaFamilyId',
        code: 'CROSS_COMPLEX_AREA_MISMATCH',
        message: `Predecessor areaFamily '${cost.predecessorAreaFamilyId}' does not belong to '${cost.predecessorComplexId}'`,
        severity: 'ERROR',
      });
    }
  }

  if (cost.successorComplexId && cost.successorAreaFamilyId) {
    const families = registry[cost.successorComplexId] || [];
    if (!families.some((f) => f.id === cost.successorAreaFamilyId)) {
      issues.push({
        field: 'successorAreaFamilyId',
        code: 'CROSS_COMPLEX_AREA_MISMATCH',
        message: `Successor areaFamily '${cost.successorAreaFamilyId}' does not belong to '${cost.successorComplexId}'`,
        severity: 'ERROR',
      });
    }
  }

  if (cost.status && !['ESTIMATED', 'MANAGEMENT_DISPOSITION', 'REVISED', 'FINAL'].includes(cost.status)) {
    issues.push({
      field: 'status',
      code: 'INVALID_COST_STATUS',
      message: `Invalid cost status: ${cost.status}`,
      severity: 'ERROR',
    });
  }

  return createResult(issues);
}

// =========================================================================
// 5. Construction Cost Validation
// =========================================================================

export function validateRedevelopmentConstructionCostHistory(
  cost: Partial<RedevelopmentConstructionCostHistory>
): ValidationResult {
  const issues: ValidationIssue[] = [];

  const costId = cost.constructionCostHistoryId || cost.id;
  if (!costId || typeof costId !== 'string') {
    issues.push({
      field: 'constructionCostHistoryId',
      code: 'CONSTRUCTION_COST_ID_REQUIRED',
      message: 'constructionCostHistoryId is required',
      severity: 'ERROR',
    });
  }

  if (!cost.projectId) {
    issues.push({
      field: 'projectId',
      code: 'PROJECT_ID_REQUIRED',
      message: 'projectId is required',
      severity: 'ERROR',
    });
  }

  if (typeof cost.amount !== 'number' || isNaN(cost.amount) || cost.amount <= 0) {
    issues.push({
      field: 'amount',
      code: 'AMOUNT_POSITIVE_REQUIRED',
      message: 'Construction cost amount must be a positive number',
      severity: 'ERROR',
    });
  }

  if (!cost.unit || !['KRW_MANWON', 'KRW_EOK', 'KRW_WON'].includes(cost.unit)) {
    issues.push({
      field: 'unit',
      code: 'INVALID_UNIT',
      message: `Invalid unit: ${cost.unit}`,
      severity: 'ERROR',
    });
  }

  if (!cost.costBasis || !['TOTAL_PROJECT', 'PER_PYEONG', 'PER_SQM'].includes(cost.costBasis)) {
    issues.push({
      field: 'costBasis',
      code: 'INVALID_COST_BASIS',
      message: `Invalid costBasis: ${cost.costBasis}`,
      severity: 'ERROR',
    });
  }

  return createResult(issues);
}

// =========================================================================
// 6. Source Metadata Validation
// =========================================================================

export const VALID_SOURCE_TYPES: RedevelopmentSourceType[] = [
  'OFFICIAL_DOCUMENT',
  'STATUTORY_PLAN',
  'BUILDER_OFFICIAL',
  'REPUTABLE_MEDIA',
  'SECONDARY_RESEARCH',
];

export const VALID_CONFIDENCES: RedevelopmentConfidence[] = [
  'VERIFIED',
  'HIGH',
  'MEDIUM',
  'LOW',
  'UNKNOWN',
];

export function validateRedevelopmentSourceMetadata(
  meta: Partial<RedevelopmentSourceMetadata>
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!meta.sourceType || !VALID_SOURCE_TYPES.includes(meta.sourceType)) {
    issues.push({
      field: 'sourceType',
      code: 'INVALID_SOURCE_TYPE',
      message: `Invalid sourceType: ${meta.sourceType}. Must be one of: ${VALID_SOURCE_TYPES.join(', ')}`,
      severity: 'ERROR',
    });
  }

  if (!meta.sourceName || typeof meta.sourceName !== 'string' || meta.sourceName.trim() === '') {
    issues.push({
      field: 'sourceName',
      code: 'SOURCE_NAME_REQUIRED',
      message: 'sourceName is required',
      severity: 'ERROR',
    });
  }

  if (!meta.confidence || !VALID_CONFIDENCES.includes(meta.confidence)) {
    issues.push({
      field: 'confidence',
      code: 'INVALID_CONFIDENCE',
      message: `Invalid confidence: ${meta.confidence}. Must be one of: ${VALID_CONFIDENCES.join(', ')}`,
      severity: 'ERROR',
    });
  }

  return createResult(issues);
}
