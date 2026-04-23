import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type NotificationBody = {
  kind: "new-proposition" | "new-chat-message";
  recipients: string[];
  actorEmail?: string;
  title?: string;
  date?: string;
  text?: string;
  hasMentions?: boolean;
  messageCount?: number;
};

const buildEmail = (payload: NotificationBody) => {
  if (payload.kind === "new-proposition") {
    const subject = "Formula D Planner · Nouvelle proposition de date";
    const title = payload.title || "Nouvelle proposition";
    const date = payload.date || "Date à confirmer";
    const intro = `${payload.actorEmail || "Un pilote"} a proposé une nouvelle date.`;
    return {
      subject,
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#111">
          <h2 style="margin:0 0 12px">Nouvelle proposition de date</h2>
          <p style="margin:0 0 10px">${intro}</p>
          <p style="margin:0 0 6px"><strong>${title}</strong></p>
          <p style="margin:0 0 14px">${date}</p>
          <a href="https://formula-d-planner.vercel.app/dashboard?tab=proposition" style="display:inline-block;background:#d31f28;color:#fff;text-decoration:none;padding:10px 14px;border-radius:4px;">Voir les propositions</a>
        </div>
      `,
      text: `Nouvelle proposition de date\n\n${intro}\n${title}\n${date}\n\nOuvrir: https://formula-d-planner.vercel.app/dashboard?tab=proposition`,
    };
  }

  const subject = payload.hasMentions
    ? "Formula D Planner · Nouveau message (avec mention)"
    : payload.messageCount && payload.messageCount > 1
      ? `Formula D Planner · ${payload.messageCount} nouveaux messages chat`
      : "Formula D Planner · Nouveau message chat";
  const preview = payload.text || "Nouveau message";
  const messageLabel = payload.messageCount && payload.messageCount > 1 ? `${payload.messageCount} nouveaux messages` : "Nouveau message";
  const intro = payload.messageCount && payload.messageCount > 1 
    ? `${payload.messageCount} nouveaux messages ont été envoyés.`
    : `${payload.actorEmail || "Un pilote"} a envoyé un message.`;

  return {
    subject,
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#111">
        <h2 style="margin:0 0 12px">${messageLabel}</h2>
        <p style="margin:0 0 10px">${intro}</p>
        ${payload.messageCount && payload.messageCount > 1 
          ? `<p style="margin:0 0 14px;font-size:12px;color:#666;">Ouvre le chat pour voir tous les messages.</p>`
          : `<blockquote style="margin:0 0 14px;padding:10px 12px;background:#f4f4f5;border-left:3px solid #d31f28;">${preview}</blockquote>`
        }
        <a href="https://formula-d-planner.vercel.app/dashboard?tab=chat" style="display:inline-block;background:#d31f28;color:#fff;text-decoration:none;padding:10px 14px;border-radius:4px;">Ouvrir le chat</a>
      </div>
    `,
    text: payload.messageCount && payload.messageCount > 1
      ? `${messageLabel}\n\n${intro}\n\nOuvrir: https://formula-d-planner.vercel.app/dashboard?tab=chat`
      : `Nouveau message chat\n\n${intro}\n\n${preview}\n\nOuvrir: https://formula-d-planner.vercel.app/dashboard?tab=chat`,
  };
};

export async function POST(request: Request) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  console.log("Notification API called");
  console.log("GMAIL_USER configured:", !!gmailUser);

  if (!gmailUser || !gmailPass) {
    console.error("Missing config: GMAIL_USER or GMAIL_APP_PASSWORD");
    return NextResponse.json(
      { ok: false, error: "Notifications email non configurées (GMAIL_USER/GMAIL_APP_PASSWORD)." },
      { status: 500 }
    );
  }

  let body: NotificationBody;
  try {
    body = (await request.json()) as NotificationBody;
  } catch {
    console.error("JSON parsing failed");
    return NextResponse.json({ ok: false, error: "Payload JSON invalide." }, { status: 400 });
  }

  console.log("Notification payload:", { kind: body.kind, recipientCount: body.recipients?.length || 0 });

  const recipients = Array.from(new Set((body.recipients || []).filter(Boolean)));
  if (!body.kind || recipients.length === 0) {
    console.error("Missing kind or recipients");
    return NextResponse.json({ ok: false, error: "kind/recipients requis." }, { status: 400 });
  }

  console.log("Cleaned recipients:", recipients);

  const email = buildEmail(body);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPass },
  });

  const sendPromises = recipients.map(async (to) => {
    console.log(`Sending email to: ${to}`);
    await transporter.sendMail({
      from: `"Formula D Planner" <${gmailUser}>`,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    console.log(`Email sent to ${to}`);
  });

  try {
    await Promise.all(sendPromises);
    console.log(`Successfully sent ${recipients.length} notifications`);
    return NextResponse.json({ ok: true, sent: recipients.length });
  } catch (error: any) {
    console.error("Error sending notifications:", error);
    return NextResponse.json({ ok: false, error: error?.message || "Erreur envoi notifications." }, { status: 502 });
  }
}
