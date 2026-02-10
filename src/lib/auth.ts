import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import nodemailer from "nodemailer";
import { authConfig } from "@/src/lib/auth.config";
import { prisma } from "@/src/lib/prisma";

const emailServer = process.env.EMAIL_SERVER ?? process.env.SMTP_URL;
const emailFromAddress = process.env.EMAIL_FROM ?? process.env.EMAIL_FROM_ADDRESS ?? "noreply@localhost";
const emailFrom = emailFromAddress.includes("<")
  ? emailFromAddress
  : `Školní aplikace Světoplavci <${emailFromAddress}>`;

const emailProviders = [
  ...authConfig.providers,
  ...(emailServer
    ? [
        Nodemailer({
          server: emailServer,
          from: emailFrom,
          async sendVerificationRequest({ identifier, url, provider }) {
            const { host } = new URL(url);

            const subject = "Přihlášení do Školní aplikace Světoplavci";
            const text = [
              "Dobrý den,",
              "",
              "obdrželi jsme žádost o přihlášení do Školní aplikace Světoplavci pomocí tohoto e‑mailu.",
              "Pro pokračování klikněte na následující odkaz:",
              "",
              url,
              "",
              "Odkaz je platný jen omezenou dobu a je určen pouze pro toto zařízení a prohlížeč.",
              "",
              `Pokud jste o přihlášení nežádali, můžete tento e‑mail ignorovat. Účet zůstane v bezpečí.`,
              "",
              `Školní aplikace Světoplavci (${host})`,
            ].join("\n");

            const html = `
<div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #111827;">
  <h1 style="font-size: 20px; margin: 0 0 12px 0;">Přihlášení do Školní aplikace Světoplavci</h1>
  <p>Dobrý den,</p>
  <p>
    obdrželi jsme žádost o přihlášení do <strong>Školní aplikace Světoplavci</strong> pomocí této e‑mailové adresy.
    Pro pokračování klikněte na tlačítko níže:
  </p>
  <p style="margin: 20px 0;">
    <a href="${url}" style="
      display: inline-block;
      padding: 10px 18px;
      border-radius: 999px;
      background: #002060;
      color: #ffffff;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
    ">
      Přihlásit se
    </a>
  </p>
  <p>Pokud tlačítko nefunguje, zkopírujte a vložte tento odkaz do adresního řádku prohlížeče:</p>
  <p style="font-size: 12px; word-break: break-all; color: #374151;">${url}</p>
  <p style="font-size: 12px; color: #6b7280;">
    Odkaz je platný jen omezenou dobu a je určen pouze pro toto zařízení a prohlížeč.
  </p>
  <p style="font-size: 12px; color: #6b7280;">
    Pokud jste o přihlášení nežádali, můžete tento e‑mail ignorovat. Účet zůstane v bezpečí.
  </p>
  <p style="margin-top: 16px; font-size: 11px; color: #9ca3af;">
    Školní aplikace Světoplavci (${host})
  </p>
</div>
`;

            try {
              // Vytvoříme vlastní Nodemailer transport z konfigurace provideru
              const transport = nodemailer.createTransport(
                // @ts-expect-error - typ serveru může být string nebo objekt, createTransport zvládne obojí
                provider.server ?? emailServer
              );
              await transport.sendMail({
                to: identifier,
                from: provider.from,
                subject,
                text,
                html,
              });
            } catch (error) {
              console.error("[auth] sendVerificationRequest error", error);
              throw new Error("SEND_VERIFICATION_EMAIL_ERROR");
            }
          },
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: emailProviders,
});
