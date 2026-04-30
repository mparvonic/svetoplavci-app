import { signIn } from "@/src/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPostLoginDefaultPath } from "@/src/lib/post-login-path";

import Image from "next/image";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Jednoduché throttlování magic linků (na serveru, podle emailu) – 30 s mezi požadavky
const magicLastSent = new Map<string, number>();

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string; reason?: string; tooFast?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;
  const callbackUrl = params.callbackUrl ?? getPostLoginDefaultPath();
  const reason = params.reason;
  const tooFast = params.tooFast === "1";

  const isNoRole = error === "NoRole";
  const isNoEnvRole = error === "NoEnvRole";
  const isInactivity = reason === "inactivity";
  const emailEnabled = !!(process.env.EMAIL_SERVER ?? process.env.SMTP_URL);

  return (
    <main className="sv-paper-grain min-h-screen bg-[#EEF2F7]">
      <section className="app-page-container relative flex min-h-screen items-center py-10 sm:py-14">
        <div className="mx-auto grid w-full max-w-[920px] gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div className="relative z-10">
            <Image
              src="/svetoplavci_logo.png"
              alt="Světoplavci"
              width={320}
              height={113}
              priority
              className="mb-10 h-auto w-[min(19rem,82vw)]"
            />
            <div className="sv-eyebrow text-[#C8372D]">Aplikace Světoplavci</div>
            <h1 className="sv-display-lg mt-3 max-w-[10ch] text-[#0E2A5C]">
              Vyplujte za výsledky{" "}
              <span className="sv-italic-serif">svých dětí</span>.
            </h1>
            <p className="lead mt-5 text-[#4A5A7C]">
              Přihlaste se Google účtem nebo přes e‑mailový odkaz. Doporučujeme
              e‑mail, který máte u školy evidovaný.
            </p>
            <div className="mt-6 rounded-[12px] border border-[#D6DFF0] bg-white p-4 text-sm text-[#4A5A7C] shadow-[var(--sv-shadow-paper)]">
              <b className="text-[#0E2A5C]">Tip:</b> Odkaz z e‑mailu je platný 24 hodin.
              Po 30 minutách nečinnosti vás aplikace automaticky odhlásí.
            </div>
          </div>

          <Card className="relative z-10 overflow-hidden rounded-[20px] border-[#D6DFF0] bg-white py-0 shadow-[var(--sv-shadow-lift)]">
            <CardHeader className="space-y-3 px-6 pt-7 text-left sm:px-8 sm:pt-8">
              <div className="sv-eyebrow text-[#C8372D]">Přihlášení</div>
              <CardTitle className="sv-display-sm text-[#0E2A5C]">Přihlášení rodiče</CardTitle>
              <CardDescription className="text-sm text-[#4A5A7C]">
                Použijte Google účet nebo e-mailový odkaz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 px-6 pb-7 sm:px-8 sm:pb-8">
              {isInactivity && (
                <div
                  className="rounded-[12px] border border-[#D6DFF0] bg-[#EEF2F7] px-3 py-2 text-sm text-[#0E2A5C]"
                  role="alert"
                >
                  Byli jste odhlášeni po 30 minutách nečinnosti. Přihlaste se znovu.
                </div>
              )}
              {isNoRole && (
                <div
                  className="rounded-[12px] border border-[#C8372D]/30 bg-[#FAEAE9] px-3 py-2 text-sm text-[#A42A22]"
                  role="alert"
                >
                  Uživatel nemá přidělenou žádnou roli. Zkontrolujte, zda používáte stejnou e‑mailovou adresu jako u
                  školy. Pokud chcete přidat přístup pro další e‑mail, obraťte se na kancelář školy
                  (kancelar@svetoplavci.cz).
                </div>
              )}
              {isNoEnvRole && (
                <div
                  className="rounded-[12px] border border-[#C8372D]/30 bg-[#FAEAE9] px-3 py-2 text-sm text-[#A42A22]"
                  role="alert"
                >
                  Váš účet nemá roli potřebnou pro toto prostředí aplikace. Pokud potřebujete přístup, obraťte se na
                  správce aplikace.
                </div>
              )}
              {tooFast && (
                <div
                  className="rounded-[12px] border border-[#D6DFF0] bg-[#EEF2F7] px-3 py-2 text-sm text-[#0E2A5C]"
                  role="alert"
                >
                  Další přihlašovací odkaz můžete požadovat nejdříve za několik sekund. Zkuste to prosím znovu za
                  chvíli.
                </div>
              )}

              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: callbackUrl });
                }}
              >
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full gap-3 border-[#D6DFF0] py-6 text-[#0E2A5C] hover:border-[#0E2A5C] hover:bg-white hover:text-[#0E2A5C]"
                  size="lg"
                >
                  <GoogleIcon className="size-5" />
                  <span>Přihlásit přes Google</span>
                </Button>
              </form>

              {emailEnabled && (
                <>
                  <div className="sv-divider-dot text-[11px] font-semibold uppercase tracking-[.15em]">
                    <span className="rounded-full bg-white px-3 text-[#7F88A0]">nebo</span>
                  </div>

                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      const email = formData.get("email");
                      if (typeof email !== "string") return;
                      const key = email.trim().toLowerCase();
                      const now = Date.now();
                      const lastSent = magicLastSent.get(key);
                      if (lastSent && now - lastSent < 30_000) {
                        redirect("/auth/signin?tooFast=1");
                      }

                      await signIn("nodemailer", {
                        email,
                        redirectTo: callbackUrl,
                      });

                      magicLastSent.set(key, now);
                    }}
                    className="space-y-3"
                  >
                    <div className="space-y-2">
                      <label htmlFor="email" className="sv-form-label">
                        E‑mail
                      </label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="vas@email.cz"
                        required
                        autoComplete="email"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full border-[#C8372D] bg-[#C8372D] py-6 text-white hover:bg-[#A42A22]"
                      size="lg"
                    >
                      Poslat odkaz k přihlášení
                    </Button>
                  </form>
                  <p className="text-center text-xs text-[#7F88A0]">
                    Na zadaný e‑mail přijde odkaz pro přihlášení.
                  </p>
                </>
              )}
              {!emailEnabled && (
                <p className="text-center text-sm text-[#7F88A0]">
                  Přihlášení e‑mailem: nastavte v .env proměnné EMAIL_SERVER a EMAIL_FROM (SMTP).
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"/>
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5a6 6 0 0 1-9-3.1H3.1v2.6A10 10 0 0 0 12 22Z"/>
      <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9l3.3-2.5Z"/>
      <path fill="#EA4335" d="M12 5.9a5.4 5.4 0 0 1 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6A6 6 0 0 1 12 5.9Z"/>
    </svg>
  );
}
