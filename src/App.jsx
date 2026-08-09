import './App.css'

function App() {
  const stages = [
    'Define the research problem',
    'Check feasibility',
    'Formulate the research question',
    'Search the literature',
    'Critically appraise evidence',
    'Map existing evidence',
    'Identify the research gap',
    'Set objectives',
    'Design methodology',
    'Review bias and risks',
    'Build the proposal',
    'Pilot and collect data',
    'Analyze and interpret',
    'Write and publish',
  ]

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <h1>RAE Research Engine</h1>
          <p>Research learning and production with evidence and KPI</p>
        </div>
        <div className="status">Student Pathway</div>
      </header>

      <main className="container">
        <section className="hero">
          <div className="eyebrow">RESEARCH COMPETENCY PATHWAY</div>
          <h2>Learn research by doing research</h2>
          <p>
            A supervised 14-stage pathway where the student thinks first,
            learns with AI, verifies evidence, submits work, and advances only
            after supervisor approval.
          </p>

          <div className="search">
            <input placeholder="Student name or research topic" />
            <button>Start pathway</button>
          </div>
        </section>

        <div className="section-title">
          <h3>14 Research Stages</h3>
          <p>Each stage has a question, indicators, AI coaching and supervisor approval.</p>
        </div>

        <section className="grid">
          {stages.map((stage, index) => (
            <article className="card" key={stage}>
              <div className="card-number">{index + 1}</div>
              <h4>{stage}</h4>
              <p>
                Student attempt → AI coaching → evidence check → final submission
                → supervisor review.
              </p>
            </article>
          ))}
        </section>

        <section className="kpi">
          <h3>Learning Evidence</h3>
          <div className="kpi-grid">
            <div className="kpi-item">
              <strong>14</strong>
              <span>Research stages</span>
            </div>
            <div className="kpi-item">
              <strong>AI</strong>
              <span>Tutor, not approver</span>
            </div>
            <div className="kpi-item">
              <strong>Teacher</strong>
              <span>Competency authority</span>
            </div>
            <div className="kpi-item">
              <strong>Pre / Post</strong>
              <span>Learning measurement</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        RAE Research Engine · Evidence · Learning · Competency · Production
      </footer>
    </div>
  )
}

export default App