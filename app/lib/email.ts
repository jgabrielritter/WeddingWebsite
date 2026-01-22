export type EmailStatus = {
  status: "sent" | "failed" | "skipped";
  provider?: string;
  error?: string;
};

type EmailPayload = {
  to: string;
  name: string;
  attending: boolean;
  receivedAt: Date;
  traceId: string;
  language?: string | null;
};

export async function sendRsvpConfirmationEmail({
  to,
  name,
  attending,
  receivedAt,
  traceId,
  language,
}: EmailPayload): Promise<EmailStatus> {
  const provider = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();

  if (!provider) {
    return { status: "skipped" };
  }

  if (provider !== "resend") {
    return { status: "failed", provider, error: "Unsupported provider" };
  }

  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return { status: "failed", provider, error: "Missing email config" };
  }

  const replyTo = process.env.RSVP_REPLY_TO;
  const timeZone = process.env.RSVP_TIMEZONE ?? "America/New_York";
  const receivedText = new Intl.DateTimeFormat(language === "pl" ? "pl-PL" : "en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(receivedAt);

  const siteUrl = process.env.RSVP_SITE_URL;
  const subject = "We received your RSVP — Angelika & Gabe";
  const attendingText = attending ? "Yes" : "No";
  const bodyLines = [
    `Hi ${name},`,
    "",
    "Thanks for letting us know! Here's what we received:",
    `Attending: ${attendingText}`,
    `Received: ${receivedText}`,
  ];

  if (siteUrl) {
    bodyLines.push("", `Visit the wedding site: ${siteUrl}`);
  }

  bodyLines.push("", "With love,", "Angelika & Gabe");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: bodyLines.join("\n"),
      reply_to: replyTo ?? undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[RSVP EMAIL FAILED]", { traceId, errorText });
    return { status: "failed", provider, error: errorText };
  }

  return { status: "sent", provider };
}
