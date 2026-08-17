import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  createCase,
  deleteCase,
  getActiveCaseId,
  getCases,
  migrateLegacyData,
  saveCases,
  setActiveCaseId,
  updateCase,
} from './storage'

const createEvidence = () => ({
  initialAttempt: '',
  aiCoaching: '',
  reflection: '',
  finalSubmission: '',
  references: '',
  notes: '',
})

const mergeEvidence = (existingEvidence = {}, incoming = {}) => ({
  ...createEvidence(),
  ...existingEvidence,
  ...incoming,
})

const buildAiReadinessPrompt = (stage, record, project, currentStage) => {
  const evidence = record.evidence || {}
  const indicatorList = stage.indicators
    .map((indicator, index) => {
      const checked = Array.isArray(record.checks) && record.checks[index]
      return `${index + 1}. ${indicator} (${checked ? 'checked' : 'not yet checked'})`
    })
    .join('\n')

  return `AI Readiness Report Prompt

Research topic/project: ${project || 'Not provided'}
Stage ${currentStage + 1}: ${stage.title}
Objective: ${stage.objective || 'Not provided'}

Student initial attempt:
${record.attempt || 'No initial attempt recorded.'}

Student reflection:
${record.learning || 'No reflection recorded.'}

Final submission:
${record.finalAnswer || 'No final submission recorded.'}

Evidence and references:
Initial student attempt: ${evidence.initialAttempt || 'No evidence entered.'}
AI coaching prompt/interactions: ${evidence.aiCoaching || 'No evidence entered.'}
Student reflection: ${evidence.reflection || 'No evidence entered.'}
Revised/final submission: ${evidence.finalSubmission || 'No evidence entered.'}
References/evidence used: ${evidence.references || 'No references entered.'}
Optional evidence notes: ${evidence.notes || 'No notes entered.'}

Competency indicators:
${indicatorList}

Please produce an AI report that:
1. Summarizes what the student completed at this stage.
2. Compares the initial attempt with the final reasoning and explains evidence of learning or progression.
3. Notes evidence relevant to each competency indicator.
4. Identifies missing or weak evidence.
5. Identifies unsupported assumptions.
6. Points out issues requiring supervisor attention.
7. Suggests questions the supervisor may ask.
8. Provides an overall readiness summary for supervisor review.

Do not state Pass, Fail, Approved, Competent or Not Competent. Do not make the competency decision.
The AI report is advisory only. The supervisor retains sole authority to determine competency and progression.`
}

