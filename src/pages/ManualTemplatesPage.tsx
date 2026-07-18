import { useEffect } from 'react';
import { useSessionStore } from '@/stores/session';

type Exemplo = { chave: string; descricao: string };

const SECOES: { titulo: string; itens: Exemplo[] }[] = [
  {
    titulo: 'Valores do formulário',
    itens: [
      { chave: '{{nome_cliente}}', descricao: 'Campo simples: usa a chave do campo no formulário.' },
      { chave: '{{endereco.cidade}}', descricao: 'Campo dentro de um agrupamento ou de uma lista dinâmica.' },
    ],
  },
  {
    titulo: 'Listas e cálculos',
    itens: [
      { chave: '{{itens|sum()}}', descricao: 'Soma os valores de uma lista de números.' },
      { chave: '{{vendas|sum(@value.qtd * @value.preco)}}', descricao: 'Soma calculada: a expressão roda para cada item da lista.' },
      { chave: '{{ativos = pessoas|filter(@value.ativo == true)}}', descricao: 'Filtra a lista e guarda o resultado num nome, para usar depois. Não imprime nada.' },
      { chave: '{{tipo|map("1" => "Físico", "2" => "Digital")}}', descricao: 'Traduz o valor armazenado para um texto legível.' },
    ],
  },
  {
    titulo: 'Condições',
    itens: [
      { chave: '{{#if ativo}}Ativo{{#else}}Inativo{{/if}}', descricao: 'Escolhe um texto conforme a condição. Também funciona em blocos (a chave sozinha no parágrafo).' },
      { chave: '{{#hide-if total == 0}}', descricao: 'Esconde o parágrafo (ou a linha da tabela) quando a condição é verdadeira.' },
    ],
  },
  {
    titulo: 'Imagens e códigos',
    itens: [
      { chave: '{{#picture foto}}', descricao: 'Insere a imagem enviada no campo (aceita base64 ou data-URI).' },
      { chave: '{{#qrcode endereco 150}}', descricao: 'Gera um QR-code com o conteúdo do campo. O número é o lado, em pixels.' },
      { chave: '{{#barcode codigo CODE128 200 100}}', descricao: 'Gera um código de barras: campo, formato, largura e altura.' },
    ],
  },
];

/**
 * Manual técnico de criação de templates (modelos_documentos:45). O acesso é restrito a
 * quem tem permissão de documentos (:46) — a checagem acontece aqui e o menu não expõe
 * a URL para os demais.
 */
export function ManualTemplatesPage() {
  const can = useSessionStore((s) => s.can);
  const status = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);

  // Esta página abre em ABA PRÓPRIA (fora do AppShell), e é o AppShell quem dispara o
  // bootstrap da sessão. Sem isto o `can()` roda com a sessão vazia e a tela mostrava
  // "acesso restrito" até para o administrador.
  useEffect(() => {
    if (status === 'idle') void bootstrap();
  }, [status, bootstrap]);

  if (status === 'idle' || status === 'booting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="text-sm text-slate-400">Carregando…</p>
      </div>
    );
  }

  if (!can('documents:read')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md rounded-md border border-slate-200 bg-white p-6 text-center">
          <h1 className="text-base font-semibold text-slate-900">Acesso restrito</h1>
          <p className="mt-1 text-sm text-slate-600">
            Este manual é exclusivo para quem trabalha com modelos de documentos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl" data-testid="manual-templates">
        <header className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Manual técnico</p>
          <h1 className="text-lg font-semibold text-slate-900">Como montar um modelo de documento</h1>
          <p className="mt-1 text-sm text-slate-600">
            Escreva o documento normalmente no Word (ou LibreOffice) e coloque as chaves onde o
            valor deve aparecer. Ao enviar o arquivo, o sistema valida a sintaxe e aponta os erros.
          </p>
        </header>

        {SECOES.map((s) => (
          <section key={s.titulo} className="mb-4 overflow-hidden rounded-md border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {s.titulo}
            </h2>
            <ul className="divide-y divide-slate-100">
              {s.itens.map((i) => (
                <li key={i.chave} className="px-4 py-3">
                  <code className="block break-all rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">{i.chave}</code>
                  <p className="mt-1 text-sm text-slate-600">{i.descricao}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="px-1 pb-6 text-xs text-slate-500">
          Dica: use o botão <strong>Buscar campos disponíveis</strong> no editor do modelo para ver as
          chaves reais de cada serviço, e o botão <strong>Testar</strong> para gerar um documento de
          exemplo antes de publicar.
        </p>
      </div>
    </div>
  );
}
