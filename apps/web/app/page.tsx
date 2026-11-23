import { APP_NAME } from "@askwell/shared";
import { PLAN_LIMITS } from "../components/landing/plan-limits";

const steps = [
  ["Add your knowledge", "Upload a PDF or paste in your product information."],
  ["Install the widget", "Paste a single script tag into your website."],
  ["Answer visitor questions", "The chat answers using the information you added."],
];

const comparison = [
  ["Projects", PLAN_LIMITS.free.projects, PLAN_LIMITS.pro.projects],
  ["Monthly messages per project", PLAN_LIMITS.free.messagesPerMonth, PLAN_LIMITS.pro.messagesPerMonth],
  ["Knowledge sources per project", PLAN_LIMITS.free.knowledgeSources, PLAN_LIMITS.pro.knowledgeSources],
  ["Button color", "Default", "Any"],
  ["Button position", "Bottom right", "Any corner"],
  ["Button label", "Default", "Custom"],
  ["Open animation", "Fade", "Fade / slide / scale"],
  ["Header text", "Default", "Custom"],
  ["Powered by badge", "Shown", "Hidden"],
];

const installSnippet = '<script src="…/widget.js" data-key="pk_…"></script>';

export default function Home() {
  return (
    <div className="landing" id="top">
      <header className="landing-shell landing-nav">
        <a className="landing-brand" href="#top">{APP_NAME}</a>
        <nav aria-label="Main navigation">
          <a className="landing-nav-secondary" href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          <a className="landing-button landing-button-outline" href="/sign-up">Start free</a>
        </nav>
      </header>

      <main>
        <section className="landing-shell landing-hero" aria-labelledby="hero-title">
          <div className="landing-hero-copy">
            <p className="landing-label">AI support chat</p>
            <h1 id="hero-title">Give visitors an answer when they ask.</h1>
            <p className="landing-description">Turn your product docs into an AI support widget that answers questions right on your website.</p>
            <div className="landing-actions">
              <a className="landing-button" href="/sign-up">Start free <span aria-hidden="true">↗</span></a>
              <a className="landing-link" href="#install">See how to install <span aria-hidden="true">↓</span></a>
            </div>
          </div>

          <figure className="landing-demo" aria-labelledby="demo-caption">
            <figcaption className="landing-demo-caption" id="demo-caption">
              <span className="landing-demo-dots" aria-hidden="true">● ● ●</span>
              Example conversation
            </figcaption>
            <div className="landing-demo-stage">
              <div className="landing-chat">
                <div className="landing-chat-header">
                  <span className="landing-chat-icon" aria-hidden="true">✦</span>
                  <span><strong>Store assistant</strong><small>Product support</small></span>
                </div>
                <div className="landing-chat-messages">
                  <p className="landing-chat-question">Can I return an item I bought online?</p>
                  <p className="landing-chat-answer">Yes. You can return unused items within 30 days. Open your order confirmation and select “Start a return.”</p>
                </div>
                <div className="landing-chat-footer">Powered by {APP_NAME}</div>
              </div>
            </div>
          </figure>
        </section>

        <section className="landing-shell landing-section" id="how-it-works" aria-labelledby="steps-title">
          <h2 id="steps-title">How it works</h2>
          <ol className="landing-steps">
            {steps.map(([title, description], index) => (
              <li key={title}>
                <span className="landing-step-number" aria-hidden="true">{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-shell landing-section landing-pricing" id="pricing" aria-labelledby="pricing-title">
          <h2 id="pricing-title">Compare plans</h2>
          <div className="landing-table">
            <table aria-labelledby="pricing-title">
              <thead>
                <tr>
                  <th scope="col">Features</th>
                  <th scope="col">Free</th>
                  <th scope="col">Pro</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map(([feature, free, pro]) => (
                  <tr key={feature}>
                    <th scope="row">{feature}</th>
                    <td>{free.toLocaleString("en-US")}</td>
                    <td>{pro.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a className="landing-button" href="/sign-up">Start free <span aria-hidden="true">↗</span></a>
        </section>

        <section className="landing-shell landing-section" id="install" aria-labelledby="install-title">
          <div className="landing-install">
            <div>
              <h2 id="install-title">Install with one line</h2>
              <p>Copy the script from your project and paste it into your site’s HTML.</p>
            </div>
            <pre><code>{installSnippet}</code></pre>
          </div>
        </section>
      </main>

      <footer className="landing-shell landing-footer">
        <a className="landing-brand" href="#top">{APP_NAME}</a>
        <a href="#pricing">Pricing</a>
      </footer>
    </div>
  );
}
