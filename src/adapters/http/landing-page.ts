export let LANDING_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kit — Kinetic Intelligence Tool</title>
<meta name="description" content="Kit is a family AI assistant that maintains a human-readable bullet journal. Email it. Text it. It remembers everything.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600&family=JetBrains+Mono:wght@400;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --term-bg: #fafaf8;
  --term-fg: #4a4a48;
  --term-green: #2a7d3f;
  --term-blue: #2563a8;
  --term-amber: #a06b10;
  --term-coral: #c43d42;
  --term-purple: #7c4dbd;
  --term-dim: #a0a09a;
  --term-mid: #71716b;
  --term-bright: #1a1a18;
  --term-border: #e2e2dc;
  --term-surface: #f2f2ee;
  --mono: 'IBM Plex Mono', 'Courier New', monospace;
  --display: 'Space Mono', monospace;
}

html { scroll-behavior: smooth; }
body { font-family: var(--mono); background: var(--term-bg); color: var(--term-fg); }

.page { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; }

.ascii-hero {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0;
  color: var(--term-green);
  text-align: center;
  margin-bottom: 0.5rem;
  white-space: pre;
  font-feature-settings: "liga" 0;
}

.tagline {
  text-align: center;
  font-size: 13px;
  color: var(--term-mid);
  margin-bottom: 2.5rem;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.tagline em { color: var(--term-amber); font-style: normal; }

.prompt-block {
  background: var(--term-surface);
  border: 1px solid var(--term-border);
  border-radius: 6px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
  font-size: 13px;
  line-height: 1.7;
  overflow-x: auto;
}

.prompt-block .ps1 { color: var(--term-green); font-weight: 600; }
.prompt-block .cmd { color: var(--term-bright); }
.prompt-block .output { color: var(--term-fg); }
.prompt-block .flag { color: var(--term-blue); }
.prompt-block .val { color: var(--term-amber); }
.prompt-block .comment { color: var(--term-dim); font-style: italic; }

.prompt-block .kit-reply {
  color: var(--term-fg);
  border-left: 2px solid var(--term-green);
  padding-left: 12px;
  margin: 8px 0;
  display: block;
}

.prompt-block .kit-name { color: var(--term-green); font-weight: 600; }

.section-label {
  font-size: 11px;
  color: var(--term-dim);
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--term-border);
}

.features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 2rem;
}

.feature-card {
  background: var(--term-surface);
  border: 1px solid var(--term-border);
  border-radius: 6px;
  padding: 1rem 1.25rem;
  transition: border-color 0.15s;
}

.feature-card:hover { border-color: var(--term-green); }
.feature-card .icon { font-size: 13px; margin-bottom: 6px; display: block; }
.feature-card h3 { font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--term-bright); margin-bottom: 4px; }
.feature-card p { font-size: 12px; color: var(--term-mid); line-height: 1.5; }

.journal-demo {
  background: var(--term-surface);
  border: 1px solid var(--term-border);
  border-radius: 6px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 2rem;
  font-size: 12px;
  line-height: 1.8;
}

.journal-demo .j-header { color: var(--term-amber); font-weight: 600; font-size: 13px; }
.journal-demo .j-section { color: var(--term-blue); font-weight: 500; }
.journal-demo .j-task { color: var(--term-fg); }
.journal-demo .j-done { color: var(--term-dim); text-decoration: line-through; }
.journal-demo .j-migrated { color: var(--term-purple); }
.journal-demo .j-event { color: var(--term-coral); }
.journal-demo .j-note { color: var(--term-mid); }
.journal-demo .j-tag { color: var(--term-green); }

.cta-section {
  text-align: center;
  padding: 2rem 0;
  border-top: 1px solid var(--term-border);
  margin-top: 1rem;
}

.cta-section .email-cta { font-size: 15px; color: var(--term-bright); font-weight: 600; margin-bottom: 6px; }
.cta-section .email-addr { font-size: 18px; color: var(--term-green); font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
.cta-section .phone-num { font-size: 14px; color: var(--term-blue); font-weight: 500; letter-spacing: 1px; margin-bottom: 8px; }
.cta-section .email-sub { font-size: 12px; color: var(--term-dim); }

.legal-section {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--term-border);
}

.legal-section h2 {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--term-bright);
  margin-bottom: 1rem;
  letter-spacing: 1px;
}

.legal-section p {
  font-size: 12px;
  color: var(--term-mid);
  line-height: 1.8;
  margin-bottom: 1rem;
}

.legal-section .label {
  color: var(--term-bright);
  font-weight: 600;
}

.legal-section ul {
  list-style: none;
  padding: 0;
  margin-bottom: 1rem;
}

