export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#002060] via-[#002060] to-[#DA0100] p-4 text-white">
      <div className="mx-auto w-full max-w-md rounded-3xl bg-black/40 p-8 text-center shadow-2xl backdrop-blur-sm">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Zkontrolujte e‑mail</h1>
        <p className="text-sm text-white/90">
          Odeslali jsme vám přihlašovací odkaz na zadanou e‑mailovou adresu.
        </p>
        <p className="mt-4 text-xs text-white/70">
          Otevřete schránku, klikněte na odkaz a vraťte se zpět do aplikace.
          Odkaz je platný omezenou dobu.
        </p>
        <p className="mt-3 text-xs text-white/70">
          Pokud zprávu nevidíte, zkontrolujte složku <span className="font-semibold">Spam / Nevyžádaná pošta</span>.
          Hledejte e‑mail odeslaný z adresy{" "}
          <span className="font-semibold">app@svetoplavci.cz</span>.
        </p>
        <p className="mt-4 text-xs text-white/80">
          E‑mail nepřišel?{" "}
          <a
            href="/auth/signin"
            className="font-semibold underline underline-offset-4"
          >
            Vraťte se na přihlášení a zkuste to znovu
          </a>
          .
        </p>
        <p className="mt-6 text-[11px] uppercase tracking-[0.25em] text-white/60">
          Školní aplikace Světoplavci
        </p>
      </div>
    </div>
  );
}