const stages = [
  {
    title: 'Define the research problem',
    objective:
      'Clarify the problem your study will address and explain why it matters.',
    question:
      'What problem do you want to study, who does it affect, and why does it matter?',
    indicators: [
      'Problem is specific',
      'Population or context is clear',
      'Importance is justified',
      'Problem is researchable',
    ],
    supervisorGuide: {
      purpose:
        'Help the student define a focused problem statement that can be studied responsibly.',
      competency:
        'The student should be able to describe a clear problem, identify the affected group, and explain why the issue matters.',
      lookFor: [
        'A concrete issue rather than a broad topic',
        'An identifiable population or context',
        'A sensible rationale for importance',
        'A clear sense of whether the problem is answerable',
      ],
      commonProblems: [
        'The problem is too broad or vague',
        'The student describes a topic instead of a problem',
        'The importance is asserted without evidence',
      ],
      evidenceExpected: [
        'A concise problem statement',
        'A description of the affected group or setting',
        'A justification for relevance',
      ],
      example:
        'Educational example — not a model answer: A student may describe delayed follow-up for young adults with asthma and explain how it affects care continuity.',
    },
    commonPitfalls: [
      'Choosing a topic that is too broad',
      'Skipping the setting or population',
    ],
    evidenceRequirements: [
      'Problem statement',
      'Population or context',
      'Why the issue matters',
    ],
    example:
      'Educational example — not a model answer: A student explains that missed blood pressure follow-up is a practical problem in rural clinics.',
    aiPrompt: `Act as a research tutor, not an examiner.

I am learning how to define a research problem.

Do not write the final answer for me.

Read my initial attempt and:
1. Identify what is clear.
2. Identify what is vague or missing.
3. Ask about population, setting, importance and researchability.
4. Challenge unsupported assumptions.
5. Help me improve my reasoning.
6. Finish with a self-check checklist.

The supervisor, not AI, decides competency.`,
  },
  {
    title: 'Check feasibility',
    objective:
      'Judge whether the proposed study can be completed realistically.',
    question:
      'Can this study realistically be completed with the available population, data, time, resources and permissions?',
    indicators: [
      'Population or data source is accessible',
      'Timeline is realistic',
      'Resources are adequate',
      'Ethical and operational barriers are considered',
    ],
    supervisorGuide: {
      purpose:
        'Help the student judge whether the study is practical and ethically workable.',
      competency:
        'The student should identify realistic barriers and describe how they would manage them.',
      lookFor: [
        'Access to participants or data',
        'A believable timescale',
        'Awareness of ethics, permissions and resource constraints',
      ],
      commonProblems: [
        'Ignoring access problems',
        'Assuming feasibility without evidence',
      ],
      evidenceExpected: [
        'Practical constraints and likely risks',
        'Mitigation ideas',
      ],
      example:
        'Educational example — not a model answer: A student notes that recruiting patients from a specific clinic will require ethics approval and a limited recruitment window.',
    },
    commonPitfalls: [
      'Underestimating time or access barriers',
      'Ignoring ethics or permissions',
    ],
    evidenceRequirements: [
      'Access to participants or data',
      'Timeline and resources',
      'Ethical or operational barriers',
    ],
    example:
      'Educational example — not a model answer: The student explains that data access will be possible only after approval and that there is a six-week window for recruitment.',
    aiPrompt: `Act as a research feasibility tutor.

Do not decide feasibility for me.

Read my assessment and question me about:
population access,
sample availability,
data access,
time,
cost,
permissions,
ethics,
skills,
equipment,
and operational risks.

Challenge unrealistic assumptions.

Help me identify major risks and possible mitigation.

End with a feasibility checklist.`,
  },
  {
    title: 'Formulate the research question',
    objective:
      'Turn the problem into a precise and answerable research question.',
    question:
      'What exact question will this study answer?',
    indicators: [
      'Population is clearly defined',
      'Exposure, intervention or phenomenon is clear',
      'Outcome is clear',
      'Question is focused and answerable',
    ],
    supervisorGuide: {
      purpose:
        'Help the student sharpen a focused question that is specific enough for study.',
      competency:
        'The student should show that the question is precise, answerable and aligned with the problem.',
      lookFor: [
        'A clear population',
        'A clear exposure, intervention or phenomenon',
        'A measurable or observable outcome',
        'A question that is not too broad',
      ],
      commonProblems: [
        'The question is broad or multi-purpose',
        'The outcome is unclear',
      ],
      evidenceExpected: [
        'A draft and final research question',
        'A note on why it is focused',
      ],
      example:
        'Educational example — not a model answer: In a study of asthma care, the student narrows the question to whether text reminders improve follow-up attendance in young adults.',
    },
    commonPitfalls: [
      'Writing a topic rather than a question',
      'Including too many variables',
    ],
    evidenceRequirements: [
      'Population',
      'Exposure or intervention',
      'Outcome',
      'Focus and answerability',
    ],
    example:
      'Educational example — not a model answer: The question compares follow-up attendance between patients receiving reminders and those receiving usual care.',
    aiPrompt: `Act as a research-question tutor.

Do not create my final question for me.

Help me examine:
population,
exposure or intervention,
comparison when relevant,
outcome,
setting,
and timeframe.

Ask questions that force me to make the question precise.

Compare possible formulations only to teach me the trade-offs.

I must choose and justify the final research question.`,
  },
  {
    title: 'Search the literature',
    objective:
      'Plan and describe a systematic approach to finding relevant evidence.',
    question:
      'How will you systematically find the best available evidence related to your research question?',
    indicators: [
      'Main concepts are identified',
      'Keywords and synonyms are appropriate',
      'Databases are appropriate',
      'Search strategy is reproducible',
    ],
    supervisorGuide: {
      purpose:
        'Ensure the student can search for evidence in a structured and reproducible way.',
      competency:
        'The student should show that they understand the core concepts, search terms and sources needed to retrieve relevant literature.',
      lookFor: [
        'Concepts and synonyms',
        'Appropriate databases and filters',
        'A search strategy that another person could repeat',
      ],
      commonProblems: [
        'Very broad searches',
        'Missing synonyms or controlled vocabulary',
        'No explanation for the database choice',
      ],
      evidenceExpected: [
        'Search terms and rationale',
        'Database choices',
        'A reproducible search plan',
      ],
      example:
        'Educational example — not a model answer: A student lists terms such as asthma, adherence and reminders and explains why PubMed and Google Scholar are relevant.',
    },
    commonPitfalls: [
      'Using too few search terms',
      'Searching without a replicable strategy',
    ],
    evidenceRequirements: [
      'Main concepts',
      'Search terms or synonyms',
      'Database or source choices',
    ],
    example:
      'Educational example — not a model answer: The student explains that Boolean operators and filters help narrow a search to recent studies in the target population.',
    aiPrompt: `Act as a literature-search tutor.

Do not invent references.

Help me:
break my research question into concepts,
generate synonyms,
identify possible controlled vocabulary or MeSH terms,
use Boolean operators,
choose appropriate databases,
and construct a reproducible search strategy.

Ask me to explain why each search component is included.`,
  },
  {
    title: 'Critically appraise evidence',
    objective:
      'Judge whether selected studies are trustworthy and relevant.',
    question:
      'Which studies are trustworthy enough to inform this research, and why?',
    indicators: [
      'Study design is identified correctly',
      'Major bias risks are recognized',
      'Precision and relevance are considered',
      'Strengths and limitations are explained',
    ],
    supervisorGuide: {
      purpose:
        'Ensure the student can evaluate evidence quality rather than accept it uncritically.',
      competency:
        'The student should show that they can identify study design, major biases and the relevance of findings.',
      lookFor: [
        'Correct identification of design',
        'Attention to bias and confounding',
        'Reasoned discussion of strengths and limitations',
      ],
      commonProblems: [
        'Treating all studies as equally strong',
        'Ignoring methodological limitations',
      ],
      evidenceExpected: [
        'A brief appraisal of key studies',
        'Comments on strengths and weaknesses',
      ],
      example:
        'Educational example — not a model answer: A student notes that a cross-sectional study may be useful for prevalence but weak for establishing causation.',
    },
    commonPitfalls: [
      'Confusing relevance with quality',
      'Skipping bias assessment',
    ],
    evidenceRequirements: [
      'Study design',
      'Bias or confounding concerns',
      'Strengths and limitations',
    ],
    example:
      'Educational example — not a model answer: The student explains why a small observational study may be informative but not definitive.',
    aiPrompt: `Act as a critical-appraisal tutor.

Do not simply tell me whether a paper is good or bad.

Ask me to identify:
study design,
population,
sampling,
exposure or intervention,
outcomes,
bias,
confounding,
precision,
limitations,
and applicability.

Challenge my reasoning and give formative feedback.`,
  },
  {
    title: 'Map existing evidence',
    objective:
      'Organize what is known so the student can see patterns and disagreements.',
    question:
      'What does the existing evidence collectively show, and where do studies agree or disagree?',
    indicators: [
      'Studies are organized meaningfully',
      'Consistent findings are identified',
      'Contradictions are identified',
      'Remaining uncertainty is explicit',
    ],
    supervisorGuide: {
      purpose:
        'Help the student synthesize evidence rather than describe studies one by one.',
      competency:
        'The student should be able to group evidence, show agreement and disagreement, and explain what remains uncertain.',
      lookFor: [
        'A logical structure for the evidence',
        'Identification of agreement and disagreement',
        'Clear explanation of uncertainty',
      ],
      commonProblems: [
        'Purely descriptive summaries',
        'Missing contradictions',
      ],
      evidenceExpected: [
        'An evidence map or grouped summary',
        'Noted agreements and disagreements',
      ],
      example:
        'Educational example — not a model answer: A student groups studies by intervention type and notes that one set of studies finds improvement while another reports mixed results.',
    },
    commonPitfalls: [
      'Listing studies without synthesis',
      'Ignoring contradictory evidence',
    ],
    evidenceRequirements: [
      'Organized summary',
      'Agreement or disagreement',
      'Uncertainty',
    ],
    example:
      'Educational example — not a model answer: The student explains that most studies suggest benefit, but evidence is inconsistent across settings.',
    aiPrompt: `Act as an evidence-mapping tutor.

Use only studies or evidence that I provide.

Help me organize studies by:
population,
design,
exposure or intervention,
outcome,
setting,
and findings.

Ask me to identify agreement, disagreement, methodological differences and unresolved uncertainty.

Do not invent studies.`,
  },
  {
    title: 'Identify the research gap',
    objective:
      'Show what is still unknown and why that uncertainty matters.',
    question:
      'What important uncertainty remains after reviewing the existing evidence?',
    indicators: [
      'What is already known is clear',
      'What remains unknown is clear',
      'Gap is supported by evidence',
      'Potential contribution is justified',
    ],
    supervisorGuide: {
      purpose:
        'Ensure the student can explain the gap in a reasoned and evidence-based way.',
      competency:
        'The student should connect prior evidence to a specific unresolved problem and explain the likely contribution of new work.',
      lookFor: [
        'A clear distinction between known and unknown',
        'Evidence-based justification',
        'A plausible contribution',
      ],
      commonProblems: [
        'A vague claim that “few studies exist”',
        'Gap statements unsupported by evidence',
      ],
      evidenceExpected: [
        'A statement of what is known',
        'A statement of the remaining uncertainty',
        'A reason the study matters',
      ],
      example:
        'Educational example — not a model answer: A student explains that prior studies focus on adults, leaving no clear evidence for adolescents in primary care.',
    },
    commonPitfalls: [
      'Claiming novelty without evidence',
      'Describing a gap in abstract terms',
    ],
    evidenceRequirements: [
      'Known evidence',
      'Remaining uncertainty',
      'Why the gap matters',
    ],
    example:
      'Educational example — not a model answer: The student points out that studies have focused on hospital settings, while community clinics remain under-studied.',
    aiPrompt: `Act as a research-gap tutor.

Do not invent novelty.

Using the evidence I provide, help me distinguish:
what is known,
what is uncertain,
for whom,
in which setting,
and why resolving the uncertainty matters.

Challenge vague statements such as "few studies exist."

Make me justify the gap with evidence.`,
  },
  {
    title: 'Set objectives',
    objective:
      'Translate the research question into clear, purposeful objectives.',
    question:
      'What specific objectives must be achieved to answer the research question?',
    indicators: [
      'Primary objective aligns with the question',
      'Objectives are measurable',
      'Secondary objectives are relevant',
      'Objectives do not exceed available data',
    ],
    supervisorGuide: {
      purpose:
        'Help the student define aims that are specific and realistically measurable.',
      competency:
        'The student should demonstrate that each objective supports the question and can be addressed with the planned data.',
      lookFor: [
        'A primary objective that matches the question',
        'Measurable and focused wording',
        'Relevant secondary aims',
      ],
      commonProblems: [
        'Objectives are too broad',
        'The aims do not match the data plan',
      ],
      evidenceExpected: [
        'Primary and secondary objectives',
        'A note on measurability',
      ],
      example:
        'Educational example — not a model answer: A student lists one primary objective to measure attendance change and one secondary objective to describe satisfaction with the intervention.',
    },
    commonPitfalls: [
      'Including too many aims',
      'Making objectives unmeasurable',
    ],
    evidenceRequirements: [
      'Primary objective',
      'Secondary objectives',
      'Measurement or outcome focus',
    ],
    example:
      'Educational example — not a model answer: The student states that the main objective is to compare follow-up completion before and after the reminder programme.',
    aiPrompt: `Act as a research-objectives tutor.

Do not write objectives for me immediately.

Make me explain:
the primary research question,
the main outcome,
what must be measured,
and which secondary questions are truly necessary.

Check every proposed objective for:
alignment,
measurability,
clarity,
and scope.

Challenge unnecessary objectives.`,
  },
  {
    title: 'Design methodology',
    objective:
      'Choose a study design and methods that can answer the question validly.',
    question:
      'What study design and methods can validly answer the research question?',
    indicators: [
      'Study design fits the research question',
      'Population and sampling are defined',
      'Variables and measurements are operationalized',
      'Analysis plan aligns with objectives',
    ],
    supervisorGuide: {
      purpose:
        'Make sure the student can justify an appropriate design and method plan.',
      competency:
        'The student should show a credible match between design, population, measurement and analysis.',
      lookFor: [
        'A suitable design',
        'Defined sampling and eligibility',
        'Operationalised variables and analysis',
      ],
      commonProblems: [
        'A design that does not fit the question',
        'Unclear or unmeasurable variables',
      ],
      evidenceExpected: [
        'Design choice',
        'Population and sampling plan',
        'Measurement and analysis approach',
      ],
      example:
        'Educational example — not a model answer: A student proposes a before-and-after design with a short survey and simple statistical comparison.',
    },
    commonPitfalls: [
      'Choosing a design without justification',
      'Leaving measurement unclear',
    ],
    evidenceRequirements: [
      'Study design',
      'Sampling',
      'Variables and measurement',
      'Analysis plan',
    ],
    example:
      'Educational example — not a model answer: The student explains that a survey-based observational design is suitable because the aim is to describe attendance change rather than prove causation.',
    aiPrompt: `Act as a methodology tutor.

Do not simply write a methodology section.

Make me justify:
study design,
setting,
population,
eligibility criteria,
sampling,
sample-size reasoning,
variables,
measurements,
data collection,
and statistical analysis.

Identify mismatches between my research question, design and analysis.`,
  },
  {
    title: 'Review bias and risks',
    objective:
      'Identify the main ways the study might be misled or weakened.',
    question:
      'If this study produces a misleading result, what are the most likely reasons?',
    indicators: [
      'Selection bias is considered',
      'Information or measurement bias is considered',
      'Confounding is considered',
      'Practical mitigation strategies are proposed',
    ],
    supervisorGuide: {
      purpose:
        'Help the student anticipate and manage the kinds of bias and risk that could undermine the study.',
      competency:
        'The student should identify plausible biases and explain plausible ways to reduce them.',
      lookFor: [
        'Awareness of selection, measurement and confounding bias',
        'Realistic mitigation ideas',
      ],
      commonProblems: [
        'Ignoring bias entirely',
        'Listing risks without mitigation',
      ],
      evidenceExpected: [
        'Identified risks',
        'Mitigation strategies',
      ],
      example:
        'Educational example — not a model answer: A student notes that volunteers may differ from non-volunteers and suggests a simple recruitment protocol to reduce bias.',
    },
    commonPitfalls: [
      'Assuming the study is unbiased',
      'Overlooking missing data or confounding',
    ],
    evidenceRequirements: [
      'Selection bias',
      'Measurement bias',
      'Confounding',
      'Mitigation',
    ],
    example:
      'Educational example — not a model answer: The student explains how incomplete surveys could affect results and how they will manage missing data.',
    aiPrompt: `Red-team my proposed study as a research tutor.

Assume the study could produce a misleading result.

Question me about:
selection bias,
measurement bias,
misclassification,
confounding,
missing data,
reverse causality,
analytic flexibility,
and operational failures.

For each important risk, ask me how I will prevent, measure or manage it.`,
  },
  {
    title: 'Build the proposal',
    objective:
      'Create a coherent proposal that connects the problem, evidence and methods.',
    question:
      'Does the proposal form one coherent argument from problem to methods?',
    indicators: [
      'Problem, gap and question are aligned',
      'Objectives and methodology are aligned',
      'Claims are supported',
      'Protocol is sufficiently reproducible',
    ],
    supervisorGuide: {
      purpose:
        'Ensure the student can present the argument of the study clearly and logically.',
      competency:
        'The student should show that the proposal flows consistently from problem to gap to question to methods.',
      lookFor: [
        'Clear alignment across sections',
        'Well-supported claims',
        'Enough detail to understand the study',
      ],
      commonProblems: [
        'Contradictions between sections',
        'Unsupported claims',
      ],
      evidenceExpected: [
        'A proposal draft',
        'Connective reasoning between sections',
      ],
      example:
        'Educational example — not a model answer: A student links the problem of poor follow-up to a gap in evidence and then shows how the proposed methods will address it.',
    },
    commonPitfalls: [
      'Writing disconnected sections',
      'Overclaiming',
    ],
    evidenceRequirements: [
      'Problem-gap-question alignment',
      'Objectives and methods alignment',
      'Logical coherence',
    ],
    example:
      'Educational example — not a model answer: The student explains how the research question and methods follow directly from the earlier problem definition and gap analysis.',
    aiPrompt: `Act as a research-proposal tutor and editor.

Review my proposal for logical alignment between:
problem,
literature,
gap,
research question,
objectives,
and methodology.

Identify contradictions,
unsupported claims,
missing operational details,
and unnecessary content.

Explain why revisions are needed rather than silently rewriting everything.`,
  },
  {
    title: 'Pilot and collect data',
    objective:
      'Test whether the data-collection process works and can be documented reliably.',
    question:
      'Can the planned data-collection process work reliably before full implementation?',
    indicators: [
      'Pilot tests the workflow',
      'Variables are clearly defined',
      'Data-quality checks are established',
      'Protocol deviations can be documented',
    ],
    supervisorGuide: {
      purpose:
        'Help the student prepare a pilot or data-collection plan that is robust and well documented.',
      competency:
        'The student should show that they can test the workflow, define variables and describe how errors or deviations will be handled.',
      lookFor: [
        'A realistic pilot or rollout plan',
        'Clear variable definitions',
        'Quality checks and deviation logging',
      ],
      commonProblems: [
        'No pilot or testing step',
        'Unclear data definitions',
      ],
      evidenceExpected: [
        'Pilot or data-collection plan',
        'Quality checks',
        'Issue log or deviation notes',
      ],
      example:
        'Educational example — not a model answer: A student describes a small pilot of the reminder process and notes how missing responses will be logged.',
    },
    commonPitfalls: [
      'Skipping the pilot',
      'Leaving quality checks vague',
    ],
    evidenceRequirements: [
      'Pilot plan',
      'Variable definitions',
      'Data-quality checks',
      'Deviation handling',
    ],
    example:
      'Educational example — not a model answer: The student explains how a short pilot will test whether the form is clear and whether responses can be entered consistently.',
    aiPrompt: `Act as a pilot-study and data-quality tutor.

Help me test whether my data collection process works.

Ask about:
data definitions,
ambiguous variables,
missing-data handling,
workflow failures,
data validation,
quality checks,
and protocol deviations.

Help me design a simple issue log and correction process.`,
  },

  {
    title: 'Analyze and interpret',
    objective:
      'Interpret the findings carefully and connect them to the question and objectives.',
    question:
      'What do the results support, what do they not support, and what alternative explanations remain?',
    indicators: [
      'Analysis follows predefined objectives',
      'Magnitude and uncertainty are considered',
      'Bias and confounding are revisited',
      'Conclusions do not exceed the data',
    ],
    supervisorGuide: {
      purpose:
        'Help the student interpret results with care and avoid overstatement.',
      competency:
        'The student should connect results to the study aims, explain uncertainty, and avoid unsupported conclusions.',
      lookFor: [
        'Clear linkage between analysis and objectives',
        'Attention to uncertainty and effect size',
        'Consideration of alternative explanations',
      ],
      commonProblems: [
        'Overclaiming from weak evidence',
        'Ignoring uncertainty or bias',
      ],
      evidenceExpected: [
        'Interpretation of findings',
        'Discussion of limitations and alternative explanations',
      ],
      example:
        'Educational example — not a model answer: A student explains that the observed difference is promising but uncertain given the small sample and possible missing data.',
    },
    commonPitfalls: [
      'Confusing correlation with causation',
      'Ignoring limitations',
    ],
    evidenceRequirements: [
      'Interpretation of findings',
      'Uncertainty and effect size',
      'Alternative explanations',
    ],
    example:
      'Educational example — not a model answer: The student distinguishes what the data can support from what remains speculative.',
    aiPrompt: `Act as a statistical interpretation tutor.

Do not manufacture results or significance.

Make me connect each analysis to an objective.

Ask me to distinguish:
description,
association,
prediction,
and causation.

Help me consider:
effect size,
uncertainty,
bias,
confounding,
missing data,
unexpected findings,
and alternative explanations.

Challenge overclaiming.`,
  },
  {
    title: 'Write and publish',
    objective:
      'Communicate the study clearly and transparently for a scholarly audience.',
    question:
      'Can another researcher clearly understand what was done, what was found, and how certain the conclusions are?',
    indicators: [
      'Reporting matches the study design',
      'Methods and results are transparent',
      'Limitations are explicitly reported',
      'Conclusions and journal choice are appropriate',
    ],
    supervisorGuide: {
      purpose:
        'Ensure the student can write a clear, transparent and appropriately scoped report or manuscript.',
      competency:
        'The student should show that the report is understandable, transparent and honest about strengths and limitations.',
      lookFor: [
        'Clear structure and clarity',
        'Transparent methods and results',
        'Honest reporting of limitations',
      ],
      commonProblems: [
        'Opaque writing',
        'Overly strong conclusions',
      ],
      evidenceExpected: [
        'A manuscript or report draft',
        'A clear summary of methods, findings and limitations',
      ],
      example:
        'Educational example — not a model answer: A student writes a concise summary with a clear methods section and a balanced discussion of what the study does and does not show.',
    },
    commonPitfalls: [
      'Hiding weaknesses',
      'Reporting without enough detail',
    ],
    evidenceRequirements: [
      'Readable report',
      'Methods and results transparency',
      'Limitations and conclusions',
    ],
    example:
      'Educational example — not a model answer: The student explains how the work would be presented to a journal audience and why the chosen reporting style fits the aims.',
    aiPrompt: `Act as a scientific-writing tutor.

Help me prepare a transparent manuscript.

Check:
reporting guideline,
title and abstract consistency,
methods reproducibility,
results presentation,
tables and figures,
discussion logic,
limitations,
conclusions,
references,
and journal fit.

Do not fabricate citations.
Do not hide negative or unexpected findings.`,
  },
]

