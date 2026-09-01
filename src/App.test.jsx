// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'

const CASE_NAME = 'RAE E2E VALIDATION — 14 STAGES'

const readinessReport = {
  stageSummary: 'Advisory analysis of the submitted learning evidence.',
  progressionAnalysis: {
    initialReasoning: 'An initial attempt was recorded.',
    finalReasoning: 'A revised submission was recorded.',
    demonstratedImprovement: 'The student documented learning and revision.',
  },
  indicatorAssessment: [],
  evidenceAssessment: { strengths: ['Reflection recorded'], missingEvidence: [], unsupportedAssumptions: [] },
  remainingWork: [],
  supervisorAttention: [],
  suggestedSupervisorQuestions: [],
  readinessForReview: 'ready_for_supervisor_review',
  advisoryStatement: 'The AI report is advisory only. The supervisor retains sole authority.',
}

function successfulAiResponse() {
  return Promise.resolve({ ok: true, json: async () => readinessReport })
}

async function createCase(user) {
  await user.click(screen.getByRole('button', { name: '+ New case' }))
  await user.type(screen.getByPlaceholderText('Student name or research topic'), CASE_NAME)
  await user.click(screen.getByRole('button', { name: 'Start pathway' }))
}

async function completeStudentSubmission(user, stageNumber) {
  await user.type(screen.getByPlaceholderText('Write your own reasoning before using AI...'), `Stage ${stageNumber} initial reasoning`)
  await user.click(screen.getByRole('button', { name: 'Submit initial attempt' }))
  await user.type(screen.getByPlaceholderText('Explain what changed in your understanding...'), `Stage ${stageNumber} learning reflection`)
  await user.type(screen.getByPlaceholderText('Write your improved final submission...'), `Stage ${stageNumber} final submission`)
  await user.type(screen.getByPlaceholderText('Note the coaching questions, prompts or feedback you used...'), `Stage ${stageNumber} AI coaching evidence`)
  await user.type(screen.getByPlaceholderText('DOI, PMID, URL, citation, dataset, source description...'), `Stage ${stageNumber} evidence source`)
  await user.click(screen.getByRole('button', { name: 'Submit for supervisor review' }))
  await screen.findByText(`Stage ${stageNumber} Competency Review`)
}

async function approveCurrentStage(user) {
  const indicatorSection = screen.getByRole('heading', { name: 'Competency indicators' }).parentElement
  const boxes = within(indicatorSection).getAllByRole('checkbox')
  const approve = screen.getByRole('button', { name: 'Approve competency' })
  expect(approve).toBeDisabled()
  for (const box of boxes) await user.click(box)
  expect(approve).toBeEnabled()
  await user.click(approve)
}

describe('RAE functional competency pathway', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(successfulAiResponse))
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('progresses through all 14 stages only after human competency approval', async () => {
    const user = userEvent.setup()
    render(<App />)
    await createCase(user)

    expect(screen.getAllByText('Locked until previous competency is approved')).toHaveLength(13)

    for (let stage = 1; stage <= 14; stage += 1) {
      expect(screen.getByText(`STAGE ${stage} OF 14`)).toBeInTheDocument()
      await completeStudentSubmission(user, stage)
      expect(screen.getByText(/Only the supervisor approves progression\./)).toBeInTheDocument()
      expect(screen.queryByText(`STAGE ${stage + 1} OF 14`)).not.toBeInTheDocument()
      await approveCurrentStage(user)
    }

    expect(await screen.findByText('14 / 14 competencies approved')).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem('rae_cases'))
    expect(saved).toHaveLength(1)
    expect(saved[0].stages).toHaveLength(14)
    expect(saved[0].stages.every((stage) => stage.approved)).toBe(true)
    expect(saved[0].currentStage).toBe(14)
    expect(saved[0].status).toBe('Completed')
  }, 60000)

  it('preserves a submission and AI report across reload', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await createCase(user)
    await completeStudentSubmission(user, 1)
    expect(screen.getByText('Ready')).toBeInTheDocument()
    first.unmount()

    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Supervisor' }))
    expect(await screen.findByText('Stage 1 Competency Review')).toBeInTheDocument()
    expect(screen.queryByText('No submission waiting')).not.toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })

  it('keeps submission visible after AI failure and supports retry', async () => {
    const user = userEvent.setup()
    fetch.mockRejectedValueOnce(new Error('simulated API outage'))
    render(<App />)
    await createCase(user)
    await completeStudentSubmission(user, 1)
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.queryByText('No submission waiting')).not.toBeInTheDocument()

    fetch.mockImplementationOnce(successfulAiResponse)
    await user.click(screen.getByRole('button', { name: 'Retry AI Report' }))
    await waitFor(() => expect(screen.getByText('Ready')).toBeInTheDocument())
    const saved = JSON.parse(localStorage.getItem('rae_cases'))[0]
    expect(saved.stages[0].submittedToSupervisor).toBe(true)
  })

  it('rejects incomplete work and returns a reviewed stage for revision without unlocking the next stage', async () => {
    const user = userEvent.setup()
    render(<App />)
    await createCase(user)

    await user.click(screen.getByRole('button', { name: 'Submit initial attempt' }))
    expect(window.alert).toHaveBeenCalledWith('Write your own initial attempt first.')
    expect(screen.getAllByText('Locked until previous competency is approved')).toHaveLength(13)

    await user.type(screen.getByPlaceholderText('Write your own reasoning before using AI...'), 'Initial reasoning')
    await user.click(screen.getByRole('button', { name: 'Submit initial attempt' }))
    await user.click(screen.getByRole('button', { name: 'Submit for supervisor review' }))
    expect(window.alert).toHaveBeenCalledWith('Complete “What did you learn?” first.')

    await user.type(screen.getByPlaceholderText('Explain what changed in your understanding...'), 'Learning reflection')
    await user.click(screen.getByRole('button', { name: 'Submit for supervisor review' }))
    expect(window.alert).toHaveBeenCalledWith('Complete your final submission first.')

    await user.type(screen.getByPlaceholderText('Write your improved final submission...'), 'Final submission')
    await user.click(screen.getByRole('button', { name: 'Submit for supervisor review' }))
    await screen.findByText('Stage 1 Competency Review')
    const firstReview = screen.getByRole('heading', { name: 'Competency indicators' }).parentElement
    for (const box of within(firstReview).getAllByRole('checkbox')) await user.click(box)
    await user.type(screen.getByPlaceholderText('Feedback or revision guidance...'), 'Revise the evidence and resubmit.')
    await user.click(screen.getByRole('button', { name: 'Return for revision' }))

    expect(screen.getByText('STAGE 1 OF 14')).toBeInTheDocument()
    expect(screen.getAllByText('Locked until previous competency is approved')).toHaveLength(13)
    const saved = JSON.parse(localStorage.getItem('rae_cases'))[0]
    expect(saved.stages[0].submittedToSupervisor).toBe(false)
    expect(saved.stages[0].approved).toBe(false)
    expect(saved.currentStage).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Submit for supervisor review' }))
    await screen.findByText('Stage 1 Competency Review')
    const secondReview = screen.getByRole('heading', { name: 'Competency indicators' }).parentElement
    expect(within(secondReview).getAllByRole('checkbox').every((box) => !box.checked)).toBe(true)
    expect(screen.getByRole('button', { name: 'Approve competency' })).toBeDisabled()
  })
})
