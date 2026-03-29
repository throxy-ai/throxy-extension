# OLEUM AI — COLD CALL TALK TRACK

*{#999999}Target: Analytics Engineering Leader, Data Engineering Leader, CDO/VP Data, Head of BI, Data Platform Architect{/}*
*{#999999}Series B/C SaaS & Fintech | 4–12 Person Data Teams | 2+ Data Platforms | Using AI Coding Tools | US, Canada, UK{/}*

---

## 1. OPENER

{#990000}**"Hey, my name is {SDR}, and I'm calling you from Oleum AI. I'm calling out of the blue here, so if it's not a good time, do tell me, and I'll call back later."**{/}

*{#999999}Pause. If they give permission, continue with the reason for calling.{/}*

{#990000}**"The reason I'm calling — AI coding tools like Claude Code and Cursor produce wrong answers when they work with your org's data because they don't have up-to-date context on your warehouse schemas. We auto-generate that context and serve it via MCP so your AI tools stop hallucinating on your data. Figured it'd be worth a quick conversation."**{/}

*{#999999}If they engage, move to The Problem.{/}*

---

## 2. THE PROBLEM

{#990000}**"Analytics engineering leaders at Series B and C SaaS and fintech companies we talk to usually tell us:"**{/}

• **AI accuracy drops to 10–24%** on real enterprise schemas — vs. 85%+ on public benchmarks. The gap is missing organizational data context.

• **Fewer than 30% of dbt projects** have column-level descriptions on more than half their models — documentation is always stale or completely empty.

• **30–50% of inbound Slack messages** to data teams are "which table should I use for X?" — senior engineers lose hours every week answering the same questions.

• **New analytics engineers spend days** reverse-engineering undocumented dbt models before they can ship anything.

• **52% of Snowflake customers also run Databricks** — no native tool documents across both platforms, so cross-platform confusion is constant.

• **AI agents generate syntactically correct SQL** that doesn't do what you think — it gets caught weeks later in business reviews, if it gets caught at all.

• **Teams maintain near-identical context files** across 3–4 AI tools manually — .cursor/rules, CLAUDE.md, custom prompts — all out of sync.

---

## 3. PROOF POINTS

### Results

**AI Accuracy Gap** — AI coding tools achieve only **10–24% accuracy** on real enterprise schemas vs. 85%+ on academic benchmarks

**dbt Documentation Crisis** — Fewer than **30%** of dbt projects have column-level descriptions on more than half their models

**Data Team Interruption Tax** — **30–50%** of Slack messages to data teams are "which table should I use for X?"

**Cross-Platform Fragmentation** — **52%** of Snowflake customers also use Databricks — neither documents the other

### What We Do

{#990000}**Auto-Generated Business-Level Documentation**{/} — generates column and table descriptions from your actual data and knowledge bases, not just structural metadata

{#990000}**MCP Server for AI Coding Tools**{/} — serves enriched docs directly to Claude Code, Cursor, and any MCP-compatible tool dynamically

{#990000}**Cross-Platform Context Layer**{/} — documents Snowflake, Databricks, and BigQuery in a single unified layer

{#990000}**Progressive Enrichment with Confidence Scoring**{/} — AI-generated descriptions with confidence scores, flags low-confidence columns for human review

{#990000}**Single Source of Truth**{/} — replaces maintaining separate .cursor/rules, CLAUDE.md, and custom prompt files

{#990000}**CLI Install, Minutes to Value**{/} — installs via CLI and has enriched docs served via MCP in minutes

### The Offer

{#990000}**500 Columns Free Forever**{/} — validate the product on your core models without paying

{#990000}**"Your AI Tools Are Confidently Wrong" Audit**{/} — we'll show you the accuracy gap between what your AI tools produce today vs. with proper data context

---

## 4. QUALIFYING QUESTIONS

*{#999999}Weave these in naturally. React to their answer before moving to the next question.{/}*

### Must Ask

{#990000}**2. "Is your team using AI coding tools like Claude Code, Cursor, or Copilot for data work?"**{/}

*{#999999}Not yet → DISQUALIFY if no plans to adopt. Without AI coding tools, the core value prop doesn't land.{/}*
*{#999999}Yes → "How accurate are the SQL outputs? Most teams find AI-generated queries look right but silently use the wrong tables or columns."{/}*

### Nice to Ask

{#990000}**1. "Do you run more than one data platform — like Snowflake plus Databricks or BigQuery?"**{/}

*{#999999}Single platform → Still a fit, but the cross-platform pain is weaker. Probe on documentation staleness instead.{/}*
*{#999999}2+ platforms → "That's exactly where the fragmentation kills you. Neither platform documents the other, so your AI tools are flying blind on half your data."{/}*

{#990000}**3. "How documented are your dbt models — do you have column-level descriptions on most of them?"**{/}

*{#999999}Well-documented → Rare. Probe on staleness: "When's the last time those descriptions were updated?"{/}*
*{#999999}Sparse or empty → "That's the norm. And it's exactly why your AI tools hallucinate — they have no business context to work with."{/}*

{#990000}**4. "How big is your data team, and how much time do senior engineers spend answering 'which table?' questions?"**{/}

*{#999999}Under 4 people → May not feel the pain yet. Probe on growth plans.{/}*
*{#999999}4–12+ → "At that size, tribal knowledge doesn't scale. Every new hire spends days reverse-engineering what the seniors already know."{/}*

{#990000}**5. "Have you had any data incidents traced back to AI-generated SQL using the wrong table or column?"**{/}

*{#999999}Yes → Strong pain. "That's the accuracy gap we close. It's not that the AI writes bad SQL — it writes SQL against the wrong context."{/}*
*{#999999}Not sure → "That's the scary part. These errors look syntactically correct. They don't throw errors — they just return wrong numbers."{/}*

---

## 5. OBJECTION RESPONSES

**"We have Confluence/Notion docs for our data"**

> When's the last time someone updated them? Oleum generates from actual dbt artifacts, git repos, and your warehouse metadata — always current, never stale.

**"Can't we just put schema context in CLAUDE.md or .cursor/rules?"**

> Schema context for hundreds of tables doesn't belong in a static rules file. It goes stale immediately, and you end up maintaining separate files for every AI tool. Oleum serves the right context dynamically via MCP.

**"Databricks/Snowflake already does AI documentation"**

> Each only documents its own ecosystem. 52% of Snowflake customers also use Databricks. Neither will document the other. You need a cross-platform context layer.

**"Why wouldn't dbt just build this?"**

> dbt covers the DAG and transformation layer, but their incentive is Cloud revenue, not documentation tooling. They don't generate business-level descriptions — that's a different problem.

**"We'll just build it ourselves"**

> That's a 3–6 month project for a team that's already behind on data work. Oleum installs via CLI and has enriched docs served via MCP in minutes. Try 500 columns free and see if it's worth building.

**"AI-generated documentation will be wrong"**

> Confidence scoring flags low-confidence columns explicitly. Even 70% accurate is dramatically better than 0%, which is what most teams have today. And it improves with every human review.

**"Send me an email"**

> Happy to. Quick question — are your AI coding tools producing accurate SQL on your warehouse today, or are you seeing wrong outputs? That way I send you the right materials.

**"Not interested"**

> Fair enough. Just curious — how do your engineers find the right table when they're writing queries against your warehouse? If it takes more than a Slack message, that's usually where the time drain lives.

---

## 6. COMPETITIVE QUICK DISMISS

**"We use Atlan"**

> Full enterprise data catalog — $198K/year, multi-week deployment. Atlan serves metadata that already exists. Oleum generates the semantic enrichments that actually close the AI accuracy gap. Different problem, different tool.

**"We use DataHub (Acryl Data)"**

> They have an MCP server, but it over-indexes on structural metadata — lineage, ownership, tags. Misses the business context that AI coding tools actually need to produce accurate outputs.

**"Snowflake / Databricks native AI docs"**

> Each only documents within its own ecosystem. 52% of Snowflake customers also run Databricks. Neither will document the other. You need a cross-platform layer.

**"dbt handles this"**

> Great for the transformation DAG, but dbt doesn't generate business-level column descriptions. Their roadmap is Cloud revenue, not documentation tooling.

**"We'll just use .cursor/rules and CLAUDE.md"**

> That's a static file you maintain manually for each tool. It doesn't scale past a handful of tables, goes stale the day you write it, and you're duplicating work across every AI tool your team uses.