.legal-section ul li {
  font-size: 12px;
  color: var(--term-mid);
  line-height: 1.8;
  padding-left: 1.5rem;
  position: relative;
}

.legal-section ul li::before {
  content: "\\2014";
  position: absolute;
  left: 0;
  color: var(--term-dim);
}

.legal-section .effective {
  font-size: 11px;
  color: var(--term-dim);
  font-style: italic;
  margin-bottom: 1.5rem;
}

.legal-divider {
  border: none;
  border-top: 1px dashed var(--term-border);
  margin: 2rem 0;
}

.footer {
  text-align: center;
  padding-top: 1.5rem;
  padding-bottom: 2rem;
  font-size: 11px;
  color: var(--term-dim);
  letter-spacing: 1px;
}

.footer a { color: var(--term-mid); text-decoration: none; }
.footer a:hover { color: var(--term-green); }

.blink { animation: blink-anim 1.2s step-end infinite; }
@keyframes blink-anim { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

.scroll-ticker {
  overflow: hidden;
  white-space: nowrap;
  margin-bottom: 2rem;
  padding: 8px 0;
  border-top: 1px solid var(--term-border);
  border-bottom: 1px solid var(--term-border);
}

.scroll-ticker .inner {
  display: inline-block;
  animation: ticker 25s linear infinite;
  font-size: 12px;
  color: var(--term-dim);
  letter-spacing: 2px;
}

@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

@media (max-width: 520px) {
  .features { grid-template-columns: 1fr; }
  .ascii-hero { font-size: 10px; }
  .page { padding: 1.5rem 1rem; }
}
</style>
</head>
<body>
<div class="page">

<pre class="ascii-hero">
 \u2588\u2588\u2557  \u2588\u2588\u2557 \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557
 \u2588\u2588\u2551 \u2588\u2588\u2554\u255d \u2588\u2588\u2551 \u255a\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255d
 \u2588\u2588\u2588\u2588\u2588\u2554\u255d  \u2588\u2588\u2551    \u2588\u2588\u2551
 \u2588\u2588\u2554\u2550\u2588\u2588\u2557  \u2588\u2588\u2551    \u2588\u2588\u2551
 \u2588\u2588\u2551  \u2588\u2588\u2557 \u2588\u2588\u2551    \u2588\u2588\u2551
 \u255a\u2550\u255d  \u255a\u2550\u255d \u255a\u2550\u255d    \u255a\u2550\u255d
</pre>

<p class="tagline"><em>kinetic intelligence tool</em> &middot; your family's seventh member</p>

<div class="scroll-ticker">
<span class="inner">remember &middot; recall &middot; reminders &middot; grocery lists &middot; daily briefings &middot; task migration &middot; weekly digest &middot; family calendar &middot; household memory &middot; auditable journal &middot; remember &middot; recall &middot; reminders &middot; grocery lists &middot; daily briefings &middot; task migration &middot; weekly digest &middot; family calendar &middot; household memory &middot; auditable journal &middot;&nbsp;</span>
</div>

<div class="section-label">how it works</div>

<div class="prompt-block">
<span class="ps1">d****@**** ~$</span> <span class="cmd">email k**@*******.***</span><br>
<span class="flag">Subject:</span> <span class="val">Remember this</span><br>
<span class="output">Trash day is Thursday. Plumber is Bob, 555-****.</span><br>
<br>
<span class="kit-reply">
<span class="kit-name">Kit:</span> Got it. I've added both to the household index:<br>
&nbsp;&nbsp;&bull; Trash day &rarr; Thursday (recurring)<br>
&nbsp;&nbsp;&bull; Plumber &rarr; Bob, 555-****<br>
<br>
&mdash; Kit
</span>
</div>

<div class="prompt-block">
<span class="ps1">e****@**** ~$</span> <span class="cmd">email k**@*******.***</span><br>
<span class="flag">Subject:</span> <span class="val">What's this week?</span><br>
<span class="output">Give me the rundown.</span><br>
<br>
<span class="kit-reply">
<span class="kit-name">Kit:</span> Good morning. Here's your week:<br>
<br>
&nbsp;&nbsp;Today (Tuesday):<br>
&nbsp;&nbsp;&nbsp;&nbsp;&bull; Call plumber about the leak<br>
&nbsp;&nbsp;&nbsp;&nbsp;&bull; Soccer practice at 4pm<br>
<br>
&nbsp;&nbsp;Thursday:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&bull; Trash day<br>
&nbsp;&nbsp;&nbsp;&nbsp;&bull; Dentist 3pm<br>
<br>
&nbsp;&nbsp;Saturday:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&bull; Soccer game 10am<br>
<br>
&mdash; Kit
</span>
</div>

<div class="prompt-block">
<span class="ps1">+1(***) ***-**** ~$</span> <span class="cmd">text kit</span><br>
<span class="output">what do i need to do this week?</span><br>
<br>
<span class="kit-reply">
<span class="kit-name">Kit:</span> Homework due Friday. Soccer Sat 10am. Dentist Thu 3pm.
</span>
</div>

<div class="section-label">kit's journal</div>

<div class="journal-demo">
<span class="j-header"># Tuesday, April 8, 2026</span><br>
<br>
<span class="j-section">## tasks</span><br>
<span class="j-task">- [ ] Call plumber about leak</span> <span class="j-tag">#home</span><br>
<span class="j-done">- [x] Buy milk</span><br>
<span class="j-migrated">- [&gt;] Fix fence &rarr; Wednesday</span><br>
<span class="j-task">! - [ ] Pay rent</span> <span class="j-tag">#bills</span><br>
<br>
<span class="j-section">## events</span><br>
<span class="j-event">- [o] Soccer practice at 4pm</span> <span class="j-tag">@son</span><br>
<span class="j-event">- [o] Email from d****: "remember trash day"</span><br>
<br>
<span class="j-section">## notes</span><br>
<span class="j-note">- Plumber Bob: 555-****</span> <span class="j-tag">#contacts</span><br>
<span class="j-note">- WiFi password: ********</span><br>
</div>

<div class="section-label">features</div>

<div class="features">
  <div class="feature-card">
    <span class="icon" style="color:var(--term-green)">[ ] &rarr;</span>
    <h3>bullet journal memory</h3>
    <p>Human-readable text files. Open them, search them, edit them yourself.</p>
  </div>
  <div class="feature-card">
    <span class="icon" style="color:var(--term-amber)">&olarr;</span>
    <h3>task migration</h3>
    <p>Incomplete tasks move forward automatically. Kit explains why.</p>
  </div>
  <div class="feature-card">
    <span class="icon" style="color:var(--term-blue)">&cross;</span>
    <h3>email + sms</h3>
    <p>Email it. Text it. Same brain, same journal, two channels.</p>
  </div>
  <div class="feature-card">
    <span class="icon" style="color:var(--term-coral)">06:00</span>
    <h3>morning digest</h3>
    <p>Wake up to your day at a glance. Sunday = week ahead view.</p>
  </div>
  <div class="feature-card">
    <span class="icon" style="color:var(--term-purple)">&Delta;</span>
    <h3>edit log</h3>
    <p>Every change Kit makes is logged with a timestamp and reason.</p>
  </div>
  <div class="feature-card">
    <span class="icon" style="color:var(--term-green)">\$0</span>
    <h3>runs on cloudflare</h3>
    <p>Workers AI free tier. R2 storage. Under \$2/month total.</p>
  </div>
</div>

<div class="section-label">architecture</div>

<div class="prompt-block">
<span class="comment"># the stack</span><br>
<br>
<span class="flag">runtime</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="val">cloudflare workers + durable objects</span><br>
<span class="flag">storage</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="val">R2 (journal files) + SQLite (state)</span><br>
<span class="flag">ai</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="val">workers AI &mdash; free tier, no API key</span><br>
<span class="flag">http</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="val">hono</span><br>
<span class="flag">email</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="val">cloudflare email routing</span><br>
<span class="flag">sms</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="val">twilio</span><br>
<span class="flag">arch</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="val">clean architecture (domain &rarr; app &rarr; adapters)</span><br>
<span class="flag">tests</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="val">vitest + TDD</span><br>
<span class="flag">ci/cd</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="val">github actions &rarr; deploy on merge</span><br>
<span class="flag">cost</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="val">~\$2/month</span><br>
</div>

<div class="cta-section">
  <p class="email-cta">just email it<span class="blink">_</span></p>
  <p class="email-addr">k**@*******.***</p>
  <p class="phone-num">+1 (***) ***-****</p>
  <p class="email-sub">no app. no account. just talk to kit.</p>
</div>

<!-- PRIVACY -->
<div class="legal-section" id="privacy">
  <h2># privacy</h2>
  <p class="effective">effective april 8, 2026</p>

  <p>Kit is a private, self-hosted family assistant. It is not a commercial service. This policy describes how Kit handles data for the family that operates it.</p>

  <p><span class="label">what Kit stores:</span></p>
  <ul>
    <li>Messages you send to Kit (email body, subject, sender address)</li>
    <li>Journal entries Kit creates from your messages (plain text files)</li>
    <li>Conversation history (recent turns, stored in SQLite on Cloudflare)</li>
    <li>Edit logs (timestamped record of every change Kit makes)</li>
  </ul>

  <p><span class="label">where it lives:</span></p>
  <ul>
    <li>All data is stored on Cloudflare's infrastructure (R2 object storage and Durable Object SQLite)</li>
    <li>Data resides in the Cloudflare region closest to the operator</li>
    <li>No data is stored on third-party servers outside of Cloudflare and the configured AI provider</li>
  </ul>

  <p><span class="label">AI processing:</span></p>
  <ul>
    <li>Messages are sent to Cloudflare Workers AI for intent classification and response generation</li>
    <li>Cloudflare Workers AI processes data in-region and does not retain inputs or outputs for model training</li>
    <li>If a different AI provider is configured, that provider's data policy applies</li>
  </ul>

  <p><span class="label">who can access your data:</span></p>
  <ul>
    <li>Only whitelisted family members (by email or phone number) can interact with Kit</li>
    <li>The operator (the person who deployed Kit) has full access to all stored data</li>
    <li>No data is sold, shared, or made available to anyone outside the household</li>
    <li>Cloudflare may access infrastructure logs per their own privacy policy</li>
  </ul>

  <p><span class="label">data retention:</span></p>
  <ul>
    <li>Daily journal logs are retained for 60 days, then archived into monthly summaries</li>
    <li>Conversation history retains the last 50 turns per family member</li>
    <li>Edit logs are retained indefinitely</li>
    <li>You can delete any data at any time by accessing the journal files directly</li>
  </ul>

  <p><span class="label">SMS (Twilio):</span></p>
  <ul>
    <li>If SMS is enabled, messages are routed through Twilio</li>
    <li>Twilio's privacy policy applies to message delivery</li>
    <li>Kit does not store SMS messages beyond what is logged in the journal</li>
  </ul>

  <p>Questions? Email the operator. Kit is open source &mdash; you can inspect everything it does.</p>
</div>

<hr class="legal-divider">

<!-- TERMS OF SERVICE -->
<div class="legal-section" id="tos">
  <h2># terms of service</h2>
  <p class="effective">effective april 8, 2026</p>

  <p>Kit is a personal, self-hosted AI assistant. By interacting with Kit, you agree to the following terms.</p>

  <p><span class="label">what Kit is:</span></p>
  <ul>
    <li>Kit is a personal tool operated by and for a single household</li>
    <li>Kit is not a commercial product, service, or business</li>
    <li>Kit is provided as-is with no warranty, uptime guarantee, or SLA</li>
  </ul>

  <p><span class="label">what Kit is not:</span></p>
  <ul>
    <li>Kit is not a medical, legal, financial, or professional advisor</li>
    <li>Kit's responses are AI-generated and may be inaccurate</li>
    <li>Kit should not be relied upon for time-critical or safety-critical decisions</li>
  </ul>

  <p><span class="label">your responsibilities:</span></p>
  <ul>
    <li>You are responsible for verifying information Kit provides</li>
    <li>You should not share sensitive credentials, passwords, or financial details with Kit unless you accept the risk of that data being stored in plain text</li>
    <li>If you are not a whitelisted family member, you are not authorized to interact with Kit</li>
  </ul>

  <p><span class="label">the operator's responsibilities:</span></p>
  <ul>
    <li>The operator maintains Kit's infrastructure and is responsible for its availability</li>
    <li>The operator controls who is whitelisted and may revoke access at any time</li>
    <li>The operator may modify, suspend, or shut down Kit at any time without notice</li>
  </ul>

  <p><span class="label">AI and accuracy:</span></p>
  <ul>
    <li>Kit uses AI models that may produce incorrect, incomplete, or misleading responses</li>
    <li>Kit's journal and edit log provide transparency into what it stored and why</li>
    <li>If Kit makes a mistake, you can correct it by emailing or editing the journal directly</li>
  </ul>

  <p><span class="label">liability:</span></p>
  <ul>
    <li>Kit is provided without warranty of any kind, express or implied</li>
    <li>The operator is not liable for any damages arising from use of Kit</li>
    <li>Use Kit at your own risk and discretion</li>
  </ul>

  <p>Kit is open source. If you don't like the terms, fork it and change them.</p>
</div>

<div class="footer">
  kitkit.dev &middot; built by a family, for a family &middot; <a href="#privacy">privacy</a> &middot; <a href="#tos">terms</a> &middot; <a href="https://github.com/dtun/kit">source</a>
</div>

</div>
</body>
</html>`;
