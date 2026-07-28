import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div className="marketing">
      <header className="mkt-nav">
        <Link to="/" className="brand-word mkt-logo">
          Samm<span>y</span>
        </Link>
        <nav className="mkt-links">
          <a href="#how">How it works</a>
          <a href="#worlds">Worlds</a>
          <Link to="/login">Sign in</Link>
          <Link className="btn btn-primary mkt-cta" to="/login">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mkt-hero">
        <div className="mkt-hero-media" aria-hidden>
          <video
            className="mkt-hero-video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/sammy-hero-poster.jpg"
          >
            <source src="/sammy-hero.mp4" type="video/mp4" />
          </video>
          <img className="mkt-hero-fallback" src="/sammy-hero.jpg" alt="" />
          <div className="mkt-hero-shade" />
        </div>
        <div className="mkt-hero-copy">
          <p className="kicker mkt-fade">India&apos;s AI casting stage</p>
          <h1 className="brand-word mkt-title mkt-fade delay-1">
            Samm<span>y</span>
          </h1>
          <p className="mkt-sub mkt-fade delay-2">
            Stop forwarding self-tapes on WhatsApp. Cast on scored evidence.
          </p>
          <div className="mkt-actions mkt-fade delay-3">
            <Link className="btn btn-primary" to="/login?role=production">
              I&apos;m casting
            </Link>
            <Link className="btn btn-secondary" to="/login?role=talent">
              I&apos;m auditioning
            </Link>
          </div>
        </div>
      </section>

      <section className="mkt-section" id="how">
        <p className="kicker">How Sammy works</p>
        <h2 className="h1">One thread. Scored tapes. Clear invites.</h2>
        <div className="mkt-steps">
          <article>
            <span>01</span>
            <h3>Post the role</h3>
            <p>Brief, script, deadline, and visibility rules live in a single audition thread.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Score every take</h3>
            <p>Sammy Intelligence ranks delivery, timing, expression, accuracy, and presence.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Grow reputation</h3>
            <p>Talent earn a portable Sammy Score studios can trust beyond one tape.</p>
          </article>
        </div>
      </section>

      <section className="mkt-section" id="worlds">
        <p className="kicker">Two logins</p>
        <h2 className="h1">Built for the job you actually do.</h2>
        <div className="mkt-worlds">
          <Link className="mkt-world" to="/login?role=production">
            <p className="kicker">Production</p>
            <h3>Fill roles faster</h3>
            <p>Dashboard, threads, AI shortlist, and invites — without drowning in raw self-tapes.</p>
            <span className="mkt-world-go">Continue as production →</span>
          </Link>
          <Link className="mkt-world" to="/login?role=talent">
            <p className="kicker">Talent</p>
            <h3>Audition with feedback</h3>
            <p>Discover calls, record with a teleprompter, get coached scores, climb the board.</p>
            <span className="mkt-world-go">Continue as talent →</span>
          </Link>
        </div>
      </section>

      <footer className="mkt-foot">
        <div className="brand-word">
          Samm<span>y</span>
        </div>
        <p>Every audition evaluated on craft — not who forwarded your tape.</p>
      </footer>
    </div>
  )
}
