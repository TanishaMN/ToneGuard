import { useState } from "react"
import "./App.css"

const TONE_CONFIG = {
  anger: { color: "#f43f5e", bg: "#fff1f2", label: "Anger" },
  passive_aggressive: { color: "#f97316", bg: "#fff7ed", label: "Passive Aggressive" },
  sarcasm: { color: "#f59e0b", bg: "#fefce8", label: "Sarcasm" },
  warmth: { color: "#22c55e", bg: "#f0fdf4", label: "Warmth" },
  neutral: { color: "#94a3b8", bg: "#f8fafc", label: "Neutral" },
  assertive: { color: "#3b82f6", bg: "#eff6ff", label: "Assertive" },
}

function TonePill({ tone, score }) {
  const config = TONE_CONFIG[tone]
  if (!config || score < 0.5) return null
  return (
    <span className="tone-pill" style={{ background: config.bg, color: config.color, border: `1px solid ${config.color}40` }}>
      {config.label} {Math.round(score * 100)}%
    </span>
  )
}

function ToneBar({ tone, score }) {
  const config = TONE_CONFIG[tone]
  if (!config) return null
  return (
    <div className="tone-bar-row">
      <span className="tone-bar-label">{config.label}</span>
      <div className="tone-bar-track">
        <div className="tone-bar-fill" style={{ width: `${score * 100}%`, background: config.color }} />
      </div>
      <span className="tone-bar-score">{Math.round(score * 100)}%</span>
    </div>
  )
}

