# Project Overload v2 — AI Report Contracts (DIY)

## One-liner
A DIY AI that connects to a company's database, helps define a report once via chat, then runs it on a schedule (cron) to produce a business-consumable narrative PDF.

## Core differentiator
**Report Contracts**: A report is defined once (questions asked by AI), approved, locked, and then runnable forever on a schedule. Output is consistent, exec-ready, and includes deltas vs previous runs.

## MVP (v0.1) Scope
### Must-have
1) **Report Contract Builder (chat flow)**
   - AI collects: report name, audience, KPIs/definitions, dimensions, filters, thresholds, delivery channel, schedule.
   - Produces a stored JSON "ReportContract" object.

2) **Query Plan + Governance**
   - AI proposes SQL (read-only), but system enforces:
     - allowlisted schemas/tables/views
     - forced LIMIT / aggregation-first
     - row cap to keep evidence table <= 200 rows
     - "approve & lock" SQL for scheduled runs

3) **Run Pipeline**
   - Execute SQL safely
   - Produce an "Evidence Table" (<=200 rows)
   - Summarize into structured "Exec Brief"
   - Render HTML -> PDF

4) **Scheduling**
   - User can say: "Run weekly Fridays 6pm IST"
   - System stores cron + timezone
   - Worker runs contract, generates PDF, delivers (email in MVP)

5) **Diffing**
   - For recurring reports: compare to last run and highlight changes.

### Nice-to-have (post MVP)
- Slack delivery
- Multi-data-source joins
- Full semantic model UI
- Hybrid "data plane agent" inside customer VPC

## Non-goals (v0.1)
- Replacing Databricks / warehouse compute
- Write access to customer DB
- Auto-migrations applied without human review

## Success criteria for MVP
- A non-technical user can define a weekly CEO report via chat in <10 minutes.
- Scheduled report runs successfully for 2 weeks without manual intervention.
- Output is consistent: sections, deltas, drivers, and actions.
