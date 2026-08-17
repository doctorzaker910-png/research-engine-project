const CASES_KEY = 'rae_cases'
const ACTIVE_CASE_KEY = 'rae_active_case_id'
const MIGRATION_DONE_KEY = 'rae_migration_v2'
const LEGACY_MIGRATION_COMPLETED_KEY = 'rae_legacy_migration_completed'

function readStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) {
      return fallback
    }

    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function makeTimestamp() {
  return new Date().toISOString()
}

function markLegacyMigrationCompleted() {
  localStorage.setItem(LEGACY_MIGRATION_COMPLETED_KEY, 'true')
  localStorage.setItem(MIGRATION_DONE_KEY, 'done')
}

function legacyMigrationCompleted() {
  return localStorage.getItem(LEGACY_MIGRATION_COMPLETED_KEY) === 'true' || localStorage.getItem(MIGRATION_DONE_KEY) === 'done'
}

function isImportedLegacyCase(item = {}) {
  return Boolean(
    item &&
      (item.isImportedLegacy || item.importSource === 'legacy' || item.id?.startsWith('case_imported_') || item.studentName === 'Imported Existing Project' || item.researchTopic === 'Imported Existing Project')
  )
}

function scoreLegacyCase(item = {}) {
  let score = 0

  if (item.studentName) score += 1
  if (item.researchTopic) score += 1

  ;(item.stages || []).forEach((stage) => {
    if (stage.initialAttempt) score += 3
    if (stage.aiLearningReflection) score += 2
    if (stage.revisedAnswer) score += 3
    if (stage.supervisorFeedback) score += 2
    if (stage.aiReadinessReport) score += 2
    if (stage.submittedToSupervisor) score += 2
    if (stage.approved) score += 4
    if (Array.isArray(stage.competencyIndicators)) {
      score += stage.competencyIndicators.filter((indicator) => indicator?.checked).length
    }
    if (Array.isArray(stage.evidence) && stage.evidence.length > 0) score += 1
  })

  return score
}

function dedupeImportedLegacyCases(cases = []) {
  const importedCases = cases.filter(isImportedLegacyCase)

  if (importedCases.length <= 1) {
    return cases.map((item) => {
      if (!isImportedLegacyCase(item)) {
        return item
      }

      return {
        ...item,
        isImportedLegacy: true,
        importSource: 'legacy',
      }
    })
  }

  const bestCase = importedCases.reduce((best, current) => {
    return scoreLegacyCase(current) > scoreLegacyCase(best) ? current : best
  }, importedCases[0])

  const dedupedCases = cases.filter((item) => !isImportedLegacyCase(item) || item.id === bestCase.id)
  const normalizedBestCase = {
    ...bestCase,
    isImportedLegacy: true,
    importSource: 'legacy',
  }

  return [normalizedBestCase, ...dedupedCases.filter((item) => item.id !== normalizedBestCase.id)]
}

function buildStageRecord(stage, index) {
  return {
    stageNumber: index + 1,
    stageName: stage.title,
    initialAttempt: '',
    attemptSubmitted: false,
    aiLearningReflection: '',
    revisedAnswer: '',
    evidence: [],
    competencyIndicators: (stage.indicators || []).map((label) => ({
      label,
      checked: false,
    })),
    submittedToSupervisor: false,
    submittedAt: '',
    supervisorDecision: '',
    supervisorFeedback: '',
    supervisorReviewedAt: '',
    aiReadinessReport: '',
    approved: false,
    approvedAt: '',
  }
}

