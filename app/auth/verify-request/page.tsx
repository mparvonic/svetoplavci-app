export default function VerifyRequestPage() {
  return (
    <main className="sv-paper-grain flex min-h-screen flex-col items-center justify-center bg-[#EEF2F7] p-4">
      <div className="relative mx-auto w-full max-w-md rounded-[32px] border border-[#D6DFF0] bg-white p-8 text-center shadow-[var(--sv-shadow-lift)]">
        <p className="sv-eyebrow mb-3 text-[#C8372D]">Přihlášení</p>
        <h1 className="sv-display-sm mb-3 text-[#0E2A5C]">Zkontrolujte e‑mail</h1>
        <p className="text-sm text-[#4A5A7C]">
          Odeslali jsme vám přihlašovací odkaz na zadanou e‑mailovou adresu.
        </p>
        <p className="mt-4 text-xs text-[#4A5A7C]">
          Otevřete schránku, klikněte na odkaz a vraťte se zpět do aplikace.
          Odkaz je platný omezenou dobu.
        </p>
        <p className="mt-3 text-xs text-[#4A5A7C]">
          Pokud zprávu nevidíte, zkontrolujte složku <span className="font-semibold">Spam / Nevyžádaná pošta</span>.
          Hledejte e‑mail odeslaný z adresy{" "}
          <span className="font-semibold">app@svetoplavci.cz</span>.
        </p>
        <p className="mt-4 text-xs text-[#4A5A7C]">
          E‑mail nepřišel?{" "}
          <a
            href="/auth/signin"
            className="font-semibold text-[#C8372D] underline underline-offset-4"
          >
            Vraťte se na přihlášení a zkuste to znovu
          </a>
          .
        </p>
        <p className="sv-eyebrow mt-6 text-[#7F88A0]">
          Školní aplikace Světoplavci
        </p>
      </div>
    </main>
  );
}
