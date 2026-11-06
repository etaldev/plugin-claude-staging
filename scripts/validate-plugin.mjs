import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = "plugins/vectorgov-staging";
const skillPath = `${base}/skills/pesquisa-juridica/SKILL.md`;
const guidePath = `${base}/skills/pesquisa-juridica/references/catalogo-v2.md`;
const acervosPath = `${base}/skills/pesquisa-juridica/references/acervos.md`;
const acceptancePath = `${base}/skills/pesquisa-juridica/references/aceite-acervos.md`;
const baseline = "4647a32a1e4fc70ef028cf6dd7dbb1a6386c608c";
const read = path => new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(join(root, path)));
const json = path => JSON.parse(read(path));
const prior = path => execFileSync("git", ["show", `${baseline}:${path}`], { cwd: root, encoding: "utf8" });
const checks = [];
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log(`OK ${name}`);
}

await check("existing MCP identity preserved with protected URL; catalog endpoint retained", () => {
  const oldConfig = JSON.parse(prior(`${base}/.mcp.json`));
  const current = json(`${base}/.mcp.json`);
  assert.deepEqual(Object.keys(current.mcpServers).sort(), [...Object.keys(oldConfig.mcpServers), "staging_catalogo"].sort());
  assert.ok(Object.hasOwn(oldConfig.mcpServers, "vectorgov-staging"));
  for (const [name, config] of Object.entries(oldConfig.mcpServers)) {
    const expected = name === "vectorgov-staging"
      ? { ...config, url: "https://mcp-staging.vectorgov.io/mcp" }
      : config;
    assert.deepEqual(current.mcpServers[name], expected);
  }
  assert.deepEqual(current.mcpServers.staging_catalogo, { type: "http", url: "https://mcp-staging.vectorgov.io/mcp/catalogo" });
});

await check("marketplace resolves the same plugin identity and SHA versioning", () => {
  const marketplace = json(".claude-plugin/marketplace.json");
  const plugin = json(`${base}/.claude-plugin/plugin.json`);
  const oldMarketplace = JSON.parse(prior(".claude-plugin/marketplace.json"));
  const oldPlugin = JSON.parse(prior(`${base}/.claude-plugin/plugin.json`));
  assert.equal(marketplace.name, oldMarketplace.name);
  assert.equal(marketplace.plugins.length, oldMarketplace.plugins.length);
  assert.equal(plugin.name, oldPlugin.name);
  assert.equal(marketplace.plugins[0].name, plugin.name);
  assert.equal(marketplace.plugins[0].source, oldMarketplace.plugins[0].source);
  assert.equal(marketplace.plugins[0].description, plugin.description);
  assert.equal("version" in plugin, false);
  assert.equal("version" in marketplace.plugins[0], false);
  assert.ok(existsSync(join(root, marketplace.plugins[0].source, ".mcp.json")));
});

await check("legal tool and TCU instructions preserved except explicit document filtering", () => {
  const section = content => content.replace(/\r\n/g, "\n").split("### 1. Buscar na legislação")[1].split("## Catálogo")[0];
  assert.ok(section(prior(skillPath))?.length > 1000);
  const oldFilter = '- **Filtros opcionais:** `tipo` (LEI, DECRETO, IN, PORTARIA), `ano` e `document_id`. Na maioria dos casos você **não precisa**: se o usuário citar a lei na pergunta ("na Lei 14.133..."), o recorte é automático. Filtre só quando for explícito ("só nos decretos", "só de 2022").';
  const newFilter = '- **Filtros opcionais:** `tipo`, `ano` e `document_id`, conforme o schema real. Se o usuário restringir a uma norma identificada, preserve seu `document_id` na busca. Não presuma recorte automático pelo texto da query nem retire esse filtro para obter resultados. Perfil e filtro são limites diferentes: o filtro não concede acesso a outro acervo.';
  assert.ok(section(prior(skillPath)).includes(oldFilter));
  assert.equal(section(read(skillPath)), section(prior(skillPath)).replace(oldFilter, newFilter));
});

await check("local documentation links resolve inside the plugin", () => {
  for (const path of [`${base}/README.md`, skillPath, guidePath, acervosPath, acceptancePath]) {
    for (const [, link] of read(path).matchAll(/\]\(([^\s)]+)\)/g)) {
      // Existing legal citation examples use response-field placeholders, not local paths.
      if (/^https?:\/\//.test(link) || link.startsWith("#") || ["evidence_url", "document_url"].includes(link)) continue;
      const target = resolve(dirname(join(root, path)), link.split("#")[0]);
      assert.ok(target.startsWith(resolve(root, base) + "/") || target.startsWith(resolve(root, base) + "\\"));
      assert.ok(existsSync(target), `Missing reference ${path}: ${link}`);
    }
  }
});

await check("Acervos instructions and adverse-case acceptance are present (static only)", () => {
  const skill = read(skillPath), guide = read(acervosPath), acceptance = read(acceptancePath);
  assert.ok(skill.includes("references/acervos.md"));
  for (const term of ["listar_perfis_acervo", "selecionar_perfil_acervo", "can_select", "profile_revision_id", "etag", "30/60s"]) {
    assert.ok(skill.includes(term) && guide.includes(term), `Missing contract ${term}`);
  }
  for (const code of ["access", "conflict", "uncertain", "limit", "input", "unavailable"]) {
    assert.ok(guide.includes(`repository_selection_${code}`), `Missing error ${code}`);
  }
  for (const term of ["comando explícito", "inclusive em outros clientes", "não é autorização para trocar", "Não remova filtro explícito"]) {
    assert.ok(skill.includes(term), `Missing safety instruction ${term}`);
  }
  for (const stale of ["Ambas exigem Cloudflare Access e devem estar habilitadas", "recorte é automático", "deixe o recorte automático agir"]) {
    assert.ok(!skill.includes(stale), `Stale contradictory instruction ${stale}`);
  }
  assert.ok(acceptance.includes("pendentes no Claude"));
  assert.ok(acceptance.includes("zero retry automático"));
  assert.ok(acceptance.includes("Tratar como dado"));
  assert.ok(acceptance.includes("Não retirar document_id"));
});