const blankStage = () => ({
  attempt: '',
  attemptSubmitted: false,
  learning: '',
  finalAnswer: '',
  evidence: createEvidence(),
  aiReadinessReport: null,
  submitted: false,
  supervisorFeedback: '',
  reviewDecision: '',
  checks: [],
  approved: false,
})

function normalizeAiReadinessReport(value) {
  if (!value) {
    return {
      status: 'not_started',
      generatedAt: '',
      model: '',
      report: null,
      error: '',
    }
  }

  if (typeof value === 'string') {
    return {
      status: 'ready',
      generatedAt: '',
      model: 'manual',
      report: { stageSummary: value },
      error: '',
    }
  }

  return {
    status: value.status || 'ready',
    generatedAt: value.generatedAt || '',
    model: value.model || '',
    report: value.report || null,
    error: value.error || '',
  }
}

function buildCaseStatus(stages = [], currentStage = 0) {
  const approvedCount = (stages || []).filter((stage) => Boolean(stage.approved)).length

  if (approvedCount >= stages.length && stages.length > 0) {
    return 'Completed'
  }

  if (approvedCount > 0 || currentStage > 0) {
    return 'In Progress'
  }

  return 'Started'
}

function appendActivity(history = [], action = 'Stage updated', stageNumber = null) {
  return [
    ...(Array.isArray(history) ? history : []),
    {
      timestamp: new Date().toISOString(),
      action,
      stageNumber,
    },
  ]
}

