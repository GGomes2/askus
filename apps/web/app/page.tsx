import { APP_NAME, PLAN_LIMITS, WIDGET_POSITIONS } from "@askwell/shared";

const steps = [
  ["Add your knowledge", "Upload a PDF or paste in your product information."],
  ["Install the widget", "Paste a single script tag into your website."],
  ["Answer visitor questions", "The chat answers using the information you added."],
];

function planValues({ projects, messagesPerMonth, knowledgeSources, widget }: (typeof PLAN_LIMITS)["free"]) {
  const positions = widget.positions.length === WIDGET_POSITIONS.length
    ? "Any corner"
    : widget.positions.map(position => position.replace("-", " ")).join(" / ");

  return [
    projects.toLocaleString("en-US"),
    messagesPerMonth.toLocaleString("en-US"),
    knowledgeSources.toLocaleString("en-US"),
    widget.customButtonColor ? "Any" : "Default",
    positions.charAt(0).toUpperCase() + positions.slice(1),
    widget.customLabel ? "Custom" : "Default",
    widget.animations.map((animation, index) => index === 0
      ? animation.charAt(0).toUpperCase() + animation.slice(1)
      : animation).join(" / "),
    widget.customHeaderText ? "Custom" : "Default",
    widget.canHideBadge ? "Hidden" : "Shown",
  ] as const;
}

const comparison = [
  "Projects",
  "Monthly messages per project",
  "Knowledge sources per project",
  "Button color",
  "Button position",
  "Button label",
  "Open animation",
  "Header text",
  "Powered by badge",
] as const;

const freeValues = planValues(PLAN_LIMITS.free);
const proValues = planValues(PLAN_LIMITS.pro);

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
                {comparison.map((feature, index) => (
                  <tr key={feature}>
                    <th scope="row">{feature}</th>
                    <td>{freeValues[index]}</td>
                    <td>{proValues[index]}</td>
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
