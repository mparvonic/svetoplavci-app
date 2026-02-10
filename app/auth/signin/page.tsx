import { signIn } from "@/src/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;
  const callbackUrl = params.callbackUrl ?? "/";

  const isNoRole = error === "NoRole";
  const emailEnabled = !!(process.env.EMAIL_SERVER ?? process.env.SMTP_URL);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <img
        src="/svetoplavci_logo.png?v=transparent"
        alt="Světoplavci"
        className="h-48 w-auto max-w-[840px] object-contain object-center"
      />
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-xl">Přihlášení</CardTitle>
          <CardDescription>Přihlaste se pomocí Google nebo e‑mailu (magický odkaz)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Button type="submit" variant="default" className="w-full" size="lg">
              <GoogleIcon className="size-5" />
              Přihlásit se přes Google
            </Button>
          </form>

          {emailEnabled && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">nebo</span>
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
                  <label htmlFor="email" className="text-sm font-medium">
                    E‑mail
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="vas@email.cz"
                    required
                    autoComplete="email"
                    className="w-full"
                  />
                </div>
                <Button type="submit" variant="outline" className="w-full" size="lg">
                  Poslat magický odkaz
                </Button>
              </form>
              <p className="text-center text-xs text-muted-foreground">
                Na zadaný e‑mail přijde odkaz pro přihlášení. Odkaz je platný 24 hodin.
              </p>
              <p className="text-center text-xs text-amber-600 dark:text-amber-500">
                Odkaz otevřete <strong>ve stejném prohlížeči</strong> (zkopírujte adresu z e‑mailu a vložte do záložky s touto stránkou). Kliknutí přímo v e‑mailu může otevřít jiný prohlížeč, kde se přihlášení neprojeví.
              </p>
            </>
          )}
          {!emailEnabled && (
            <p className="text-center text-sm text-muted-foreground">
              Přihlášení e‑mailem: nastavte v .env proměnné EMAIL_SERVER a EMAIL_FROM (SMTP).
            </p>
          )}
        </CardContent>
      </Card>
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
