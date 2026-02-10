import { signIn } from "@/src/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;
  const callbackUrl = params.callbackUrl ?? "/";
  const reason = params.reason;

  const isNoRole = error === "NoRole";
  const isInactivity = reason === "inactivity";
  const emailEnabled = !!(process.env.EMAIL_SERVER ?? process.env.SMTP_URL);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#002060] via-[#002060] to-[#DA0100] p-4 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-between gap-8 py-8">
        <div className="flex w-full items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">Školní aplikace</p>
            <h1 className="text-3xl font-bold tracking-tight">Světoplavci</h1>
            <p className="max-w-md text-xs text-white/80">
              Přihlaste se a vyplujte za výsledky svých dětí. Všechno je možné!
            </p>
          </div>
        </div>

        <div className="grid w-full gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card className="border-none bg-white/95 shadow-xl backdrop-blur-sm">
            <CardHeader className="space-y-3 text-left">
              <CardTitle className="text-2xl font-bold text-[#002060]">Přihlášení rodiče</CardTitle>
              <CardDescription className="text-sm text-[#4b5563]">
                Vyberte způsob přihlášení. Doporučujeme Google nebo e‑mailový magický odkaz.
              </CardDescription>
              <p className="rounded-md border border-dashed border-[#002060]/40 bg-[#f9fafb] px-3 py-2 text-xs font-semibold text-[#002060]">
                Použijte, prosím, stejnou e‑mailovou adresu, kterou máte evidovanou v systému Edookit.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
          {isInactivity && (
            <div
              className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
              role="alert"
            >
              Byli jste odhlášeni po 30 minutách nečinnosti. Přihlaste se znovu.
            </div>
          )}
          {isNoRole && (
            <div
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              Uživatel nemá přidělenou žádnou roli. Kontaktujte správce.
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#002060] bg-[#002060] px-4 py-6 text-sm font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-[#001747]"
                  size="lg"
                >
                  <GoogleIcon className="size-5" />
                  <span>Přihlásit se přes Google</span>
                </Button>
              </form>

          {emailEnabled && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full bg-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="rounded-full bg-white px-3 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-slate-500">
                    nebo
                  </span>
                </div>
              </div>

              <form
                action={async (formData: FormData) => {
                  "use server";
                  await signIn("nodemailer", formData);
                }}
                className="space-y-3"
              >
                <input type="hidden" name="callbackUrl" value={callbackUrl} />
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-[#002060]">
                    E‑mail
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="vas@email.cz"
                    required
                    autoComplete="email"
                    className="w-full rounded-xl border border-[#002060]/40 bg-white/80 text-[#002060] placeholder:text-slate-400 focus-visible:ring-[#002060]"
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full rounded-xl border-[#DA0100] bg-white px-4 py-6 text-sm font-semibold uppercase tracking-wide text-[#DA0100] hover:bg-[#fff1f0]"
                  size="lg"
                >
                  Poslat magický odkaz
                </Button>
              </form>
              <p className="text-center text-xs text-slate-500">
                Na zadaný e‑mail přijde odkaz pro přihlášení. Odkaz je platný 24 hodin.
              </p>
            </>
          )}
          {!emailEnabled && (
            <p className="text-center text-sm text-slate-500">
              Přihlášení e‑mailem: nastavte v .env proměnné EMAIL_SERVER a EMAIL_FROM (SMTP).
            </p>
          )}
        </CardContent>
      </Card>
          <div className="hidden h-full flex-col justify-between gap-4 rounded-3xl border border-white/40 bg-white/10 p-6 text-xs shadow-xl backdrop-blur-sm md:flex">
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/70">Jak to funguje</p>
          <h2 className="text-lg font-semibold">Výsledky dítěte na jednom místě</h2>
          <p className="text-xs text-white/80">
            Po přihlášení uvidíte výsledky svých dětí v přehledných dlaždicích – lodičky, vysvědčení a grafy
            v jednoduchém a srozumitelném rozhraní.
          </p>
        </div>
        <div className="space-y-1 text-white/80">
          <p className="text-[10px] uppercase tracking-[0.25em]">Tip</p>
          <ul className="list-disc space-y-1 pl-4 text-xs">
            <li>Používejte stejný e‑mail jako v Edookitu.</li>
            <li>Odkaz z e‑mailu je platný 24 hodin.</li>
            <li>Po 30 minutách nečinnosti budete automaticky odhlášeni.</li>
          </ul>
        </div>
      </div>
      </div>
        <div className="flex w-full justify-center">
          <img
            src="/svetoplavci_logo.svg"
            alt="Světoplavci"
            className="h-24 w-auto max-w-[320px] object-contain invert brightness-0 saturate-0 sm:h-40 sm:max-w-[640px] lg:h-72 lg:max-w-[1400px]"
          />
        </div>
    </div>
    </div>
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
