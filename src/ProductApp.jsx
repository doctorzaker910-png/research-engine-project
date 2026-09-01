import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { stages } from './App.jsx'
import { supabase } from './supabase.js'

const blankWork = (caseId, stageNumber) => ({
  case_id: caseId,
  stage_number: stageNumber,
  initial_attempt: '',
  attempt_submitted: false,
  ai_coaching: '',
  learning_reflection: '',
  final_submission: '',
  references_used: '',
  evidence_notes: '',
  submitted_at: null,
  ai_report: null,
  ai_report_status: 'not_started',
})

function ProductApp() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    supabase.from('rae_profiles').select('*').eq('id', session.user.id).single()
      .then(({ data, error }) => {
        if (error) setNotice(error.message)
        setProfile(data || null)
        setLoading(false)
      })
  }, [session?.user?.id])

  if (loading) return <PageMessage title="Loading RAE…" />
  if (!session) return <AuthScreen notice={notice} setNotice={setNotice} />
  if (!profile) return <PageMessage title="Preparing your account…" detail={notice || 'Refresh after confirming your email.'} />

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <h1>RAE Research Engine</h1>
          <p>Student work → AI coaching → evidence → human supervisor approval</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong>{profile.full_name || session.user.email}</strong>
          <p style={{ margin: '3px 0 8px' }}>{profile.role}</p>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>
      {notice && <div className="container"><div className="review-box">{notice}</div></div>}
      {profile.role === 'student'
        ? <StudentWorkspace session={session} profile={profile} setNotice={setNotice} />
        : <SupervisorWorkspace session={session} profile={profile} setNotice={setNotice} />}
      <footer className="footer">RAE · AI is advisory only · Only the assigned human supervisor approves progression</footer>
    </div>
  )
}

function AuthScreen({ notice, setNotice }) {
  const [signup, setSignup] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    const result = signup
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (result.error) setNotice(result.error.message)
    else if (signup && !result.data.session) setNotice('Account created. Check your email to confirm, then sign in.')
  }

  return (
    <div className="app">
      <header className="header"><div className="brand"><h1>RAE Research Engine</h1><p>Research competency learning with human supervision</p></div></header>
      <main className="container">
        <section className="hero">
          <div className="eyebrow">SECURE ACCESS</div>
          <h2>{signup ? 'Create student account' : 'Sign in'}</h2>
          <p>Students and supervisors use separate accounts. A student can never approve their own competency.</p>
          {notice && <div className="review-box">{notice}</div>}
          <form onSubmit={submit} style={{ maxWidth: 520, margin: '20px auto', textAlign: 'left' }}>
            {signup && <label><strong>Full name</strong><input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} style={inputStyle} /></label>}
            <label><strong>Email</strong><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} /></label>
            <label><strong>Password</strong><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={inputStyle} /></label>
            <button disabled={busy} style={{ width: '100%', marginTop: 12 }}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</button>
          </form>
          <button onClick={() => { setSignup(!signup); setNotice('') }} style={{ background: '#667085' }}>{signup ? 'I already have an account' : 'Create student account'}</button>
          <div className="review-box" style={{ marginTop: 22, textAlign: 'left' }}>
            <strong>Privacy and AI notice</strong>
            <p>Do not enter patient names, medical record numbers, phone numbers, or confidential clinical data. Submitted learning work is analyzed by AI to generate advisory feedback for the assigned supervisor. The supervisor alone decides competency and progression.</p>
          </div>
        </section>
      </main>
    </div>
  )
}

