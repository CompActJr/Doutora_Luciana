import { requireUser } from "@/lib/session";
export default async function ResponsesPage() {
  await requireUser();
  return <section className="card"><h1 className="mb-3 text-2xl font-semibold">Respostas</h1>
    <p>Seu acesso ao painel está ativo. A edição de respostas será disponibilizada na próxima etapa.</p>
  </section>;
}
