export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const code = params.error;

  let title = "Nelze se přihlásit";
  let message =
    "Při přihlášení došlo k chybě. Zkuste to prosím znovu nebo požádejte o nový přihlašovací odkaz.";

  if (code === "Verification") {
    title = "Přihlašovací odkaz je neplatný";
    message =
      "Odkaz pro přihlášení již byl použit nebo jeho platnost vypršela. Vraťte se na přihlašovací stránku a vyžádejte si nový odkaz.";
  } else if (code === "NoRole") {
    title = "Přístup zamítnut";
    message =
      "Váš e‑mail nebyl nalezen mezi oprávněnými uživateli. Zkontrolujte, zda používáte stejnou adresu jako v systému Edookit. Pokud chcete přidat přístup pro další e‑mail, obraťte se na kancelář školy na adrese kancelar@svetoplavci.cz.";
  } else if (code === "NoEnvRole") {
    title = "Přístup do prostředí zamítnut";
    message =
      "Váš účet nemá roli potřebnou pro toto prostředí aplikace. Pokud potřebujete přístup, obraťte se na správce aplikace.";
  }

  return (
    <main className="sv-paper-grain flex min-h-screen flex-col items-center justify-center bg-[#EEF2F7] p-4">
      <div className="relative mx-auto w-full max-w-md rounded-[32px] border border-[#D6DFF0] bg-white p-8 text-center shadow-[var(--sv-shadow-lift)]">
        <p className="sv-eyebrow mb-3 text-[#C8372D]">Přihlášení</p>
        <h1 className="sv-display-sm mb-3 text-[#0E2A5C]">{title}</h1>
        <p className="text-sm text-[#4A5A7C]">{message}</p>
        <a
          href="/auth/signin"
          className="mt-6 inline-flex items-center justify-center rounded-full border-[1.5px] border-[#0E2A5C] bg-[#0E2A5C] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#07173A]"
        >
          Zpět na přihlášení
        </a>
        <p className="sv-eyebrow mt-6 text-[#7F88A0]">
          Školní aplikace Světoplavci
        </p>
      </div>
    </main>
  );
}
