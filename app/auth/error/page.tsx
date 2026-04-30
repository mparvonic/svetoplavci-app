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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0E2A5C] via-[#0E2A5C] to-[#C8372D] p-4 text-white">
      <div className="mx-auto w-full max-w-md rounded-3xl bg-black/40 p-8 text-center shadow-2xl backdrop-blur-sm">
        <h1 className="mb-2 text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="text-sm text-white/90">{message}</p>
        <a
          href="/auth/signin"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-normal text-[#0E2A5C]"
        >
          Zpět na přihlášení
        </a>
        <p className="mt-6 text-[11px] uppercase tracking-normal text-white/60">
          Školní aplikace Světoplavci
        </p>
      </div>
    </div>
  );
}