function App() {
  const [mode, setMode] = useState('student')
  const [cases, setCases] = useState([])
  const [activeCaseId, setActiveCaseIdState] = useState(getActiveCaseId())
  const [project, setProject] = useState('')
  const [started, setStarted] = useState(false)
  const [currentStage, setCurrentStage] = useState(0)
  const [copied, setCopied] = useState(false)
  const [copiedReadiness, setCopiedReadiness] = useState(false)
  const [view, setView] = useState('active')
  const [activeCase, setActiveCase] = useState(null)

  const selectCase = (caseToSelect, options = {}) => {
    if (!caseToSelect) {
      setActiveCase(null)
      setActiveCaseIdState(null)
      if (options.persist !== false) {
        setActiveCaseId(null)
      }
      setProject('')
      setStarted(false)
      setCurrentStage(0)
      setMode('student')
      setView('cases')
      return
    }

    setActiveCase(caseToSelect)
    setActiveCaseIdState(caseToSelect.id)
    if (options.persist !== false) {
      setActiveCaseId(caseToSelect.id)
    }
    setProject(caseToSelect.studentName || caseToSelect.researchTopic || '')
    setStarted(Boolean(caseToSelect.stages?.some((stage) => stage.initialAttempt || stage.aiLearningReflection || stage.revisedAnswer || stage.submittedToSupervisor || stage.approved)))
    setCurrentStage(Number(caseToSelect.currentStage || 0))
    setMode('student')
    setView('active')
  }

  useEffect(() => {
    const migrated = migrateLegacyData(stages)
    const existingCases = getCases()
    const nextCases = migrated
      ? [migrated, ...existingCases.filter((item) => item.id !== migrated.id)]
      : existingCases

    if (nextCases.length > 0) {
      saveCases(nextCases)
    }

    setCases(nextCases)

    const activeId = getActiveCaseId()
    if (activeId) {
      const found = nextCases.find((item) => item.id === activeId)
      if (found) {
        selectCase(found, { persist: false })
      } else if (nextCases.length > 0) {
        selectCase(nextCases[0], { persist: false })
      } else {
        setView('cases')
      }
    } else if (nextCases.length > 0) {
      selectCase(nextCases[0], { persist: false })
    } else {
      setView('cases')
    }
  }, [])

  useEffect(() => {
    if (!activeCase) {
      return
    }

    const nextCase = {
      ...activeCase,
      studentName: project,
      researchTopic: project,
      currentStage,
      updatedAt: new Date().toISOString(),
      status: buildCaseStatus(activeCase.stages, currentStage),
    }

    setActiveCase(nextCase)
    setCases((oldCases) => {
      const updated = oldCases.map((item) => (item.id === activeCase.id ? nextCase : item))
      saveCases(updated)
      return updated
    })
  }, [activeCase?.id, project, currentStage])

  const getRecord = (index) => {
    const stage = activeCase?.stages?.[index] || null
    if (!stage) {
      return {
        ...blankStage(),
        evidence: mergeEvidence(blankStage().evidence, {}),
      }
    }

    const aiReportMeta = normalizeAiReadinessReport(stage.aiReadinessReport)

    return {
      ...blankStage(),
      attempt: stage.initialAttempt || '',
      attemptSubmitted: Boolean(stage.attemptSubmitted),
      learning: stage.aiLearningReflection || '',
      finalAnswer: stage.revisedAnswer || '',
      evidence: mergeEvidence(blankStage().evidence, {
        initialAttempt: stage.initialAttempt || '',
        aiCoaching: stage.evidence?.find((entry) => entry.type === 'ai')?.notes || '',
        reflection: stage.aiLearningReflection || '',
        finalSubmission: stage.revisedAnswer || '',
        references: stage.evidence?.find((entry) => entry.type === 'reference')?.referenceSource || '',
        notes: stage.evidence?.find((entry) => entry.type === 'reference')?.notes || '',
      }),
      aiReadinessReport: aiReportMeta.report || '',
      aiReadinessReportStatus: aiReportMeta.status,
      aiReadinessReportMeta: aiReportMeta,
      submitted: Boolean(stage.submittedToSupervisor),
      supervisorFeedback: stage.supervisorFeedback || '',
      reviewDecision: stage.supervisorDecision || '',
      checks: Array.isArray(stage.competencyIndicators)
        ? stage.competencyIndicators.map((item) => Boolean(item.checked))
        : [],
      approved: Boolean(stage.approved),
      stageName: stage.stageName || stages[index].title,
    }
  }

  const updateRecord = (index, patch) => {
    if (!activeCase) {
      return
    }

    const stageIndex = index
    const nextStages = activeCase.stages.map((stage, stagePos) => {
      if (stagePos !== stageIndex) {
        return stage
      }

      const currentStageRecord = stage
      const nextEvidence = patch.evidence
        ? mergeEvidence(
            {
              initialAttempt: currentStageRecord.initialAttempt || '',
              aiCoaching: currentStageRecord.evidence?.find((entry) => entry.type === 'ai')?.notes || '',
              reflection: currentStageRecord.aiLearningReflection || '',
              finalSubmission: currentStageRecord.revisedAnswer || '',
              references: currentStageRecord.evidence?.find((entry) => entry.type === 'reference')?.referenceSource || '',
              notes: currentStageRecord.evidence?.find((entry) => entry.type === 'reference')?.notes || '',
            },
            patch.evidence
          )
        : {
            initialAttempt: currentStageRecord.initialAttempt || '',
            aiCoaching: currentStageRecord.evidence?.find((entry) => entry.type === 'ai')?.notes || '',
            reflection: currentStageRecord.aiLearningReflection || '',
            finalSubmission: currentStageRecord.revisedAnswer || '',
            references: currentStageRecord.evidence?.find((entry) => entry.type === 'reference')?.referenceSource || '',
            notes: currentStageRecord.evidence?.find((entry) => entry.type === 'reference')?.notes || '',
          }

      const evidenceEntries = []
      const evidenceObject = nextEvidence || {}
      if (evidenceObject.initialAttempt) {
        evidenceEntries.push({ title: 'Initial attempt', type: 'student', referenceSource: '', notes: evidenceObject.initialAttempt, dateAdded: new Date().toISOString() })
      }
      if (evidenceObject.aiCoaching) {
        evidenceEntries.push({ title: 'AI coaching', type: 'ai', referenceSource: '', notes: evidenceObject.aiCoaching, dateAdded: new Date().toISOString() })
      }
      if (evidenceObject.reflection) {
        evidenceEntries.push({ title: 'Reflection', type: 'reflection', referenceSource: '', notes: evidenceObject.reflection, dateAdded: new Date().toISOString() })
      }
      if (evidenceObject.finalSubmission) {
        evidenceEntries.push({ title: 'Final submission', type: 'student', referenceSource: '', notes: evidenceObject.finalSubmission, dateAdded: new Date().toISOString() })
      }
      if (evidenceObject.references || evidenceObject.notes) {
        evidenceEntries.push({ title: 'References', type: 'reference', referenceSource: evidenceObject.references || '', notes: evidenceObject.notes || '', dateAdded: new Date().toISOString() })
      }

      return {
        ...currentStageRecord,
        ...patch,
        initialAttempt:
          typeof patch.attempt === 'string'
            ? patch.attempt
            : currentStageRecord.initialAttempt || '',
        aiLearningReflection:
          typeof patch.learning === 'string'
            ? patch.learning
            : currentStageRecord.aiLearningReflection || '',
        revisedAnswer:
          typeof patch.finalAnswer === 'string'
            ? patch.finalAnswer
            : currentStageRecord.revisedAnswer || '',
        evidence: evidenceEntries.length > 0 ? evidenceEntries : currentStageRecord.evidence || [],
        aiReadinessReport:
          typeof patch.aiReadinessReport !== 'undefined'
            ? patch.aiReadinessReport
            : currentStageRecord.aiReadinessReport || null,
        supervisorFeedback:
          typeof patch.supervisorFeedback === 'string'
            ? patch.supervisorFeedback
            : currentStageRecord.supervisorFeedback || '',
        supervisorDecision:
          typeof patch.reviewDecision === 'string'
            ? patch.reviewDecision
            : currentStageRecord.supervisorDecision || '',
        competencyIndicators:
          Array.isArray(patch.checks)
            ? patch.checks.map((checked, indicatorIndex) => ({
                label: currentStageRecord.competencyIndicators?.[indicatorIndex]?.label || stages[index].indicators[indicatorIndex],
                checked: Boolean(checked),
              }))
            : currentStageRecord.competencyIndicators || [],
        approved:
          typeof patch.approved === 'boolean'
            ? patch.approved
            : currentStageRecord.approved || false,
        submittedToSupervisor:
          typeof patch.submitted === 'boolean'
            ? patch.submitted
            : currentStageRecord.submittedToSupervisor || false,
        attemptSubmitted:
          typeof patch.attemptSubmitted === 'boolean'
            ? patch.attemptSubmitted
            : currentStageRecord.attemptSubmitted || false,
        submittedAt: currentStageRecord.submittedAt || '',
      }
    })

    const updatedCase = {
      ...activeCase,
      stages: nextStages,
      updatedAt: new Date().toISOString(),
      status: buildCaseStatus(nextStages, currentStage),
      activityHistory: appendActivity(activeCase.activityHistory, patch.activityAction || 'Stage updated', index + 1),
    }

    setActiveCase(updatedCase)
    setCases((oldCases) => {
      const updatedCases = oldCases.map((item) => (item.id === activeCase.id ? updatedCase : item))
      saveCases(updatedCases)
      return updatedCases
    })
  }

  function startPathway() {
    if (!project.trim()) {
      alert('Enter the student name or research topic first.')
      return
    }

    if (!activeCase) {
      const created = createCase(project, project, stages)
      const nextCases = [created, ...cases]
      setCases(nextCases)
      saveCases(nextCases)
      selectCase(created)
    }

    setStarted(true)
    setView('active')
  }

  function submitInitialAttempt() {
    const record = getRecord(currentStage)

    if (!record.attempt.trim()) {
      alert('Write your own initial attempt first.')
      return
    }

    updateRecord(currentStage, {
      attemptSubmitted: true,
      evidence: {
        ...record.evidence,
        initialAttempt: record.attempt,
      },
    })
  }

  async function copyPrompt() {
    const stage = stages[currentStage]
    const record = getRecord(currentStage)

    const fullPrompt = `${stage.aiPrompt}

My initial attempt:
${record.attempt || 'No initial attempt recorded.'}`

    await navigator.clipboard.writeText(fullPrompt)

    setCopied(true)

    setTimeout(() => {
      setCopied(false)
    }, 1500)
  }

  async function copyAiReadinessPrompt() {
    const stage = stages[currentStage]
    const record = getRecord(currentStage)
    const fullPrompt = buildAiReadinessPrompt(stage, record, project, currentStage)

    await navigator.clipboard.writeText(fullPrompt)

    setCopiedReadiness(true)

    setTimeout(() => {
      setCopiedReadiness(false)
    }, 1500)
  }

  async function generateAiReadinessReportForCurrentStage() {
    if (!activeCase) {
      return
    }

    const currentStageInfo = stages[currentStage]
    const record = getRecord(currentStage)

    const payload = {
      caseId: activeCase.id,
      studentName: project || activeCase.studentName || 'Student',
      researchTopic: activeCase.researchTopic || project || 'Research project',
      stageNumber: currentStage + 1,
      stageTitle: currentStageInfo.title,
      stageObjective: currentStageInfo.objective,
      supervisorGuide: currentStageInfo.supervisorGuide,
      competencyIndicators: currentStageInfo.indicators.map((indicator, index) => ({
        label: indicator,
        checked: Boolean(record.checks[index]),
      })),
      initialAttempt: record.attempt || '',
      studentReflection: record.learning || '',
      finalSubmission: record.finalAnswer || '',
      evidence: {
        ...record.evidence,
        reflection: record.learning || '',
        finalSubmission: record.finalAnswer || '',
      },
    }

    updateRecord(currentStage, {
      submitted: true,
      reviewDecision: '',
      approved: false,
      checks: stages[currentStage].indicators.map(() => false),
      evidence: {
        ...record.evidence,
        reflection: record.learning,
        finalSubmission: record.finalAnswer,
      },
      aiReadinessReport: {
        generatedAt: new Date().toISOString(),
        model: 'pending',
        status: 'generating_ai_report',
        report: null,
        error: '',
      },
      activityAction: 'AI report generation started',
    })

    try {
      const response = await fetch('/api/readiness-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({ error: 'AI report generation failed.' }))

      if (!response.ok) {
        throw new Error(data?.error || 'AI report generation failed.')
      }

      updateRecord(currentStage, {
        aiReadinessReport: {
          generatedAt: new Date().toISOString(),
          model: data.model || 'gpt-4.1-mini',
          status: 'awaiting_supervisor_review',
          report: data,
          error: '',
        },
        activityAction: 'AI report generated',
      })

      return true
    } catch (error) {
      updateRecord(currentStage, {
        aiReadinessReport: {
          generatedAt: new Date().toISOString(),
          model: '',
          status: 'failed',
          report: null,
          error: error?.message || 'AI report generation failed.',
        },
        activityAction: 'AI report generation failed',
      })

      return false
    }
  }

  async function submitForSupervisor() {
    const record = getRecord(currentStage)

    if (!record.learning.trim()) {
      alert('Complete “What did you learn?” first.')
      return
    }

    if (!record.finalAnswer.trim()) {
      alert('Complete your final submission first.')
      return
    }

    const success = await generateAiReadinessReportForCurrentStage()
    setMode('supervisor')

    if (!success) {
      alert('AI report generation failed — retry available')
    }
  }

  async function retryAiReport() {
    const success = await generateAiReadinessReportForCurrentStage()
    if (!success) {
      alert('AI report generation failed — retry available')
    }
  }

  function approveStage() {
    const record = getRecord(currentStage)

    const checks = Array.isArray(record.checks) ? record.checks : []

    if (
      checks.length !== stages[currentStage].indicators.length ||
      !checks.every(Boolean)
    ) {
      alert('All competency indicators must be checked before approval.')
      return
    }

    updateRecord(currentStage, {
      reviewDecision: 'approved',
      approved: true,
      submitted: false,
    })

    if (currentStage < stages.length - 1) {
      setCurrentStage(currentStage + 1)
      setMode('student')
    } else {
      setCurrentStage(stages.length)
      setMode('student')
    }
  }

  function returnForRevision() {
    const record = getRecord(currentStage)

    if (!record.supervisorFeedback.trim()) {
      alert('Write revision guidance for the student.')
      return
    }

    updateRecord(currentStage, {
      submitted: false,
      reviewDecision: 'revision',
      approved: false,
      attemptSubmitted: true,
    })

    setMode('student')
  }

  function handleNewCase() {
    const created = createCase('', '', stages)
    const nextCases = [created, ...cases]
    setCases(nextCases)
    saveCases(nextCases)
    selectCase(created)
    setProject('')
    setStarted(false)
    setCurrentStage(0)
    setMode('student')
    setView('active')
  }

  function resetProject() {
    const ok = window.confirm('Create a new case and keep all existing cases?')

    if (!ok) return

    handleNewCase()
  }

  function openCase(caseId) {
    const found = cases.find((item) => item.id === caseId)
    if (!found) {
      return
    }

    selectCase(found)
  }

  function reviewCase(caseId) {
    const found = cases.find((item) => item.id === caseId)
    if (!found) {
      return
    }

    selectCase(found)
    setMode('supervisor')
  }

  function deleteCaseById(caseId) {
    const confirmed = window.confirm('Delete this case permanently?')
    if (!confirmed) {
      return
    }

    const updatedCases = deleteCase(caseId)
    setCases(updatedCases)
    if (activeCase?.id === caseId) {
      const nextCase = updatedCases[0] || null
      if (nextCase) {
        selectCase(nextCase)
      } else {
        selectCase(null)
      }
    }
  }

  function saveCurrentCase() {
    if (!activeCase) {
      return
    }

    const nextCase = {
      ...activeCase,
      studentName: project,
      researchTopic: project,
      currentStage,
      updatedAt: new Date().toISOString(),
      status: buildCaseStatus(activeCase.stages, currentStage),
    }

    setActiveCase(nextCase)
    setCases((oldCases) => {
      const updatedCases = oldCases.map((item) => (item.id === activeCase.id ? nextCase : item))
      saveCases(updatedCases)
      return updatedCases
    })
  }

  useEffect(() => {
    if (!activeCase) {
      return
    }

    saveCurrentCase()
  }, [activeCase?.id])

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <h1>RAE Research Engine</h1>

          <p>
            Research learning · AI tutoring · evidence · supervisor competency
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <button onClick={() => setMode('student')}>
            Student
          </button>

          <button onClick={() => setMode('supervisor')}>
            Supervisor
          </button>

          <button
            onClick={() => setView(view === 'cases' ? 'active' : 'cases')}
            style={{ background: '#4b5563' }}
          >
            {view === 'cases' ? 'Back to active case' : 'All cases'}
          </button>

          <button
            onClick={resetProject}
            style={{ background: '#6b7280' }}
          >
            New project
          </button>
        </div>
      </header>

      {view === 'cases' ? (
        <main className="container">
          <section className="hero">
            <div className="eyebrow">
              CASE REGISTRY
            </div>

            <h2>Open, review, or create a research case</h2>

            <p>
              Each case keeps its own evidence, approvals, supervisor feedback, and stage history.
            </p>

            <button onClick={handleNewCase} style={{ marginTop: 12 }}>
              + New case
            </button>
          </section>

          <section className="grid">
            {cases.length === 0 ? (
              <article className="card">
                <h4>No saved cases yet</h4>
                <p>Create a new case to begin tracking a research pathway.</p>
              </article>
            ) : (
              cases.map((caseItem) => (
                <article className="card" key={caseItem.id}>
                  <div className="card-number">
                    {caseItem.status === 'Completed' ? '✓' : 'C'}
                  </div>

                  <h4>{caseItem.studentName || caseItem.researchTopic || 'Untitled case'}</h4>

                  <p>{caseItem.researchTopic || 'Research topic not entered yet'}</p>

                  <p>
                    {caseItem.status || 'In Progress'} · Stage {Number(caseItem.currentStage || 0) + 1}/14
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginTop: 12,
                    }}
                  >
                    <button onClick={() => openCase(caseItem.id)}>
                      Open
                    </button>
                    <button onClick={() => reviewCase(caseItem.id)} style={{ background: '#6b7280' }}>
                      Review
                    </button>
                    <button onClick={() => deleteCaseById(caseItem.id)} style={{ background: '#b45a3c' }}>
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
        </main>
      ) : (
        <>
          {mode === 'student' && (
            <StudentView
              project={project}
              setProject={setProject}
              started={started}
              startPathway={startPathway}
              currentStage={currentStage}
              getRecord={getRecord}
              updateRecord={updateRecord}
              submitInitialAttempt={submitInitialAttempt}
              copyPrompt={copyPrompt}
              copied={copied}
              copyAiReadinessPrompt={copyAiReadinessPrompt}
              copiedReadiness={copiedReadiness}
              submitForSupervisor={submitForSupervisor}
            />
          )}

          {mode === 'supervisor' && (
            <SupervisorView
              project={project}
              started={started}
              currentStage={currentStage}
              getRecord={getRecord}
              updateRecord={updateRecord}
              approveStage={approveStage}
              returnForRevision={returnForRevision}
              copyAiReadinessPrompt={copyAiReadinessPrompt}
              retryAiReport={retryAiReport}
            />
          )}
        </>
      )}

      <footer className="footer">
        RAE Research Engine · Student → AI Tutor → Evidence → Supervisor
      </footer>
    </div>
  )
}

function StudentView({
  project,
  setProject,
  started,
  startPathway,
  currentStage,
  getRecord,
  updateRecord,
  submitInitialAttempt,
  copyPrompt,
  copied,
  copyAiReadinessPrompt,
  copiedReadiness,
  submitForSupervisor,
}) {
  if (currentStage >= stages.length) {
    return (
      <main className="container">
        <section className="hero">
          <div className="eyebrow">
            RESEARCH PATHWAY COMPLETE
          </div>

          <h2>14 / 14 competencies approved</h2>

          <p>
            The student has completed the full supervised research pathway.
          </p>

          <div
            style={{
              background: '#eaf5ee',
              padding: 20,
              borderRadius: 10,
              marginTop: 25,
            }}
          >
            <strong>Research competency pathway completed</strong>
            <p style={{ marginBottom: 8 }}>
              All 14 stages were completed and approved.
            </p>
            <div style={{ lineHeight: 1.8 }}>
              ✓ Research Problem
              <br />
              ✓ Feasibility
              <br />
              ✓ Research Question
              <br />
              ✓ Literature Search
              <br />
              ✓ Critical Appraisal
              <br />
              ✓ Evidence Mapping
              <br />
              ✓ Research Gap
              <br />
              ✓ Objectives
              <br />
              ✓ Methodology
              <br />
              ✓ Bias & Risk
              <br />
              ✓ Proposal
              <br />
              ✓ Data Collection
              <br />
              ✓ Analysis
              <br />
              ✓ Manuscript & Publication
            </div>
          </div>
        </section>
      </main>
    )
  }

  const stage = stages[currentStage]
  const record = getRecord(currentStage)

  return (
    <main className="container">
      <section className="hero">
        <div className="eyebrow">
          RESEARCH COMPETENCY PATHWAY
        </div>

        <h2>Learn research by doing research</h2>

        <p>
          Think first → AI coaching → reflection → revision → supervisor approval
        </p>

        <div className="search">
          <input
            value={project}
            disabled={started}
            onChange={(e) =>
              setProject(e.target.value)
            }
            placeholder="Student name or research topic"
          />

          {!started && (
            <button onClick={startPathway}>
              Start pathway
            </button>
          )}
        </div>
      </section>

      {started && (
        <section
          className="hero"
          style={{ marginTop: 25 }}
        >
          <div className="eyebrow">
            STAGE {currentStage + 1} OF 14
          </div>

          <h2>{stage.title}</h2>

          <p>
            <strong>Project:</strong> {project}
          </p>

          {record.reviewDecision === 'revision' && (
            <div
              style={{
                background: '#fff3cd',
                padding: 18,
                borderRadius: 10,
                marginTop: 20,
                textAlign: 'left',
              }}
            >
              <strong>
                Supervisor requested revision
              </strong>

              <p>{record.supervisorFeedback}</p>
            </div>
          )}

          <h3 style={{ marginTop: 30 }}>
            1. Think first — without AI
          </h3>

          <p>{stage.question}</p>

          <textarea
            value={record.attempt}
            disabled={record.attemptSubmitted}
            onChange={(e) =>
              updateRecord(currentStage, {
                attempt: e.target.value,
                evidence: {
                  ...record.evidence,
                  initialAttempt: e.target.value,
                },
              })
            }
            placeholder="Write your own reasoning before using AI..."
            style={textareaStyle}
          />

          {!record.attemptSubmitted && (
            <button
              onClick={submitInitialAttempt}
              style={{ marginTop: 12 }}
            >
              Submit initial attempt
            </button>
          )}

          {record.attemptSubmitted &&
            !record.submitted && (
              <>
                <hr style={hrStyle} />

                <h3>
                  2. Train with AI
                </h3>

                <p>
                  AI tutors and challenges your reasoning.
                  AI does not approve competency.
                </p>

                <div
                  style={{
                    background: '#eef5fa',
                    padding: 18,
                    borderRadius: 10,
                    whiteSpace: 'pre-wrap',
                    textAlign: 'left',
                    marginTop: 12,
                  }}
                >
                  {stage.aiPrompt}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginTop: 12,
                  }}
                >
                  <button onClick={copyPrompt}>
                    {copied
                      ? 'Copied ✓'
                      : 'Copy AI coaching prompt'}
                  </button>

                  <button onClick={copyAiReadinessPrompt}>
                    {copiedReadiness
                      ? 'Copied ✓'
                      : 'Copy AI readiness report prompt'}
                  </button>
                </div>

                <hr style={hrStyle} />

                <h3>
                  3. What did you learn?
                </h3>

                <textarea
                  value={record.learning}
                  onChange={(e) =>
                    updateRecord(currentStage, {
                      learning: e.target.value,
                      evidence: {
                        ...record.evidence,
                        reflection: e.target.value,
                      },
                    })
                  }
                  placeholder="Explain what changed in your understanding..."
                  style={textareaStyle}
                />

                <h3 style={{ marginTop: 25 }}>
                  4. Final submission
                </h3>

                <textarea
                  value={record.finalAnswer}
                  onChange={(e) =>
                    updateRecord(currentStage, {
                      finalAnswer: e.target.value,
                      evidence: {
                        ...record.evidence,
                        finalSubmission: e.target.value,
                      },
                    })
                  }
                  placeholder="Write your improved final submission..."
                  style={{
                    ...textareaStyle,
                    minHeight: 160,
                  }}
                />

                <hr style={hrStyle} />

                <h3>5. Evidence and learning log</h3>

                <p>
                  Record the evidence you used, references, and notes about your learning process.
                </p>

                <div className="review-grid">
                  <label className="review-box">
                    <strong>AI coaching prompt / interactions</strong>
                    <textarea
                      value={record.evidence.aiCoaching}
                      onChange={(e) =>
                        updateRecord(currentStage, {
                          evidence: {
                            ...record.evidence,
                            aiCoaching: e.target.value,
                          },
                        })
                      }
                      placeholder="Note the coaching questions, prompts or feedback you used..."
                      style={{ ...textareaStyle, minHeight: 100 }}
                    />
                  </label>

                  <label className="review-box">
                    <strong>References / evidence used</strong>
                    <textarea
                      value={record.evidence.references}
                      onChange={(e) =>
                        updateRecord(currentStage, {
                          evidence: {
                            ...record.evidence,
                            references: e.target.value,
                          },
                        })
                      }
                      placeholder="DOI, PMID, URL, citation, dataset, source description..."
                      style={{ ...textareaStyle, minHeight: 100 }}
                    />
                  </label>

                  <label className="review-box">
                    <strong>Optional evidence notes</strong>
                    <textarea
                      value={record.evidence.notes}
                      onChange={(e) =>
                        updateRecord(currentStage, {
                          evidence: {
                            ...record.evidence,
                            notes: e.target.value,
                          },
                        })
                      }
                      placeholder="Add notes about your reasoning, learning, or supporting evidence..."
                      style={{ ...textareaStyle, minHeight: 100 }}
                    />
                  </label>
                </div>

                <div
                  style={{
                    background: '#f6f8fb',
                    padding: 18,
                    borderRadius: 10,
                    marginTop: 20,
                    textAlign: 'left',
                  }}
                >
                  <strong>
                    Supervisor competency indicators
                  </strong>

                  {stage.indicators.map(
                    (indicator) => (
                      <p key={indicator}>
                        ○ {indicator}
                      </p>
                    )
                  )}
                </div>

                <button
                  onClick={submitForSupervisor}
                  style={{ marginTop: 18 }}
                >
                  Submit for supervisor review
                </button>
              </>
            )}

              {record.submitted && (
            <div
              style={{
                background: '#eaf5ee',
                padding: 20,
                borderRadius: 10,
                marginTop: 25,
              }}
            >
              <h3>Submitted successfully</h3>

              <p>
                {record.aiReadinessReportStatus === 'generating_ai_report'
                  ? 'Generating AI readiness report...'
                  : record.aiReadinessReportStatus === 'failed'
                    ? 'AI report generation failed — retry available'
                    : 'Stage ' + (currentStage + 2 <= 14 ? currentStage + 2 : 'completion') + ' remains locked until supervisor approval.'}
              </p>

              {['failed', 'generating_ai_report'].includes(record.aiReadinessReportStatus) && (
                <button onClick={retryAiReport} style={{ marginTop: 12 }}>
                  Retry AI Report
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <div className="section-title">
        <h3>14 Research Stages</h3>

        <p>
          Supervisor approval controls progression.
        </p>
      </div>

      <section className="grid">
        {stages.map((item, index) => {
          const completed =
            index < currentStage

          const active =
            index === currentStage

          return (
            <article
              className="card"
              key={item.title}
              style={{
                opacity:
                  index > currentStage
                    ? 0.5
                    : 1,

                border:
                  active
                    ? '2px solid #2475a8'
                    : undefined,
              }}
            >
              <div className="card-number">
                {completed
                  ? '✓'
                  : index + 1}
              </div>

              <h4>{item.title}</h4>

              <p>
                {completed
                  ? 'Competency approved'
                  : active
                    ? 'Current learning stage'
                    : 'Locked until previous competency is approved'}
              </p>
            </article>
          )
        })}
      </section>
    </main>
  )
}

function SupervisorView({
  project,
  started,
  currentStage,
  getRecord,
  updateRecord,
  approveStage,
  returnForRevision,
  copyAiReadinessPrompt,
  retryAiReport,
}) {
  if (!started) {
    return (
      <main className="container">
        <section className="hero">
          <div className="eyebrow">
            SUPERVISOR DASHBOARD
          </div>

          <h2>No active project</h2>
        </section>
      </main>
    )
  }

  if (currentStage >= stages.length) {
    return (
      <main className="container">
        <section className="hero">
          <div className="eyebrow">
            SUPERVISOR DASHBOARD
          </div>

          <h2>Research pathway completed</h2>

          <p>
            All 14 competencies have been approved.
          </p>
        </section>
      </main>
    )
  }

  const stage = stages[currentStage]
  const record = getRecord(currentStage)
  const evidence = record.evidence || {}
  const aiReportMeta = normalizeAiReadinessReport(record.aiReadinessReportMeta || record.aiReadinessReport)
  const aiReport = aiReportMeta.report || {}
  const allIndicatorsChecked =
    Array.isArray(record.checks) &&
    record.checks.length === stage.indicators.length &&
    record.checks.every(Boolean)

  const aiReportStatus = aiReportMeta.status || 'not_started'
  const aiReady = aiReportStatus === 'awaiting_supervisor_review' || aiReportStatus === 'ready'
  const [showAiReport, setShowAiReport] = useState(false)

  return (
    <main className="container">
      <section className="hero">
        <div className="eyebrow">
          SUPERVISOR DASHBOARD
        </div>

        <h2>
          Stage {currentStage + 1} Competency Review
        </h2>

        <p>{stage.title}</p>

        <p>
          AI may coach and analyze.
          Only the supervisor approves progression.
        </p>
      </section>

      {!record.submitted && (
        <section
          className="hero"
          style={{ marginTop: 25 }}
        >
          <h3>No submission waiting</h3>

          <p>
            The student has not yet submitted this stage.
          </p>
        </section>
      )}

      {record.submitted && (
        <section
          className="hero"
          style={{ marginTop: 25 }}
        >
          <div className="review-section">
            <h3>Stage title</h3>
            <p>
              <strong>{stage.title}</strong>
            </p>
          </div>

          <div className="review-section">
            <h3>Supervisor Guide</h3>
            <p>
              <strong>Purpose</strong>
              <br />
              {stage.supervisorGuide.purpose}
            </p>
            <p>
              <strong>Competency expected</strong>
              <br />
              {stage.supervisorGuide.competency}
            </p>
            <p>
              <strong>What to look for</strong>
              <br />
              {stage.supervisorGuide.lookFor.join('; ')}
            </p>
            <p>
              <strong>Common problems / red flags</strong>
              <br />
              {stage.supervisorGuide.commonProblems.join('; ')}
            </p>
            <p>
              <strong>Evidence expected</strong>
              <br />
              {stage.supervisorGuide.evidenceExpected.join('; ')}
            </p>
            <div className="review-box">
              <strong>Educational example — not a model answer</strong>
              <p>{stage.supervisorGuide.example}</p>
            </div>
          </div>

          <div className="review-section">
            <h3>Student initial attempt</h3>
            <ReadBox text={record.attempt} />
          </div>

          <div className="review-section">
            <h3>AI coaching evidence</h3>
            <ReadBox text={evidence.aiCoaching || 'No AI coaching notes recorded.'} />
          </div>

          <div className="review-section">
            <h3>Student reflection</h3>
            <ReadBox text={record.learning} />
          </div>

          <div className="review-section">
            <h3>Final submission</h3>
            <ReadBox text={record.finalAnswer} />
          </div>

          <div className="review-section">
            <h3>Evidence and references</h3>
            <div className="review-grid">
              <div className="review-box">
                <strong>Initial student attempt</strong>
                <p>{evidence.initialAttempt || 'No supporting evidence recorded.'}</p>
              </div>
              <div className="review-box">
                <strong>Revised / final submission</strong>
                <p>{evidence.finalSubmission || 'No revised evidence recorded.'}</p>
              </div>
              <div className="review-box">
                <strong>References / evidence used</strong>
                <p>{evidence.references || 'No references entered.'}</p>
              </div>
              <div className="review-box">
                <strong>Optional evidence notes</strong>
                <p>{evidence.notes || 'No notes added.'}</p>
              </div>
            </div>
          </div>

          <div className="review-section">
            <h3>AI Readiness Report</h3>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '6px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  background: aiReportStatus === 'failed' ? '#fbe7e6' : aiReportStatus === 'generating_ai_report' ? '#fff4d6' : '#eaf5ee',
                  color: aiReportStatus === 'failed' ? '#8c2d2d' : aiReportStatus === 'generating_ai_report' ? '#8b6500' : '#285b44',
                }}
              >
                {aiReportStatus === 'generating_ai_report'
                  ? 'Generating'
                  : aiReportStatus === 'failed'
                    ? 'Failed'
                    : aiReportStatus === 'awaiting_supervisor_review' || aiReportStatus === 'ready'
                      ? 'Ready'
                      : 'Not started'}
              </span>

              {aiReportStatus === 'failed' && (
                <button onClick={retryAiReport} style={{ background: '#b45a3c' }}>
                  Retry AI Report
                </button>
              )}

              {aiReady && (
                <button onClick={() => {
                  setShowAiReport((value) => !value)
                  if (!showAiReport) {
                    updateRecord(currentStage, { activityAction: 'Supervisor viewed AI report' })
                  }
                }}>
                  {showAiReport ? 'Hide AI Report' : 'View AI Report'}
                </button>
              )}
            </div>

            {aiReportStatus === 'generating_ai_report' && (
              <p>Generating AI readiness report...</p>
            )}

            {aiReportStatus === 'failed' && (
              <p>AI report generation failed — retry available</p>
            )}

            {showAiReport && aiReady && (
              <div style={{ background: '#f6f8fb', border: '1px solid #dfe5ec', borderRadius: 10, padding: 18, textAlign: 'left' }}>
                <h4>Stage Summary</h4>
                <p>{aiReport.stageSummary || 'No stage summary available.'}</p>

                <h4>Progression</h4>
                <p><strong>Initial reasoning:</strong> {aiReport.progressionAnalysis?.initialReasoning || 'No initial reasoning available.'}</p>
                <p><strong>Final reasoning:</strong> {aiReport.progressionAnalysis?.finalReasoning || 'No final reasoning available.'}</p>
                <p><strong>Demonstrated improvement:</strong> {aiReport.progressionAnalysis?.demonstratedImprovement || 'No improvement summary available.'}</p>

                <h4>Competency Indicator Analysis</h4>
                {(aiReport.indicatorAssessment || []).map((item, index) => (
                  <div key={`${item.indicator}-${index}`} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #dfe5ec' }}>
                    <p><strong>{item.indicator}</strong> — {item.status}</p>
                    <p><strong>Supporting evidence:</strong> {item.supportingEvidence || 'No supporting evidence recorded.'}</p>
                    <p><strong>Remaining gap:</strong> {item.remainingGap || 'No remaining gap recorded.'}</p>
                  </div>
                ))}

                <h4>Evidence strengths</h4>
                <ul>
                  {(aiReport.evidenceAssessment?.strengths || []).map((entry, index) => <li key={`strength-${index}`}>{entry}</li>)}
                  {(aiReport.evidenceAssessment?.strengths || []).length === 0 && <li>No strengths recorded.</li>}
                </ul>

                <h4>Missing evidence</h4>
                <ul>
                  {(aiReport.evidenceAssessment?.missingEvidence || []).map((entry, index) => <li key={`missing-${index}`}>{entry}</li>)}
                  {(aiReport.evidenceAssessment?.missingEvidence || []).length === 0 && <li>No missing evidence recorded.</li>}
                </ul>

                <h4>Unsupported assumptions</h4>
                <ul>
                  {(aiReport.evidenceAssessment?.unsupportedAssumptions || []).map((entry, index) => <li key={`assumption-${index}`}>{entry}</li>)}
                  {(aiReport.evidenceAssessment?.unsupportedAssumptions || []).length === 0 && <li>No unsupported assumptions recorded.</li>}
                </ul>

                <h4>Remaining work</h4>
                <ul>
                  {(aiReport.remainingWork || []).map((entry, index) => <li key={`work-${index}`}>{entry}</li>)}
                  {(aiReport.remainingWork || []).length === 0 && <li>No remaining work listed.</li>}
                </ul>

                <h4>Items needing supervisor attention</h4>
                <ul>
                  {(aiReport.supervisorAttention || []).map((entry, index) => <li key={`attention-${index}`}>{entry}</li>)}
                  {(aiReport.supervisorAttention || []).length === 0 && <li>No special attention items listed.</li>}
                </ul>

                <h4>Suggested supervisor questions</h4>
                <ul>
                  {(aiReport.suggestedSupervisorQuestions || []).map((entry, index) => <li key={`question-${index}`}>{entry}</li>)}
                  {(aiReport.suggestedSupervisorQuestions || []).length === 0 && <li>No questions suggested.</li>}
                </ul>

                <h4>Readiness for supervisor review</h4>
                <p>{aiReport.readinessForReview || 'insufficient_submission'}</p>

                <p><strong>AI advisory only — Supervisor decision required.</strong></p>
                <p>{aiReport.advisoryStatement || 'The AI report is advisory only. The supervisor retains sole authority to determine competency and progression.'}</p>
              </div>
            )}

            {!aiReady && aiReportStatus !== 'failed' && aiReportStatus !== 'generating_ai_report' && (
              <p className="small-note">
                The AI report is advisory only. The supervisor retains sole authority to determine competency and progression.
              </p>
            )}
          </div>

          <div className="review-section">
            <h3>Competency indicators</h3>

            <div
              style={{
                textAlign: 'left',
                maxWidth: 750,
                margin: '20px auto',
              }}
            >
              {stage.indicators.map(
                (indicator, index) => (
                  <label
                    key={indicator}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '12px 0',
                      borderBottom:
                        '1px solid #e1e6ec',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={record.checks[index] || false}
                      onChange={(e) => {
                        const next = [...record.checks]

                        next[index] = e.target.checked

                        updateRecord(currentStage, { checks: next })
                      }}
                    />

                    {indicator}
                  </label>
                )
              )}
            </div>
          </div>

          <div className="review-section">
            <h3>Supervisor feedback</h3>

            <textarea
              value={record.supervisorFeedback}
              onChange={(e) =>
                updateRecord(currentStage, {
                  supervisorFeedback: e.target.value,
                })
              }
              placeholder="Feedback or revision guidance..."
              style={textareaStyle}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 12,
              marginTop: 20,
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={approveStage}
              disabled={!allIndicatorsChecked}
              style={{
                background: '#39785e',
                opacity: allIndicatorsChecked ? 1 : 0.7,
              }}
            >
              Approve competency
            </button>

            <button
              onClick={returnForRevision}
              style={{
                background: '#b45a3c',
              }}
            >
              Return for revision
            </button>
          </div>

          <p style={{ marginTop: 20 }}>
            Approval requires all competency indicators to be checked.
          </p>
        </section>
      )}
    </main>
  )
}

function ReadBox({ text }) {
  return (
    <div
      style={{
        background: '#f6f8fb',
        border: '1px solid #e0e6ec',
        borderRadius: 10,
        padding: 18,
        marginBottom: 20,
        textAlign: 'left',
        whiteSpace: 'pre-wrap',
      }}
    >
      {text || 'No content submitted.'}
    </div>
  )
}

const textareaStyle = {
  width: '100%',
  minHeight: 120,
  padding: 15,
  marginTop: 12,
  borderRadius: 9,
  border: '1px solid #ccd6e0',
  fontSize: 15,
  fontFamily: 'inherit',
}

const hrStyle = {
  margin: '30px 0',
  border: 0,
  borderTop: '1px solid #e0e6ec',
}

export default App