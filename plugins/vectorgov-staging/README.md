# VectorGov — plugin de STAGING (uso interno)

> **Este não é o plugin de clientes.** O oficial é [`etaldev/plugin-claude`](https://github.com/etaldev/plugin-claude) (`vectorgov@vectorgov`), pinado por versão e apontando para `mcp.vectorgov.io`. Este aqui aponta para o **servidor de staging** e existe para testar skill e tools experimentais **juntas**, antes de promover ao comercial.

## Para que serve

O worker de staging é um espelho do comercial mais os experimentos em validação. Empacotá-lo como plugin permite:

- iterar **skill + tools** no mesmo ciclo (a skill é o que ensina o Claude a usar a tool — testar uma sem a outra não prova nada);
- rodar **A/B** contra a skill comercial com as duas instaladas;
- promover ao comercial por **diff**, porque o corpo das duas skills é o mesmo fora dos deltas declarados.

## Instalação

```bash
claude plugin marketplace add etaldev/plugin-claude-staging
claude plugin install vectorgov-staging@vectorgov-staging
```

Na primeira consulta o Claude pede o login OAuth do servidor de staging (mesma mecânica do comercial — o worker é o próprio Authorization Server). Coexiste com o plugin oficial: os nomes de plugin, marketplace e servidor são distintos, e a skill fica qualificada como `vectorgov-staging:pesquisa-juridica`.

## Versionamento: por SHA, de propósito

O `plugin.json` **omite o campo `version`**. Pela [referência oficial de plugins](https://code.claude.com/docs/en/plugins-reference#version-management), sem `version` o Claude Code usa o **commit SHA** do git — todo commit vira um update disponível, sem cerimônia de bump. É o que se quer em staging.

O comercial continua **pinado por versão**: cliente não deve receber update a cada commit.

```bash
claude plugin update vectorgov-staging@vectorgov-staging
```

Consequência prática ao validar: `claude plugin validate` emite **1 aviso** — `version: No version specified` — em cada manifest. **É o comportamento esperado**, não um defeito a consertar: adicionar `version` aqui pinaria o plugin e quebraria o update por commit.

## Como testar contra a skill comercial

**Modo padrão (os dois plugins habilitados)** — é o caminho do dia a dia: invoque explicitamente, sem desabilitar nada.

```
usa a skill de staging: quais os casos de dispensa?
```

ou `/vectorgov-staging:pesquisa-juridica`.

**Modo A/B puro (comercial desabilitado)** — `claude plugin disable` é **persistente**: vale até você reabilitar e afeta sessões paralelas. Checklist da sessão:

```bash
claude plugin disable vectorgov@vectorgov
# … testar …
claude plugin enable vectorgov@vectorgov
```

Reabilite ao fim e evite sessões paralelas no intervalo. A skill de staging cobre esse modo (atende pergunta jurídica normal quando a comercial está desabilitada), então não há buraco de roteamento.

## Tools do servidor de staging

As **13 do comercial** — `hybrid`, `lookup`, `grep`, `filtrar_por_tema`, `menu`, os 4 `*_catalogo` e os 4 `acordaos_*` — mais **2 exclusivas**:

| Tool | O que faz | Flag |
|---|---|---|
| `avaliar_busca` | Registra 👍/👎 sobre os **dispositivos** trazidos pela última busca da conversa | `FEEDBACK_ENABLED` |
| `classificar_planilha_catalogo` | Classifica até **100** descrições em códigos CATMAT/CATSER em lote, com status `encontrado`/`revisar`/`sem_correspondencia` | `CATALOGO_APP_ENABLED` |

Há também **2 recursos MCP App** (painéis de busca e de catálogo), atrás de `BUSCA_APP_ENABLED` e `CATALOGO_APP_ENABLED` — **ainda pendentes de validação num host MCP Apps real**. No Claude Code a resposta chega como texto.

Flags vivem em `vectorgov-mcp-staging/wrangler.jsonc`, no monorepo. **Tool ausente ≠ flag desligada**: confira na ordem (1) a flag, (2) se o worker está com deploy defasado — o deploy do staging é **manual** de propósito, (3) regressão.

## Promover um experimento ao comercial

Registrar a tool no worker comercial é só o começo. Checklist completo:

1. **Worker comercial** (`vectorgov-mcp-comercial-v1/`, PR no monorepo): portar a implementação, o registro da tool, a entrada em `toolsFor()` (`src/consent.ts` — inventário público) e as feature flags no `wrangler.jsonc`.
2. **Testes**: portar os testes do staging (`src/*.test.mjs`) e passar no type-check.
3. **Se for MCP App**: portar resource + bundle do widget — só depois de validado em host MCP Apps real.
4. **Gates**: `check-banned-terms` (política de privacidade) e CI verdes.
5. **Deploy do comercial**: só por CI (`deploy-workers.yml`). Nunca `wrangler deploy` manual — já reverteu produção por subir de disco defasado.
6. **Skill comercial** (`etaldev/plugin-claude`): portar a seção correspondente + o mapa de nomes e **bumpar `version`** no `plugin.json`.
7. **Smoke test** no comercial e, por fim, remover a seção do experimento aqui — o delta volta ao mínimo.

## Regra anti-drift

O corpo da skill de staging é **espelho** da comercial. Deltas legítimos, e somente estes:

- **na skill**: `description` própria · nota de topo · seção "Experimentos (só no staging)" · as 2 entradas extras no mapa de nomes técnicos;
- **no plugin**: `.mcp.json` (URL e nome do servidor) · `plugin.json` (nome, ausência de `version`, description/keywords de staging) · este README.

Qualquer outra divergência é drift a corrigir na próxima sincronização.