function StudentWorkspace({ session, profile, setNotice }) {
  const [cases, setCases] = useState([])
  const [active, setActive] = useState(null)
  const [supervisor, setSupervisor] = useState(null)
  const [creating, setCreating] = useState(false)
  const [studentName, setStudentName] = useState(profile.full_name || '')
  const [topic, setTopic] = useState('')

  async function load() {
    const [{ data: caseRows, error }, { data: supervisors }] = await Promise.all([
      supabase.from('rae_cases').select('*').order('updated_at', { ascending: false }),
      supabase.from('rae_profiles').select('id,full_name').eq('role', 'supervisor').limit(1),
    ])
    if (error) setNotice(error.message)
    setCases(caseRows || [])
    setSupervisor(supervisors?.[0] || null)
  }
  useEffect(() => { load() }, [])

  async function createCase(event) {
    event.preventDefault()
    if (!supervisor) return setNotice('No supervisor is available. Contact the programme administrator.')
    const { data, error } = await supabase.from('rae_cases').insert({ student_id: session.user.id, supervisor_id: supervisor.id, student_name: studentName.trim(), research_topic: topic.trim() }).select().single()
    if (error) return setNotice(error.message)
    await supabase.from('rae_audit_events').insert({ case_id: data.id, actor_id: session.user.id, action: 'case_created' })
    setCreating(false); setTopic(''); setActive(data); await load()
  }

  if (active) return <StudentCase session={session} caseItem={active} onBack={() => { setActive(null); load() }} setNotice={setNotice} />
  return (
    <main className="container">
      <section className="hero"><div className="eyebrow">STUDENT DASHBOARD</div><h2>Your research pathways</h2><p>Your work is saved centrally and shared only with your assigned supervisor.</p><button onClick={() => setCreating(!creating)}>+ New research pathway</button></section>
      {creating && <section className="hero" style={{ marginTop: 20 }}><form onSubmit={createCase} style={{ maxWidth: 650, margin: 'auto', textAlign: 'left' }}><label><strong>Student name</strong><input value={studentName} onChange={(e) => setStudentName(e.target.value)} required minLength={2} style={inputStyle} /></label><label><strong>Research topic</strong><textarea value={topic} onChange={(e) => setTopic(e.target.value)} required minLength={5} placeholder="Enter the research topic clearly" style={textareaStyle} /></label><button>Create pathway</button></form></section>}
      <section className="grid">{cases.map((item) => <article className="card" key={item.id}><div className="card-number">R</div><h4>{item.research_topic}</h4><p>{item.student_name}</p><p>{item.status}</p><button onClick={() => setActive(item)}>Open pathway</button></article>)}{cases.length === 0 && <article className="card"><h4>No pathways yet</h4><p>Create the first pathway to begin.</p></article>}</section>
    </main>
  )
}

