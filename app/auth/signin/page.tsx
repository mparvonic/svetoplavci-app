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
      <section className="app-page-container relative flex min-h-screen items-center py-8">
        <div className="grid w-full items-stretch gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.72fr)]">
          <div className="relative flex min-h-[34rem] flex-col justify-between overflow-hidden rounded-[32px] border border-[#0E2A5C] bg-[#0E2A5C] p-7 text-white shadow-[var(--sv-shadow-lift)] sm:p-9">
            <div className="relative z-10 space-y-6">
              <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-normal text-white/80">
                Školní aplikace
              </div>
              <div className="space-y-4">
                <h1 className="sv-display-lg max-w-[9ch] text-white">Světoplavci</h1>
                <p className="max-w-xl text-base text-white/80">Přihlášení do školní aplikace.</p>
              </div>
            </div>

            <div className="relative z-10 mt-12 grid gap-3 text-sm text-white/80 sm:grid-cols-3">
              <div className="rounded-[20px] border border-white/15 bg-white/10 p-4">
                <div className="sv-eyebrow mb-2 text-white/60">Přístup</div>
                <div className="font-semibold text-white">Rodiče a škola</div>
              </div>
              <div className="rounded-[20px] border border-white/15 bg-white/10 p-4">
                <div className="sv-eyebrow mb-2 text-white/60">Data</div>
                <div className="font-semibold text-white">Chráněné účtem</div>
              </div>
              <div className="rounded-[20px] border border-white/15 bg-white/10 p-4">
                <div className="sv-eyebrow mb-2 text-white/60">Čas</div>
                <div className="font-semibold text-white">Odhlášení po nečinnosti</div>
              </div>
            </div>

            <div className="pointer-events-none absolute -right-16 -top-16 size-52 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute right-8 top-8 hidden w-48 opacity-[0.12] sm:w-60 md:block">
              <Image
                src="/svetoplavci_logo.svg"
                alt=""
                width={320}
                height={160}
                className="h-auto w-full invert brightness-0 saturate-0"
              />
            </div>
          </div>

          <Card className="flex min-h-[34rem] flex-col justify-center overflow-hidden rounded-[32px] border-[#D6DFF0] bg-white py-0 shadow-[var(--sv-shadow-lift)]">
            <CardHeader className="space-y-3 px-6 pt-7 text-left sm:px-8 sm:pt-8">
              <div className="sv-eyebrow text-[#C8372D]">Přihlášení</div>
              <CardTitle className="sv-display-sm text-[#0E2A5C]">Vstup do aplikace</CardTitle>
              <CardDescription className="text-sm text-[#4A5A7C]">
                Použijte Google účet nebo e‑mailový odkaz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 px-6 pb-7 sm:px-8 sm:pb-8">
              {isInactivity && (
                <div
                  className="rounded-[12px] border border-[#E8A33B]/50 bg-[#FFF7E8] px-3 py-2 text-sm text-[#8A5A00]"
                  role="alert"
                >
                  Byli jste odhlášeni po 30 minutách nečinnosti. Přihlaste se znovu.
                </div>
              )}
              {isNoRole && (
                <div
                  className="rounded-[12px] border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  Uživatel nemá přidělenou žádnou roli. Zkontrolujte, zda používáte stejnou adresu jako v systému
                  Edookit. Pokud chcete přidat přístup pro další e‑mail, obraťte se na kancelář školy
                  (kancelar@svetoplavci.cz).
                </div>
              )}
              {isNoEnvRole && (
                <div
                  className="rounded-[12px] border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  Váš účet nemá roli potřebnou pro toto prostředí aplikace. Pokud potřebujete přístup, obraťte se na
                  správce aplikace.
                </div>
              )}
              {tooFast && (
                <div
                  className="rounded-[12px] border border-[#E8A33B]/50 bg-[#FFF7E8] px-3 py-2 text-sm text-[#8A5A00]"
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
                <Button type="submit" className="w-full py-6" size="lg">
                  <GoogleIcon className="size-5" />
                  <span>Přihlásit přes Google</span>
                </Button>
              </form>

              {emailEnabled && (
                <>
                  <div className="sv-divider-dot text-[11px] font-semibold uppercase tracking-normal">
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
                    <Button type="submit" variant="outline" className="w-full border-[#C8372D] py-6 text-[#C8372D] hover:bg-[#FAEAE9]" size="lg">
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
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
