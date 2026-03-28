import type { ExecBrief, ReportContract, ReportRun, ReportRunDelivery } from "@project-overload/shared";

export type DeliveryResult = ReportRunDelivery;

export async function deliverReportRun(input: {
  contract: ReportContract;
  run: ReportRun;
  exec_brief: ExecBrief;
  fetch_impl?: typeof fetch;
}): Promise<DeliveryResult> {
  const recipients = Array.isArray(input.contract.delivery?.emails)
    ? input.contract.delivery.emails.filter((value) => typeof value === "string" && value.trim().length > 0)
    : [];

  if (recipients.length === 0) {
    return {
      status: "not_configured",
      recipients: [],
      provider: "none",
      sent_at: null,
      error: null
    };
  }

  const provider = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  if (provider !== "resend" || !resendApiKey) {
    return {
      status: "queued",
      recipients,
      provider: provider || "none",
      sent_at: null,
      error: "Email provider not configured for live delivery. Delivery is queued for manual processing."
    };
  }

  const subject = `[Claritect] ${input.contract.name} (${input.run.id})`;
  const from = process.env.DELIVERY_FROM_EMAIL?.trim() || "reports@claritect.local";
  const html = buildDeliveryHtml(input.contract, input.exec_brief, input.run);
  const fetcher = input.fetch_impl ?? fetch;

  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        html
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        status: "failed",
        recipients,
        provider: "resend",
        sent_at: null,
        error: `Resend delivery failed (${response.status}): ${text}`
      };
    }

    return {
      status: "sent",
      recipients,
      provider: "resend",
      sent_at: new Date().toISOString(),
      error: null
    };
  } catch (error) {
    return {
      status: "failed",
      recipients,
      provider: "resend",
      sent_at: null,
      error: error instanceof Error ? error.message : "Unknown email delivery error"
    };
  }
}

function buildDeliveryHtml(contract: ReportContract, brief: ExecBrief, run: ReportRun): string {
  const bullets = (items: string[]): string => {
    if (items.length === 0) {
      return "<li>None</li>";
    }
    return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  };

  return [
    '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">',
    `<h2 style="margin:0 0 8px;">${escapeHtml(contract.name)}</h2>`,
    `<p style="margin:0 0 8px;">Run ID: <code>${escapeHtml(run.id)}</code></p>`,
    "<h3>What Changed</h3>",
    `<ul>${bullets(brief.what_changed)}</ul>`,
    "<h3>Why</h3>",
    `<ul>${bullets(brief.why)}</ul>`,
    "<h3>So What</h3>",
    `<ul>${bullets(brief.so_what)}</ul>`,
    "<h3>What To Do</h3>",
    `<ul>${bullets(brief.what_to_do)}</ul>`,
    "<h3>Deltas Vs Last Run</h3>",
    `<ul>${bullets(brief.deltas_vs_last_run)}</ul>`,
    "</div>"
  ].join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