function StudentCase({ session, caseItem, onBack, setNotice }) {
  const [workRows, setWorkRows] = useState([])
  const [reviews, setReviews] = useState([])
  const [work, setWork] = useState(blankWork(caseItem.id, 1))
  const [busy, setBusy] = useState(false)
  const approved = useMemo(() => new Set(reviews.filter((r) => r.decision === 'approved').map((r) => r.stage_number)), [reviews])
  const currentStage = Math.min(approved.size + 1, 14)
  const stage = stages[currentStage - 1]
  const review = reviews.find((r) => r.stage_number === currentStage)

  async function load() {
    const [{ data: works }, { data: reviewRows }] = await Promise.all([
      supabase.from('rae_stage_work').select('*').eq('case_id', caseItem.id),
      supabase.from('rae_supervisor_reviews').select('*').eq('case_id', caseItem.id),
    ])
    setWorkRows(works || []); setReviews(reviewRows || [])
  }
  useEffect(() => { load() }, [caseItem.id])
  useEffect(() => { setWork(workRows.find((r) => r.stage_number === currentStage) || blankWork(caseItem.id, currentStage)) }, [workRows, currentStage, caseItem.id])

  async function save(patch = {}, silent = false) {
    const next = { ...work, ...patch, updated_at: new Date().toISOString() }
    setWork(next)
    const { error } = await supabase.from('rae_stage_work').upsert(next, { onConflict: 'case_id,stage_number' })
    if (error) setNotice(error.message); else if (!silent) setNotice('Saved securely.')
    await load()
    return !error
  }

  async function submit() {
    if (!work.attempt_submitted || !work.initial_attempt.trim() || !work.learning_reflection.trim() || !work.final_submission.trim() || !work.ai_coaching.trim()) return setNotice('Complete the initial attempt, AI coaching record, learning reflection, and final submission before sending.')
    setBusy(true); setNotice('Generating the advisory AI readiness report…')
    await save({ submitted_at: new Date().toISOString(), ai_report_status: 'generating' }, true)
    try {
      const { data: auth } = await supabase.auth.getSession()
      const response = await fetch('/api/readiness-report', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session.access_token}` }, body: JSON.stringify({ caseId: caseItem.id, studentName: caseItem.student_name, researchTopic: caseItem.research_topic, stageNumber: currentStage, stageTitle: stage.title, stageObjective: stage.objective, supervisorGuide: stage.supervisorGuide, competencyIndicators: stage.indicators.map((label) => ({ label })), initialAttempt: work.initial_attempt, studentReflection: work.learning_reflection, finalSubmission: work.final_submission, evidence: { aiCoaching: work.ai_coaching, references: work.references_used, notes: work.evidence_notes } }) })
      const report = await response.json()
      if (!response.ok) throw new Error(report.error || 'AI report failed')
      await save({ submitted_at: new Date().toISOString(), ai_report_status: 'ready', ai_report: report }, true)
      await supabase.from('rae_audit_events').insert({ case_id: caseItem.id, stage_number: currentStage, actor_id: session.user.id, action: 'submitted_for_review' })
      setNotice('Submitted. Your assigned supervisor can now review this stage.')
    } catch (error) {
      await save({ submitted_at: new Date().toISOString(), ai_report_status: 'failed' }, true)
      setNotice(`Submitted, but the AI report failed: ${error.message}. You can retry.`)
    }
    setBusy(false); await load()
  }

  if (approved.size === 14) return <main className="container"><section className="hero"><div className="eyebrow">PATHWAY COMPLETED</div><h2>14 / 14 competencies approved</h2><p>Your human supervisor approved every stage.</p><button onClick={onBack}>Back to dashboard</button></section></main>
  const awaiting = Boolean(work.submitted_at) && (!review || new Date(work.submitted_at) > new Date(review.reviewed_at))
  return (
    <main className="container">
      <button onClick={onBack} style={{ marginBottom: 15 }}>← Dashboard</button>
      <section className="hero"><div className="eyebrow">STAGE {currentStage} OF 14</div><h2>{stage.title}</h2><p>{stage.objective}</p><p><strong>Topic:</strong> {caseItem.research_topic}</p></section>
      {review?.decision === 'revision' && <div className="review-box" style={{ marginTop: 18 }}><strong>Returned for revision</strong><p>{review.feedback}</p></div>}
      {awaiting ? <section className="hero" style={{ marginTop: 20 }}><h3>Awaiting supervisor review</h3><p>Your submission is saved. AI report: {work.ai_report_status}.</p>{work.ai_report_status === 'failed' && <button onClick={submit} disabled={busy}>Retry AI report</button>}</section> :
      <section className="hero" style={{ marginTop: 20, textAlign: 'left' }}>
        <h3>1. Think first — without AI</h3><p>{stage.question}</p><textarea value={work.initial_attempt} onChange={(e) => setWork({ ...work, initial_attempt: e.target.value })} style={textareaStyle} /><button onClick={() => save({ attempt_submitted: true })}>Save initial attempt</button>
        <h3>2. AI coaching</h3><div className="review-box"><p>{stage.aiPrompt}</p></div><textarea value={work.ai_coaching} onChange={(e) => setWork({ ...work, ai_coaching: e.target.value })} placeholder="Record the coaching questions and feedback you used" style={textareaStyle} />
        <h3>3. What did you learn?</h3><textarea value={work.learning_reflection} onChange={(e) => setWork({ ...work, learning_reflection: e.target.value })} style={textareaStyle} />
        <h3>4. Final submission</h3><textarea value={work.final_submission} onChange={(e) => setWork({ ...work, final_submission: e.target.value })} style={{ ...textareaStyle, minHeight: 170 }} />
        <h3>5. Evidence and learning log</h3><div className="review-box"><strong>Evidence expected</strong><ul>{stage.evidenceRequirements.map((entry) => <li key={entry}>{entry}</li>)}</ul></div><textarea value={work.references_used} onChange={(e) => setWork({ ...work, references_used: e.target.value })} placeholder="References, DOI, PMID, URLs, datasets or source description" style={textareaStyle} /><textarea value={work.evidence_notes} onChange={(e) => setWork({ ...work, evidence_notes: e.target.value })} placeholder="Evidence notes" style={textareaStyle} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button onClick={() => save()}>Save draft</button><button onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit for supervisor review'}</button></div>
      </section>}
      <section className="grid">{stages.map((item, index) => <article className="card" key={item.title} style={{ opacity: index + 1 > currentStage ? .5 : 1 }}><div className="card-number">{approved.has(index + 1) ? '✓' : index + 1}</div><h4>{item.title}</h4><p>{approved.has(index + 1) ? 'Approved by supervisor' : index + 1 === currentStage ? 'Current stage' : 'Locked'}</p></article>)}</section>
    </main>
  )
}

function SupervisorWorkspace({ session, setNotice }) {
  const [cases, setCases] = useState([])
  const [active, setActive] = useState(null)
  async function load() { const { data, error } = await supabase.from('rae_cases').select('*').order('updated_at', { ascending: false }); if (error) setNotice(error.message); setCases(data || []) }
  useEffect(() => { load() }, [])
  if (active) return <SupervisorCase session={session} caseItem={active} onBack={() => { setActive(null); load() }} setNotice={setNotice} />
  return <main className="container"><section className="hero"><div className="eyebrow">SUPERVISOR DASHBOARD</div><h2>Assigned research pathways</h2><p>Only your assigned cases are visible.</p></section><section className="grid">{cases.map((item) => <article className="card" key={item.id}><div className="card-number">S</div><h4>{item.student_name}</h4><p>{item.research_topic}</p><button onClick={() => setActive(item)}>Review pathway</button></article>)}{cases.length === 0 && <article className="card"><h4>No assigned submissions</h4></article>}</section></main>
}

function SupervisorCase({ session, caseItem, onBack, setNotice }) {
  const [works, setWorks] = useState([])
  const [reviews, setReviews] = useState([])
  const [checks, setChecks] = useState([])
  const [feedback, setFeedback] = useState('')
  async function load() { const [{ data: w }, { data: r }] = await Promise.all([supabase.from('rae_stage_work').select('*').eq('case_id', caseItem.id), supabase.from('rae_supervisor_reviews').select('*').eq('case_id', caseItem.id)]); setWorks(w || []); setReviews(r || []) }
  useEffect(() => { load() }, [caseItem.id])
  const approvedCount = reviews.filter((r) => r.decision === 'approved').length
  const stageNumber = Math.min(approvedCount + 1, 14)
  const stage = stages[stageNumber - 1]
  const work = works.find((w) => w.stage_number === stageNumber)
  const existingReview = reviews.find((r) => r.stage_number === stageNumber)
  const hasPendingSubmission = Boolean(work?.submitted_at) && (!existingReview || new Date(work.submitted_at) > new Date(existingReview.reviewed_at))
  useEffect(() => { setChecks(stage.indicators.map(() => false)); setFeedback('') }, [stageNumber])
  async function decide(decision) {
    if (!hasPendingSubmission) return setNotice('No new student submission is waiting.')
    if (decision === 'approved' && !checks.every(Boolean)) return setNotice('Check every competency indicator before approval.')
    if (decision === 'revision' && !feedback.trim()) return setNotice('Write clear revision guidance first.')
    const { error } = await supabase.from('rae_supervisor_reviews').upsert({ case_id: caseItem.id, stage_number: stageNumber, supervisor_id: session.user.id, decision, indicators: checks, feedback, reviewed_at: new Date().toISOString() }, { onConflict: 'case_id,stage_number' })
    if (error) return setNotice(error.message)
    await supabase.from('rae_audit_events').insert({ case_id: caseItem.id, stage_number: stageNumber, actor_id: session.user.id, action: decision === 'approved' ? 'competency_approved' : 'returned_for_revision' })
    setNotice(decision === 'approved' ? 'Competency approved. The next stage is now open.' : 'Returned to the student for revision.')
    await load()
  }
  if (approvedCount === 14) return <main className="container"><section className="hero"><h2>Pathway completed</h2><p>All 14 competencies were approved.</p><button onClick={onBack}>Back</button></section></main>
  return <main className="container"><button onClick={onBack}>← Dashboard</button><section className="hero" style={{ marginTop: 15 }}><div className="eyebrow">SUPERVISOR · STAGE {stageNumber}</div><h2>{stage.title}</h2><p>{caseItem.student_name} · {caseItem.research_topic}</p><p>AI is advisory. Your documented human judgment controls progression.</p></section>{!hasPendingSubmission ? <section className="hero" style={{ marginTop: 20 }}><h3>No new submission waiting</h3></section> : <section className="hero" style={{ marginTop: 20, textAlign: 'left' }}><h3>Initial attempt</h3><ReadBox text={work.initial_attempt} /><h3>AI coaching evidence</h3><ReadBox text={work.ai_coaching} /><h3>Student reflection</h3><ReadBox text={work.learning_reflection} /><h3>Final submission</h3><ReadBox text={work.final_submission} /><h3>References and evidence</h3><ReadBox text={`${work.references_used}\n${work.evidence_notes}`} /><h3>AI Readiness Report</h3><ReadBox text={work.ai_report ? JSON.stringify(work.ai_report, null, 2) : `AI report ${work.ai_report_status}`} /><h3>Competency indicators</h3>{stage.indicators.map((label, index) => <label key={label} style={{ display: 'flex', gap: 10, padding: 10 }}><input type="checkbox" checked={checks[index] || false} onChange={(e) => { const next = [...checks]; next[index] = e.target.checked; setChecks(next) }} />{label}</label>)}<h3>Supervisor feedback</h3><textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} style={textareaStyle} /><div style={{ display: 'flex', gap: 10 }}><button onClick={() => decide('approved')}>Approve competency</button><button onClick={() => decide('revision')} style={{ background: '#b45a3c' }}>Return for revision</button></div></section>}</main>
}

function ReadBox({ text }) { return <div className="review-box" style={{ whiteSpace: 'pre-wrap' }}>{text || 'No evidence recorded.'}</div> }
function PageMessage({ title, detail }) { return <main className="container"><section className="hero"><h2>{title}</h2>{detail && <p>{detail}</p>}</section></main> }
const inputStyle = { width: '100%', padding: 13, margin: '8px 0 16px', borderRadius: 8, border: '1px solid #ccd6e0', fontSize: 16 }
const textareaStyle = { ...inputStyle, minHeight: 120, fontFamily: 'inherit' }

export default ProductApp
