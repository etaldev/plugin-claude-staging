# VectorGov - plugin de staging (uso interno)

Distribuição: **etaldev/plugin-claude-staging**. O plugin comercial `etaldev/plugin-claude` e o MCP Comercial V1 não são alterados. O staging é a base da futura V2; não porte esta atualização para a V1.

## Conexão unificada, sem remover ferramentas

| Servidor no plugin | Endereço | Papel |
| --- | --- | --- |
| `vectorgov-staging` | `https://mcp-staging.vectorgov.io/mcp` | Conexão principal: legislação, seleção de Acervos, TCU e catálogo novo. |
| `staging_catalogo` | `https://mcp-staging.vectorgov.io/mcp/catalogo` | Alias preservado no pacote para compatibilidade; não obrigatório para o uso do `/mcp` unificado. |

Use **`vectorgov-staging` habilitada e autenticada**. O `/mcp` já reúne as ferramentas do catálogo e as demais tools; não é necessário autenticar dois aliases nem repetir buscas entre eles. A configuração `.mcp.json` não é alterada por esta atualização de skill. O antigo endereço `workers.dev` está desativado.

Esta atualização muda instruções e testes do plugin; não altera conexões, não publica Worker, não muda políticas de acesso nem altera a quota **30 chamadas por 60 segundos**. Uma tool pode consumir várias consultas internas; 30 tools/minuto não é uma margem segura.

O servidor continua em `euteajudo/vector_govi_2/vectorgov-mcp-staging`; este repositório distribui o plugin, não hospeda o servidor.

## Atualizar no Claude

### Repositório pelo Claude/Cowork

Abra **Personalizar (Customize) > Plugins**, localize o marketplace `vectorgov-staging` e o plugin de mesmo nome. Use a opção de atualização disponível na sua versão. Se ainda não adicionou, escolha **Adicionar marketplace > Repositório** e informe:

```text
https://github.com/etaldev/plugin-claude-staging
```

Abra uma nova conversa para carregar a skill atualizada. Confira se a instalação veio deste repositório ou de um ZIP antigo: enviar apenas a URL no chat não instala nem atualiza uma conexão MCP.

### Claude Code

Primeira instalação:

```bash
claude plugin marketplace add etaldev/plugin-claude-staging
claude plugin install vectorgov-staging@vectorgov-staging
```

Atualizar somente este plugin:

```bash
claude plugin marketplace update vectorgov-staging
claude plugin update vectorgov-staging@vectorgov-staging
```

Abra uma nova sessão. Use `/mcp` para conferir e autenticar **`vectorgov-staging`**. Não desabilite nem atualize o plugin comercial para realizar o teste.

### Login e painel

Autorize a conexão principal pelo Cloudflare Access com e-mail permitido no staging, quando o cliente solicitar. Não cole senha, código ou token na conversa ou no repositório. Confira as tools dessa conexão; o login do alias antigo não comprova login do principal.

O painel é um MCP App. O suporte depende da superfície do Claude; uma chamada textual no terminal não comprova funcionamento do painel no Desktop/Cowork. Não recrie o painel como HTML local para declarar o teste remoto aprovado. O aceite na instalação do Claude ainda precisa ocorrer.

## Tools novas e skill

| Tool | Uso |
| --- | --- |
| `catalogo_interativo` | Busca, PDM, características, navegação, comparação no painel e consulta por código. |
| `unidades_catalogo` | Unidades oficiais e situação do item, sem converter quantidades. |
| `preparar_planilha_catalogo` | Abre 1 a 100 linhas autorizadas; não consulta nem confirma itens. |
| `consultar_lote_catalogo` | Consulta 1 a 5 linhas por chamada; até 3 candidatos por linha. |

A skill mantém o nome **`vectorgov-staging:pesquisa-juridica`**. Ela usa a conexão unificada e carrega o [guia do catálogo](skills/pesquisa-juridica/references/catalogo-v2.md) ou o [guia de Acervos](skills/pesquisa-juridica/references/acervos.md) conforme a tarefa. As orientações de evidência e proveniência do TCU são preservadas. Tools antigas de catálogo ficam disponíveis para comparação solicitada, sem fallback silencioso diante de falha ou limite.

Peça ao Claude para **usar a skill de staging**, especialmente se o plugin comercial também estiver habilitado.