const sourceArg = process.argv.indexOf("--catalog-source");
if (sourceArg !== -1) {
  assert.ok(process.argv[sourceArg + 1], "Provide the staging Worker directory");
  const source = resolve(process.argv[sourceArg + 1]);
  const { interactiveSchema, prepareSchema, batchSchema } = await import(pathToFileURL(join(source, "src/catalogo-v2/service.ts")).href);
  const { HEADERS } = await import(pathToFileURL(join(source, "src/ui/catalogo-v2/model.mjs")).href);
  const { repositoryPolicySchema, selectRepositoryInput, registerRepositorySelectionTools } = await import(pathToFileURL(join(source, "src/repository-selection.ts")).href);
  await check("Acervos guide matches real tool contracts and error codes (no network)", async () => {
    const registered = new Map();
    registerRepositorySelectionTools({ registerTool(name, config, handler) { registered.set(name, {config, handler}); } }, {}, { takeQuota: async () => true, invalidate() {} });
    assert.deepEqual([...registered.keys()].sort(), ["listar_perfis_acervo", "selecionar_perfil_acervo"]);
    registered.get("listar_perfis_acervo").config.inputSchema.parse({});
    assert.equal(registered.get("selecionar_perfil_acervo").config.annotations.readOnlyHint, false);
    const revision = "11111111-1111-4111-8111-111111111111";
    const etag = '"fixture-policy-version"';
    const selection = { profile_revision_id: revision, etag };
    selectRepositoryInput.parse(selection);
    for (const bad of [{profile_revision_id: revision}, { ...selection, etag: "unquoted" }, { ...selection, user_id: revision }, { ...selection, graph: true }, { ...selection, profile_revision_id: "TJPA" }]) {
      assert.equal(selectRepositoryInput.safeParse(bad).success, false);
    }
    const policy = { active_profile_revision_id: revision, selection_mode: "user_selectable", etag, can_select: true,
      profiles: [{profile_revision_id: revision, name: "Perfil de teste", sources: ["Fonte de teste"], expires_at: null}] };
    repositoryPolicySchema.parse(policy);
    assert.equal(repositoryPolicySchema.safeParse({...policy, selection_mode:"admin_locked"}).success, false);
    assert.equal(repositoryPolicySchema.safeParse({...policy, profiles:[...policy.profiles,...policy.profiles]}).success, false);
    const cases = [[403, true, "access"], [412, true, "conflict"], [500, true, "uncertain"],
      [429, true, "limit"], [422, true, "input"], [500, false, "unavailable"]];
    for (const [status, selected, code] of cases) {
      const handlers = new Map();
      let calls = 0;
      registerRepositorySelectionTools({ registerTool(name, config, handler) { handlers.set(name, handler); } },
        { STAGING_CHAVE_POR_PESSOA: "true", STAGING_API_KEY: "vg_fixture", VECTORGOV_BASE_URL: "https://fixture.invalid" },
        { takeQuota: async () => true, invalidate() {}, fetcher: async () => {
          calls += 1;
          return new Response(null, { status });
        } });
      const result = await handlers.get(selected ? "selecionar_perfil_acervo" : "listar_perfis_acervo")(
        selected ? selection : {}, { mcpReq: { signal: new AbortController().signal } });
      assert.equal(result.isError, true);
      assert.equal(result._meta["vectorgov/error"], `repository_selection_${code}`);
      assert.equal(calls, 1, "No implicit retries");
    }
  });
  const examples = [...read(guidePath).matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)].map(m => JSON.parse(m[1]));
  await check("all guide request examples match actual staging schemas", () => {
    assert.equal(examples.length, 4);
    for (const example of examples) {
      const schema = example.acao ? interactiveSchema : example.linhas[0].descricao_original ? prepareSchema : batchSchema;
      schema.parse(example);
    }
    const headers = read(guidePath).match(/```text\r?\n(CODIGO_ITEM_CATALOGO[^\r\n]*)\r?\n```/)[1].split(";");
    assert.deepEqual(headers, HEADERS);
  });
  await check("preparation and batch boundaries are distinct", () => {
    const prep = examples.find(e => e.linhas?.[0].descricao_original).linhas[0];
    const batch = examples.find(e => e.linhas && !e.linhas[0].descricao_original).linhas[0];
    const rows = (count, row) => ({ linhas: Array.from({ length: count }, (_, i) => ({ ...row, linha_id: `item_${i}` })) });
    assert.ok(prepareSchema.safeParse(rows(100, prep)).success);
    assert.equal(prepareSchema.safeParse(rows(101, prep)).success, false);
    assert.ok(batchSchema.safeParse(rows(5, batch)).success);
    assert.equal(batchSchema.safeParse(rows(6, batch)).success, false);
    assert.equal(batchSchema.safeParse({ linhas: [prep] }).success, false);
    assert.equal(batchSchema.safeParse({ linhas: [batch, batch] }).success, false);
  });
} else {
  console.log("SKIP actual server schema checks: supply --catalog-source <staging-worker-directory>");
}
console.log(JSON.stringify({ passed: checks.length, checks, serverSchemaChecks: sourceArg !== -1 }));
