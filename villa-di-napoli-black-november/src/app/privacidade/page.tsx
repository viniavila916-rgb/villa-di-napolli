import type { Metadata } from "next";
import Link from "next/link";
import { campaign } from "@/config/campaign";
import { isDbConfigured } from "@/lib/db";
import { getSettings, settingDefaults, type Settings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Política de privacidade | Black November Villa di Napoli",
  robots: { index: false, follow: true },
};

export default async function Privacidade() {
  let s: Settings = { ...settingDefaults };
  if (isDbConfigured()) {
    try {
      s = await getSettings();
    } catch {
      /* mantém os padrões */
    }
  }
  const company = s.company_legal_name || campaign.builder;

  return (
    <main className="on-paper min-h-dvh bg-paper px-5 py-12 text-text sm:py-20">
      <article className="mx-auto grid max-w-2xl gap-5">
        <Link href="/" className="text-sm font-semibold text-gold-deep underline underline-offset-2">
          Voltar para a página do plantão
        </Link>
        <h1 className="text-4xl sm:text-5xl">Política de privacidade</h1>
        <p className="text-muted">Campanha {campaign.name}</p>

        <h2 className="mt-4 text-2xl">Quem cuida dos seus dados</h2>
        <p>
          {company}
          {s.company_cnpj ? `, CNPJ ${s.company_cnpj},` : ""} é a responsável (controladora) pelos
          dados informados nesta página.
        </p>

        <h2 className="mt-4 text-2xl">Quais dados pedimos</h2>
        <ul className="grid list-disc gap-1 pl-5">
          <li>Nome completo e número de WhatsApp (obrigatórios para reservar o horário).</li>
          <li>E-mail e faixa de renda familiar (opcionais).</li>
          <li>Dia e horário escolhidos e a origem do acesso (por exemplo, o anúncio que trouxe você).</li>
        </ul>

        <h2 className="mt-4 text-2xl">Para que usamos</h2>
        <ul className="grid list-disc gap-1 pl-5">
          <li>Reservar e organizar o seu atendimento no plantão dos dias 27, 28 e 29 de novembro de 2026.</li>
          <li>Enviar a confirmação e os lembretes do agendamento pelo WhatsApp informado.</li>
          <li>Orientar você sobre as possibilidades de financiamento, quando a faixa de renda é informada.</li>
          <li>
            Enviar novidades e ofertas da {campaign.builder}, somente se você marcar essa opção no
            formulário.
          </li>
        </ul>
        <p>
          A base legal é o seu consentimento e os procedimentos preliminares de um possível
          contrato, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
        </p>

        <h2 className="mt-4 text-2xl">Com quem compartilhamos</h2>
        <p>
          Os dados são acessados apenas pela equipe comercial responsável pelo plantão e pelos
          fornecedores de tecnologia que hospedam este site e o banco de dados. Não vendemos seus
          dados.
        </p>

        <h2 className="mt-4 text-2xl">Grupo de WhatsApp</h2>
        <p>
          A entrada na Lista VIP do WhatsApp é opcional e feita por você. Em grupos tradicionais de
          WhatsApp, os demais participantes podem ver o seu número.
        </p>

        <h2 className="mt-4 text-2xl">Cookies e medição</h2>
        <p>
          Com a sua autorização, usamos ferramentas de medição (como Google e Meta) para entender o
          resultado da campanha. Você pode recusar os cookies sem perder o acesso ao agendamento.
        </p>

        <h2 className="mt-4 text-2xl">Por quanto tempo guardamos</h2>
        <p>
          Pelo tempo necessário para o atendimento e o relacionamento comercial decorrente da
          campanha, ou até você pedir a exclusão.
        </p>

        <h2 className="mt-4 text-2xl">Seus direitos</h2>
        <p>
          Você pode pedir acesso, correção ou exclusão dos seus dados e retirar o consentimento a
          qualquer momento
          {s.privacy_contact_email ? (
            <>
              {" "}
              pelo e-mail{" "}
              <a className="font-semibold underline" href={`mailto:${s.privacy_contact_email}`}>
                {s.privacy_contact_email}
              </a>
              .
            </>
          ) : (
            " falando com a equipe de atendimento da construtora."
          )}
        </p>
      </article>
    </main>
  );
}