export function createCase(studentName = '', researchTopic = '', stages = []) {
  const now = makeTimestamp()

  return {
    id: `case_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    studentName,
    researchTopic,
    createdAt: now,
    updatedAt: now,
    currentStage: 0,
    status: 'In Progress',
    stages: (stages || []).map((stage, index) => buildStageRecord(stage, index)),
    activityHistory: [
      {
        timestamp: now,
        action: 'Case created',
        stageNumber: null,
      },
    ],
  }
}

export function getCases() {
  return readStorage(CASES_KEY, [])
}

export function saveCases(cases) {
  writeStorage(CASES_KEY, cases)
}

export function getActiveCaseId() {
  return readStorage(ACTIVE_CASE_KEY, null)
}

export function setActiveCaseId(caseId) {
  if (caseId) {
    writeStorage(ACTIVE_CASE_KEY, caseId)
  } else {
    localStorage.removeItem(ACTIVE_CASE_KEY)
  }
}

export function getCase(caseId) {
  const cases = getCases()
  return cases.find((item) => item.id === caseId) || null
}

export function updateCase(caseId, updater) {
  const cases = getCases()
  const index = cases.findIndex((item) => item.id === caseId)

  if (index < 0) {
    return null
  }

  const nextCase =
    typeof updater === 'function'
      ? updater(cases[index])
      : {
          ...cases[index],
          ...updater,
        }

  if (!nextCase.updatedAt) {
    nextCase.updatedAt = makeTimestamp()
  }

  if (!nextCase.activityHistory) {
    nextCase.activityHistory = []
  }

  cases[index] = nextCase
  saveCases(cases)
  return nextCase
}

export function deleteCase(caseId) {
  const cases = getCases().filter((item) => item.id !== caseId)
  saveCases(cases)

  if (getActiveCaseId() === caseId) {
    setActiveCaseId(cases[0]?.id || null)
  }

  return cases
}

function readLegacyValue(keys = []) {
  for (const key of keys) {
    const value = localStorage.getItem(key)
    if (value !== null && value !== '') {
      return value
    }
  }

  return ''
}

function readLegacyJson(keys = []) {
  for (const key of keys) {
    const value = localStorage.getItem(key)
    if (value) {
      try {
        return JSON.parse(value)
      } catch {
        // ignore
      }
    }
  }

  return null
}

function toEvidenceRecords(oldRecord = {}) {
  const entries = []

  const addEntry = (title, type, referenceSource, notes) => {
    if (!title && !referenceSource && !notes) {
      return
    }

    entries.push({
      title,
      type,
      referenceSource,
      notes,
      dateAdded: new Date().toISOString(),
    })
  }

  addEntry('Initial attempt', 'student', '', oldRecord.attempt || '')
  addEntry('AI coaching', 'ai', '', oldRecord.evidence?.aiCoaching || '')
  addEntry('Reflection', 'reflection', '', oldRecord.learning || '')
  addEntry('Final submission', 'student', '', oldRecord.finalAnswer || '')
  addEntry('References', 'reference', oldRecord.evidence?.references || '', oldRecord.evidence?.notes || '')

  return entries
}

export function migrateLegacyData(stages = []) {
  const existingCases = dedupeImportedLegacyCases(getCases())
  saveCases(existingCases)

  const importedLegacyCase = existingCases.find(isImportedLegacyCase) || null
  if (legacyMigrationCompleted()) {
    return importedLegacyCase
  }

  if (existingCases.length > 0 && !importedLegacyCase) {
    markLegacyMigrationCompleted()
    return null
  }

  const projectValue = readLegacyValue([
    'rae_project_v2',
    'rae_project',
    'rae_topic',
    'rae_studentName',
  ])

  const legacyRecords = readLegacyJson([
    'rae_stage_records_v2',
    'rae_stage_records',
  ]) || {}

  const hasLegacyData = Boolean(projectValue || Object.keys(legacyRecords).length > 0)
  if (!hasLegacyData) {
    markLegacyMigrationCompleted()
    return importedLegacyCase
  }

  if (importedLegacyCase) {
    markLegacyMigrationCompleted()
    return importedLegacyCase
  }

  const importedStages = (stages || []).map((stage, index) => {
    const oldRecord = legacyRecords[index] || legacyRecords[String(index)] || {}

    return {
      stageNumber: index + 1,
      stageName: stage.title,
      initialAttempt: oldRecord.attempt || '',
      attemptSubmitted: Boolean(oldRecord.attemptSubmitted || oldRecord.submitted),
      aiLearningReflection: oldRecord.learning || '',
      revisedAnswer: oldRecord.finalAnswer || '',
      evidence: toEvidenceRecords(oldRecord),
      competencyIndicators: (stage.indicators || []).map((label, indicatorIndex) => ({
        label,
        checked: Boolean(oldRecord.checks?.[indicatorIndex]),
      })),
      submittedToSupervisor: Boolean(oldRecord.submitted || oldRecord.attemptSubmitted),
      submittedAt: oldRecord.submittedAt || '',
      supervisorDecision: oldRecord.reviewDecision || oldRecord.decision || '',
      supervisorFeedback: oldRecord.supervisorFeedback || oldRecord.feedback || '',
      supervisorReviewedAt: oldRecord.supervisorReviewedAt || '',
      aiReadinessReport: oldRecord.aiReadinessReport || '',
      approved: Boolean(oldRecord.approved),
      approvedAt: oldRecord.approvedAt || '',
    }
  })

  const importedCase = {
    id: `case_imported_${Date.now()}`,
    studentName: projectValue || 'Imported Existing Project',
    researchTopic: projectValue || 'Imported Existing Project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStage: Number(readLegacyValue(['rae_current_stage_v2', 'rae_currentStage'])) || 0,
    status: 'In Progress',
    stages: importedStages,
    activityHistory: [
      {
        timestamp: new Date().toISOString(),
        action: 'Imported Existing Project',
        stageNumber: null,
      },
    ],
    isImportedLegacy: true,
    importSource: 'legacy',
  }

  const nextCases = dedupeImportedLegacyCases([...existingCases, importedCase])
  saveCases(nextCases)
  setActiveCaseId(importedCase.id)
  markLegacyMigrationCompleted()
  return nextCases.find(isImportedLegacyCase) || importedCase
}
