import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import OpenAI from 'openai'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendDistPath = path.resolve(__dirname, '../dist')

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.post('/api/readiness-report', async (req, res) => {
  try {
    const {
      caseId,
      studentName,
      researchTopic,
      stageNumber,
      stageTitle,
      stageObjective,
      supervisorGuide,
      competencyIndicators,
      initialAttempt,
      studentReflection,
      finalSubmission,
      evidence,
    } = req.body || {}

    if (!stageTitle || !stageObjective || !competencyIndicators) {
      return res.status(400).json({ error: 'Missing required fields for readiness report.' })
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: 'AI service is not configured.',
        report: {
          stageSummary: 'AI service is not configured.',
          progressionAnalysis: {
            initialReasoning: 'AI report could not be generated because the server is missing OPENAI_API_KEY.',
            finalReasoning: 'AI report could not be generated because the server is missing OPENAI_API_KEY.',
            demonstratedImprovement: 'Unavailable.',
          },
          indicatorAssessment: (competencyIndicators || []).map((indicator) => ({
            indicator: indicator.label || indicator,
            status: 'insufficient_evidence',
            supportingEvidence: 'AI service is not configured.',
            remainingGap: 'Install OPENAI_API_KEY to generate a real report.',
          })),
          evidenceAssessment: {
            strengths: [],
            missingEvidence: ['AI service is not configured.'],
            unsupportedAssumptions: [],
          },
          remainingWork: ['Configure the OpenAI API key.'],
          supervisorAttention: ['AI service is not configured.'],
          suggestedSupervisorQuestions: ['How would you like the supervisor to proceed?'],
          readinessForReview: 'insufficient_submission',
          advisoryStatement: 'The AI report is advisory only. The supervisor retains sole authority to determine competency and progression.',
        },
      })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const indicatorList = (competencyIndicators || [])
      .map((indicator, index) => `${index + 1}. ${indicator.label || indicator}`)
      .join('\n')

    const evidenceSummary = JSON.stringify(evidence || {}, null, 2)

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'You are an advisory research competency reviewer. Evaluate the student work against the supplied competency indicators. You do NOT have authority to determine competency. You must not say Pass, Fail, Approved, Rejected, Competent, or Not competent. The supervisor retains sole authority for progression. Base your analysis only on the supplied student work, evidence, stage objective, supervisor guide, and indicators. If evidence is missing, explicitly say it is missing. Do not invent references, data, facts, or student activity.',
        },
        {
          role: 'user',
          content: `Case ID: ${caseId || 'unknown'}\nStudent: ${studentName || 'not provided'}\nResearch topic: ${researchTopic || 'not provided'}\nStage number: ${stageNumber || 'unknown'}\nStage title: ${stageTitle}\nStage objective: ${stageObjective}\n\nSupervisor guide:\n${JSON.stringify(supervisorGuide || {}, null, 2)}\n\nCompetency indicators:\n${indicatorList}\n\nInitial attempt:\n${initialAttempt || 'No initial attempt provided.'}\n\nStudent reflection:\n${studentReflection || 'No reflection provided.'}\n\nFinal submission:\n${finalSubmission || 'No final submission provided.'}\n\nEvidence:\n${evidenceSummary}`,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'readiness_report',
          schema: {
            type: 'object',
            properties: {
              stageSummary: { type: 'string' },
              progressionAnalysis: {
                type: 'object',
                properties: {
                  initialReasoning: { type: 'string' },
                  finalReasoning: { type: 'string' },
                  demonstratedImprovement: { type: 'string' },
                },
                required: ['initialReasoning', 'finalReasoning', 'demonstratedImprovement'],
              },
              indicatorAssessment: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    indicator: { type: 'string' },
                    status: {
                      type: 'string',
                      enum: ['evidence_present', 'partial_evidence', 'insufficient_evidence'],
                    },
                    supportingEvidence: { type: 'string' },
                    remainingGap: { type: 'string' },
                  },
                  required: ['indicator', 'status', 'supportingEvidence', 'remainingGap'],
                },
              },
              evidenceAssessment: {
                type: 'object',
                properties: {
                  strengths: { type: 'array', 'items': { type: 'string' } },
                  missingEvidence: { type: 'array', 'items': { type: 'string' } },
                  unsupportedAssumptions: { type: 'array', 'items': { type: 'string' } },
                },
                required: ['strengths', 'missingEvidence', 'unsupportedAssumptions'],
              },
              remainingWork: { type: 'array', items: { type: 'string' } },
              supervisorAttention: { type: 'array', items: { type: 'string' } },
              suggestedSupervisorQuestions: { type: 'array', items: { type: 'string' } },
              readinessForReview: {
                type: 'string',
                enum: ['ready_for_supervisor_review', 'review_with_attention', 'insufficient_submission'],
              },
              advisoryStatement: { type: 'string' },
            },
            required: [
              'stageSummary',
              'progressionAnalysis',
              'indicatorAssessment',
              'evidenceAssessment',
              'remainingWork',
              'supervisorAttention',
              'suggestedSupervisorQuestions',
              'readinessForReview',
              'advisoryStatement',
            ],
          },
          strict: true,
        },
      },
    })

    const responseText = response.output_text || '{}'
    const report = JSON.parse(responseText)

    return res.json(report)
  } catch (error) {
    console.error('readiness report error', error)
    return res.status(500).json({ error: 'AI report generation failed.' })
  }
})

app.use(express.static(frontendDistPath))

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`RAE server listening on port ${PORT}`)
})