function Demo() {
  const [text, setText] = useState("")
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const tones = ["anger", "passive_aggressive", "sarcasm", "warmth", "neutral", "assertive"]

  const analyze = async () => {
    if (!text.trim() || text.length < 10) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch("https://toneguard-api.onrender.com/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, get_suggestions: true })
      })
      if (!r.ok) throw new Error("Backend error")
      const data = await r.json()
      setResult(data)
    } catch (e) {
      setError("Could not reach the backend. Please try again in a moment.")
    }
    setLoading(false)
  }

  const examples = [
    "Why wasn't I told about this meeting? This keeps happening!",
    "Sure, whatever you think is best.",
    "Thank you so much, I really appreciate your help!",
    "Oh great, another pointless meeting.",
  ]

  return (
    <section className="demo-section" id="demo">
      <div className="container">
        <h2 className="section-title">Try it live</h2>
        <p className="section-sub">Type any message and see ToneGuard analyze it in real time</p>

        <div className="demo-banner">
          <span className="demo-banner-icon">🔌</span>
          <span>You are using the web demo. Install the Chrome extension for real-time detection as you type — with one-click message replacement.</span>
        </div>

        <div className="demo-box">
          <div className="demo-examples">
            {examples.map((ex, i) => (
              <button key={i} className="example-btn" onClick={() => setText(ex)}>
                {ex.slice(0, 40)}...
              </button>
            ))}
          </div>

          <textarea
            className="demo-input"
            placeholder="Type your message here..."
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
          />

          <button
            className="analyze-btn"
            onClick={analyze}
            disabled={loading || text.length < 10}
          >
            {loading ? "Analyzing..." : "Analyze Tone"}
          </button>

          {error && <div className="demo-error">{error}</div>}

          {result && (
            <div className="demo-result">
              <div className="result-pills">
                {tones.map(t => <TonePill key={t} tone={t} score={result[t]} />)}
              </div>

              <div className="result-bars">
                {tones.map(t => <ToneBar key={t} tone={t} score={result[t]} />)}
              </div>

              {result.rewrite_1 && (
                <div className="result-suggestions">
                  <div className="suggestions-title">Suggested rewrites</div>
                  {[
                    { text: result.rewrite_1, label: result.rewrite_1_label },
                    { text: result.rewrite_2, label: result.rewrite_2_label },
                    { text: result.rewrite_3, label: result.rewrite_3_label },
                  ].filter(s => s.text).map((s, i) => (
                    <div key={i} className="suggestion-card">
                      <span className="suggestion-tag">{s.label}</span>
                      <p className="suggestion-text">{s.text}</p>
                    </div>
                  ))}

                  <div className="install-note">
                    <span className="install-note-icon">💡</span>
                    <span>Install the Chrome extension to automatically replace your message with one click — works on Gmail, Slack, LinkedIn and more.</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function InstallSection() {
  const steps = [
    {
      num: "01",
      title: "Download the code",
      desc: <>Go to <a href="https://github.com/TanishaMN/ToneGuard" target="_blank" rel="noreferrer" className="install-link" style={{ color: "#ffffff" }}>github.com/TanishaMN/ToneGuard</a> → click the green <strong>Code</strong> button → <strong>Download ZIP</strong> → Extract it</>
    },
    {
      num: "02",
      title: "Open Chrome Extensions",
      desc: <>Type <strong>chrome://extensions</strong> in your Chrome address bar and press Enter</>
    },
    {
      num: "03",
      title: "Enable Developer Mode",
      desc: <>Toggle <strong>Developer mode</strong> ON in the top right corner</>
    },
    {
      num: "04",
      title: "Load the extension",
      desc: <>Click <strong>Load unpacked</strong> → Select the <strong>extension</strong> folder from the extracted ZIP</>
    },
    {
      num: "05",
      title: "Pin ToneGuard",
      desc: <>Click the puzzle piece icon in your Chrome toolbar → Pin <strong>ToneGuard</strong></>
    },
    {
      num: "06",
      title: "You're done!",
      desc: <>Open <strong>Gmail</strong> and type any message. Wait 2.5 seconds — ToneGuard appears automatically.</>
    },
  ]

  return (
    <section className="install-section" id="install">
      <div className="container">
        <h2 className="section-title">Install ToneGuard</h2>
        <p className="section-sub">Free forever · No account needed · Takes 2 minutes</p>
        <div className="steps-grid">
          {steps.map((s, i) => (
            <div key={i} className="step-card">
              <div className="step-num">{s.num}</div>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="install-cta" style={{ marginTop: "2 rem" }}>
          <a
            href="https://github.com/TanishaMN/ToneGuard"
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
            style={{ color: "#ffffff" }}
          >
            Download from GitHub
          </a>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <div className="app">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-inner">
          <span className="nav-logo">ToneGuard</span>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#install">Install</a>
          </div>
          <a href="#demo" className="nav-cta">Try Demo</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero-badge">AI-Powered Communication Coach</div>
          <h1 className="hero-title">
            Stop sending messages<br />
            <span className="gradient-text">you'll regret</span>
          </h1>
          <p className="hero-sub">
            ToneGuard detects anger, sarcasm, and passive-aggression in your messages
            before you hit send — and rewrites them professionally in seconds.
          </p>
          <div className="hero-btns">
            <a href="#demo" className="btn-primary">Try Live Demo</a>
            <a href="#how" className="btn-secondary">How it works</a>
          </div>

          {/* Mock extension preview */}
          <div className="hero-preview">
            <div className="preview-bar">
              <span className="preview-logo">TONEGUARD</span>
              <span className="preview-pill anger">Anger 80%</span>
              <span className="preview-pill passive">Passive Aggressive 70%</span>
            </div>
            <div className="preview-suggestion">
              <span className="preview-tag">Professional</span>
              <p>"I would appreciate being included in future meetings. Could we discuss a better communication process?"</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how-section" id="how">
        <div className="container">
          <h2 className="section-title">How it works</h2>
          <p className="section-sub">Three simple steps to better communication</p>
          <div className="steps-grid">
            {[
              {
                num: "01",
                title: "Type your message",
                desc: "Write your email, Slack message, or LinkedIn reply as you normally would."
              },
              {
                num: "02",
                title: "ToneGuard analyzes",
                desc: "Our AI instantly detects anger, sarcasm, passive-aggression, warmth and more."
              },
              {
                num: "03",
                title: "Send with confidence",
                desc: "Choose from 3 professionally rewritten alternatives. Click 'Use this' in the extension to instantly replace your message — no copy-paste needed."
              },
            ].map((s, i) => (
              <div key={i} className="step-card">
                <div className="step-num">{s.num}</div>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Demo */}
      <Demo />

      {/* Features */}
      <section className="features-section" id="features">
        <div className="container">
          <h2 className="section-title">Everything you need</h2>
          <p className="section-sub">Built for professionals who communicate every day</p>
          <div className="features-grid">
            {[
              { title: "Real-time detection", desc: "Analyzes your tone as you type — no button needed." },
              { title: "6 tone categories", desc: "Detects anger, sarcasm, passive-aggression, warmth, neutral and assertive." },
              { title: "3 rewrite styles", desc: "Get Professional, Friendly, and Concise versions of your message." },
              { title: "Works everywhere", desc: "Gmail, Slack, LinkedIn, Twitter, WhatsApp Web and more." },
              { title: "Privacy first", desc: "Tone detection runs on-device. Your messages never leave your browser." },
              { title: "Powered by Llama 3", desc: "Meta's latest AI model understands nuance, context and intent." },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Installation Instructions */}
      <InstallSection />

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <span className="footer-logo">ToneGuard</span>
          <p className="footer-text">Communicate better with AI — free forever.</p>
          <a
            href="https://github.com/TanishaMN/ToneGuard"
            target="_blank"
            rel="noreferrer"
            className="footer-link"
          >
            GitHub →
          </a>
        </div>
      </footer>
    </div>
  )
}