## Teste do beta de Acervos

Na conta de teste, com os perfis concedidos pelo administrador:

> Use a skill vectorgov-staging:pesquisa-juridica e somente o conector de staging. Liste meus perfis autorizados e informe o ativo e suas fontes. Não altere o perfil ainda.

Depois, se TJPA estiver entre as opções e a troca estiver autorizada:

> Selecione TJPA e consulte o art. 1º da TJPA-IN-01-2026 e da CNJ-RESOLUCAO-347-2020. Faça também um grep por planejamento na IN. Não consulte o comercial.

Por fim, peça explicitamente para selecionar Executivo Federal e consultar a Lei 14.133. O agente deve listar antes de cada troca, usar o ETag atual e confirmar o perfil retornado. A escolha persiste para a conta no staging, inclusive em outros clientes; não é concessão de novo acesso nem união de perfis. O usuário decide o perfil final. Não revogue concessões nem altere toggles como parte deste roteiro.

O [roteiro de aceite da skill](skills/pesquisa-juridica/references/aceite-acervos.md) inclui casos negativos. Validação estática e schemas não comprovam o comportamento do modelo no Claude; esse aceite deve ser registrado após instalar a versão aprovada.

## Primeiro teste: papel A4

Na conversa nova:

> Use a skill vectorgov-staging:pesquisa-juridica e leia seu guia do catálogo V2. Use somente vectorgov-staging. Abra a busca de papel A4 branco 75 g/m2, com embalagem de 500 folhas. Mostre PDM, características, diferenças e unidades oficiais. Não confirme itens por mim e não use o MCP comercial.

Confira as quatro tools e a abertura do painel remoto. Refine características, compare candidatos, escolha unidade oficial e revise antes de exportar. Um resultado de referência é o CATMAT 461819, mas não é resposta fixa para qualquer papel A4.

## Segundo teste: planilha variada

Anexe uma lista pequena com papel, caneta, copo e detergente:

> Use a skill de staging e o catálogo novo para preparar esta planilha. Preserve descritivos, ordem, unidades e quantidades. Consulte respeitando 30/60s. Mostre incompatibilidades e características pendentes; deixe a confirmação de código e unidade para mim. Não use o comercial.

Se consultar pelo painel, não rode lote pelo agente em paralelo. Não precisa começar com 100 linhas. Para testar aviso de unidade, confira CATMAT 438827 com Frasco 500 ML sem forçar equivalência com LITRO.

## Arquivo para download

O upload tem seis colunas; `VALOR_UNITARIO` e `INFORMACOES_COMPLEMENTARES` ficam vazios. Só linhas revisadas com unidade e formato conferidos entram. Na exportação parcial, o usuário deve saber quais linhas ficaram de fora.

Sem download nativo, o App solicita entrega na conversa. A skill orienta decodificar o payload, conferir tamanho/hash e gerar arquivo real, sem repetir buscas. Mensagem enviada não significa arquivo entregue.

**Importação na área logada do Compras.gov.br ainda não homologada.** Quantidade não vira sétima coluna. Tasks continua fora do escopo.

## Versionamento e manutenção

Nomes de plugin, marketplace e skill preservados. Manifest continua sem `version`, mantendo atualização por SHA. O aviso de versão ausente na validação é esperado.

Mudanças posteriores ficam no staging. Preserve ferramentas existentes e limites do servidor. Não grave credenciais nem promova alterações para `vectorgov-mcp-comercial-v1` ou `etaldev/plugin-claude`.

Validação para manutenção, na raiz do repositório: `claude plugin validate .`, `claude plugin validate plugins/vectorgov-staging` e `node scripts/validate-plugin.mjs`. Com Node que suporte TypeScript e checkout do servidor com dependências instaladas, acrescente `--catalog-source <diretorio-vectorgov-mcp-staging>` ao último comando para validar exemplos contra os schemas reais. Sem esse argumento, essa parte é explicitamente marcada como não executada. O teste de preservação usa o commit-base `4647a32`, que deve existir no clone.

Referências: [plugins no Claude/Cowork](https://support.claude.com/en/articles/13837440-use-plugins-in-claude) e [gerenciamento no Claude Code](https://code.claude.com/docs/en/discover-plugins).
