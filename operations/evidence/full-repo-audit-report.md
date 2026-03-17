# Full-Repo Audit Report — gpts-decision-stack

**Datum auditu:** 2026-03-17  
**Typ auditu:** Konzistence a readiness truthfulness — end-to-end  
**Režim:** Fail-closed, přísný. Hodnoceno pouze podle skutečného obsahu repa.

---

## 1. Executive Verdict

```
overall_status:             FAIL
repo_integrity_status:      PASS
deployment_readiness_status: FAIL
bundle_classification:      REPO-READY SKELETON
deploy_ready:               false
```

**Zdůvodnění:** Autoritativní gate artefakt (`qa/final-gate-report.yaml`) eviduje
`overall_status: FAIL` a `deploy_ready: false`. Dev runtime evidence je silná
(ACTIONS, STRONG_PARTIAL), backend je IMPLEMENTATION-BACKED, všechny repo vrstvy
fyzicky existují — avšak fail-closed governance vyžaduje dokončení PROV-002
(evaluace acceptance testů oproti live backendu) a produkčního provisioningu
před flipem na DEPLOY-READY STACK.

---

## 2. Repo Audit Result

**Výsledek: PASS s opravami**

Nalezené problémy (opraveny v tomto auditu):

| # | Soubor | Problém | Opraveno |
|---|--------|---------|----------|
| 1 | `wrangler.toml` (root) | Malformovaný soubor (literal `\n` escape sekvence, zkrácené UUID), není v kanonickém manifestu | ✅ ODSTRANĚNO |
| 2 | `operations/endpoint_owner_mapping.yaml` | Platform drift: Cloud Run / Cloud Firestore / Cloud Storage místo Cloudflare Workers / D1 / R2 | ✅ OPRAVENO |
| 3 | `operations/evidence/audit-evidence-bundle-dev.yaml` | Stale `blocking_reasons: [fixture_completeness_fail]` — fixtures jsou PASS dle QA gate reportu | ✅ OPRAVENO |
| 4 | `operations/evidence/runtime-end-to-end-summary.yaml` | Stale `blocking_reason: [fixture_completeness_fail]` — stejný problém | ✅ OPRAVENO |
| 5 | `qa/final-gate-report.yaml` PROV-001 | Stale `placeholder_values` (REPLACE_WITH_*) — wrangler.toml již obsahuje reálná UUID | ✅ OPRAVENO |
| 6 | `operations/Definition_of_Done.md` | Fáze 2 a 3 aktuální stav odkazoval na staré blokátory (knowledge/checklisty chybí, backend binding chybí) | ✅ OPRAVENO |
| 7 | `operations/Management_Summary_Checklist.md` | Tabulky stavu ukazovaly ❌ CHYBÍ pro knowledge, checklisty, promotion gate, backend binding | ✅ OPRAVENO |
| 8 | `release/authoritative_release_notes.md` | Blokátory odkazovaly na fyzicky chybějící soubory, které již existují | ✅ OPRAVENO |

---

## 3. Governance Consistency Result

**Výsledek: PASS** (po opravách)

- `qa/final-gate-report.yaml` ↔ `operations/gates/promotion-gate.yaml`: konzistentní (`overall_status: FAIL`, `bundle_classification: REPO-READY SKELETON`, `staging: BLOCKED`, `prod: BLOCKED`)
- `operations/operational_ownership_map.yaml`: konzistentní s manifestem a artefakt schématy
- `operations/operational_approval_map.yaml`: konzistentní s governance modelem
- `operations/operational_veto_mapping.yaml`: konzistentní s governance modelem
- `operations/Definition_of_Done.md`: aktualizováno, konzistentní s aktuálním stavem
- `operations/Management_Summary_Checklist.md`: aktualizováno, konzistentní s QA gate reportem
- `release/authoritative_release_notes.md`: aktualizováno, konzistentní s aktuálním stavem
- Governed verdict je konzistentní: `FAIL` / `REPO-READY SKELETON` / `deploy_ready: false` napříč všemi autoritativními artefakty

---

## 4. Backend / Actions Consistency Result

**Výsledek: PASS** (po opravách)

| Kontrola | Status | Poznámka |
|----------|--------|----------|
| `actions/openapi.yaml` ↔ `backend/worker/src/router.ts` | PASS | 11 operationIds v OpenAPI, 11 routovaných endpointů v router.ts |
| `actions/openapi.openai.yaml` (builder-safe import) | PASS | OpenAI Actions import schéma, odkazuje na dev URL |
| `actions/auth.md` | PASS | Dokumentuje X-API-Key auth, konzistentní s `backend_binding.yaml` |
| `operations/backend_binding.yaml` | PASS | Správně říká Cloudflare Workers / D1 / R2 / KV |
| `operations/endpoint_owner_mapping.yaml` | PASS (po opravě) | Platform references opraveny z GCP na Cloudflare |
| `backend/worker/wrangler.toml` | PASS | Reálná UUID pro D1/KV (dev + prod), R2 bucket names |
| `release/deployment_target.yaml` | PASS | Odkazuje na `backend/worker/wrangler.toml` a `.github/workflows/deploy-workers.yaml` |
| Root `wrangler.toml` | ODSTRANĚNO | Malformovaný duplicitní soubor, nebyl v kanonickém manifestu |
| Schema drift (openapi.yaml ↔ openapi.openai.yaml) | PASS | Builder-safe import je zúžená verze action contractu — konzistentní |
| Server URL konzistence | INFORMAČNÍ | `openapi.yaml` = prod URL; `openapi.openai.yaml` = dev URL (záměrné, dev GPT slot) |

---

## 5. Evidence-Chain Consistency Result

**Výsledek: PASS** (po opravách)

| Kontrola | Status | Poznámka |
|----------|--------|----------|
| `repo.manifest.yaml` odkazuje na `operations/evidence/audit-evidence-bundle-dev.yaml` | PASS | Kanonický evidence bundle je v manifestu |
| Evidence bundle `governance_status` ↔ QA gate report | PASS (po opravě) | Stale `fixture_completeness_fail` odstraněno |
| `runtime-end-to-end-summary.yaml` ↔ QA gate report | PASS (po opravě) | Stale blocking reason odstraněno |
| Evidence bundle neupravuje governed FAIL verdict | PASS | `deploy_ready: false`, `overall_status: FAIL` zachováno |
| Runtime evidence je oddělena od deployment readiness | PASS | Evidence bundle explicitně říká: "runtime success does not override fail-closed governance" |
| Promotion gate odkazuje na evidence refs | PASS | `evidence_refs.runtime_dev` odkazuje na bundle |
| Žádné falešné PASS / deploy-ready claims | PASS | Žádný soubor netvrdí DEPLOY-READY STACK ani `deploy_ready: true` |

---

## 6. Exact Blocker List

**Aktuální platné blokátory (2 informační):**

### PROV-001 — Produkční Cloudflare provisioning
- **Typ:** Informační (neblokuje REPO-READY SKELETON)
- **Stav:** Dev prostředí je live a provisionováno (evidováno v audit-evidence-bundle-dev.yaml)
- **Co chybí:** Produkční Cloudflare infrastruktura + GitHub Secrets pro prod deployment
- **Akce:** Nastavit `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` jako GitHub Secrets; `wrangler secret put API_KEY_SECRET` pro prod; verifikovat prod D1/R2/KV prostředky

### PROV-002 — Evaluace acceptance testů
- **Typ:** Informační (neblokuje REPO-READY SKELETON)
- **Stav:** 12 acceptance testů (AC-001–AC-012) fyzicky existuje jako YAML definice
- **Co chybí:** Evaluace testů oproti live backendu (ne pouze definice)
- **Akce:** Spustit acceptance testy vůči dev (nebo staging) live backendu a zdokumentovat výsledky

**Žádné jiné blokátory neexistují.** Všechny repo vrstvy jsou fyzicky přítomné a konzistentní.

---

## 7. Exact File-Level Findings

### Finding 1
- **severity:** critical
- **file:** `wrangler.toml` (root)
- **exact issue:** Soubor obsahuje literal `\n` escape sekvence místo skutečných zalomení řádků a zkrácené UUID (`597ae973-2869-4ebb-89b` místo `597ae973-2869-4ebb-89bd-1ebc62ac6674`). Není v kanonickém manifestu.
- **why it matters:** Malformovaný TOML soubor v rootu může být omylem použit místo kanonického `backend/worker/wrangler.toml`; zkrácené UUID by způsobilo selhání deployment příkazů.
- **minimal fix:** Odstraněno (soubor smazán).

### Finding 2
- **severity:** critical
- **file:** `operations/endpoint_owner_mapping.yaml`
- **exact issue:** `runtime_dependency` hodnoty odkazovaly na GCP služby: "Cloud Run health check", "Cloud Firestore", "Cloud Storage" — ale skutečný backend je Cloudflare Workers s D1, R2, KV.
- **why it matters:** Kritický platform drift v governance dokumentaci — operátoři by prováděli debugging a monitorování na špatné platformě.
- **minimal fix:** Nahrazeno správnými Cloudflare hodnotami: "Cloudflare Workers health check", "Cloudflare D1 (DECISIONS_DB)", "Cloudflare R2 (ARTIFACTS_BUCKET)".

### Finding 3
- **severity:** high
- **file:** `operations/evidence/audit-evidence-bundle-dev.yaml`
- **exact issue:** `governance_status.blocking_reasons: [fixture_completeness_fail]` — stale blokátor. Fixtures jsou PASS dle `qa/final-gate-report.yaml` (`fixture_pack: status: PASS`, `blocking_gaps: []`).
- **why it matters:** Evidence chain obsahovala nepravdivý blokátor, který by mátl operátory ohledně skutečného stavu repa.
- **minimal fix:** `blocking_reasons: []`, aktualizován `governance_note` s přesnými skutečnými blokátory (PROV-001, PROV-002).

### Finding 4
- **severity:** high
- **file:** `operations/evidence/runtime-end-to-end-summary.yaml`
- **exact issue:** `governance_status.blocking_reason: [fixture_completeness_fail]` — identický stale blokátor.
- **why it matters:** Duplicitní stale evidence v evidenčním řetězci.
- **minimal fix:** `blocking_reason: []`, aktualizována note.

### Finding 5
- **severity:** high
- **file:** `qa/final-gate-report.yaml` (PROV-001)
- **exact issue:** `placeholder_values` obsahovalo "REPLACE_WITH_D1_DATABASE_ID" atd., ale `backend/worker/wrangler.toml` již obsahuje reálná UUID pro dev i prod prostředí.
- **why it matters:** PROV-001 popis byl fakticky nepravdivý — popisoval stav před provisioningem, ne aktuální stav.
- **minimal fix:** Odstraněna sekce `placeholder_values`, aktualizován popis PROV-001 aby odrážel skutečný stav (dev live, prod pending).

### Finding 6
- **severity:** medium
- **file:** `operations/Definition_of_Done.md`
- **exact issue:** Fáze 2 aktuální stav: "NESPLNĚNO — knowledge soubory a operační checklisty chybí" (stale). Fáze 3 aktuální stav: "NESPLNĚNO — backend binding chybí" (stale).
- **why it matters:** Stale stav v DoD způsobuje zmatek ohledně toho, co skutečně zbývá do DEPLOY-READY STACK.
- **minimal fix:** Aktualizovány aktuální stavy Fáze 2 (SPLNĚNO) a Fáze 3 (NESPLNĚNO z důvodu PROV-002, ne z důvodu chybějícího backendového bindingu).

### Finding 7
- **severity:** medium
- **file:** `operations/Management_Summary_Checklist.md`
- **exact issue:** Tabulky stavu ukazovaly ❌ CHYBÍ pro: knowledge soubory (16), operační checklisty (4), promotion gate, backend binding — přestože všechny fyzicky existují.
- **why it matters:** Management checklist byl v přímém rozporu s fyzickým stavem repa, což by vedlo k chybným managementovým rozhodnutím.
- **minimal fix:** Aktualizovány tabulky stavu na ✅ SPLNĚNO, aktualizovány kritické blokátory na PROV-001 a PROV-002.

### Finding 8
- **severity:** medium
- **file:** `release/authoritative_release_notes.md`
- **exact issue:** Blokátory pro produkci uváděly: knowledge soubory chybí, operační checklisty chybí, promotion gate chybí, backend binding chybí — přestože vše fyzicky existuje.
- **why it matters:** Autoritativní release notes s nepravdivými blokátory porušují governance pravidlo, že tyto dokumenty musí odrážet skutečný fyzický stav.
- **minimal fix:** Aktualizován verze/popis, obsah vydání rozšířen o existující vrstvy, blokátory aktualizovány na PROV-001 a PROV-002.

---

## 8. Final Conclusion

### Co je 100 % hotové

- Kompletní prompt pack (12 systémových promptů: 4 CP + 8 AE)
- Kompletní schémata artefaktů (10 kanonických artefaktů)
- Acceptance fixtures (10 souborů, 4 domény)
- Acceptance testy (AC-001–AC-012, 12 souborů) — jako YAML definice
- Governance mapy (ownership, approval, veto)
- Knowledge vrstva (7 core INVARIANT + 9 domain ADAPTIVE = 16 souborů)
- Operační checklisty (local/dev/staging/prod)
- Promotion gate
- Backend binding: Cloudflare Worker TypeScript implementace (IMPLEMENTATION-BACKED)
- API binding contract (actions/openapi.yaml, actions/openapi.openai.yaml)
- Auth dokumentace (actions/auth.md)
- Deployment target manifest (release/deployment_target.yaml)
- Dev runtime evidence (audit-evidence-bundle-dev.yaml — ACTIONS, STRONG_PARTIAL)
- Dev prostředí live na `https://gpts-decision-stack-dev.victorain92.workers.dev`
- Celý pipeline end-to-end ověřen v dev (intake → release_decision)
- Repo-control soubory (MASTER_SPEC.md, repo.manifest.yaml)
- Všechny YAML soubory syntakticky validní

### Co je částečně hotové

- **Acceptance testy** — definovány jako YAML, ale nebyly evaluovány oproti live backendu (PROV-002)
- **Produkční infrastruktura** — dev je live, prod resource IDs jsou v `backend/worker/wrangler.toml`, ale prod provisioning nebyl dokončen (PROV-001)

### Co zbývá do DEPLOY-READY STACK

1. **PROV-002**: Evaluace acceptance testů (AC-001–AC-012) oproti live dev/staging backendu a zdokumentování výsledků
2. **PROV-001**: Produkční Cloudflare provisioning + GitHub Secrets pro prod CI/CD deployment
3. Po splnění PROV-001 a PROV-002: Flip `qa/final-gate-report.yaml` na `overall_status: PASS` a `bundle_classification: DEPLOY-READY STACK` s evidencí

---

## Audit verdict

**Minimální remediační plán byl aplikován** (8 nálezů opraveno). Všechny opravy jsou
konzistentní s fail-closed governance — `overall_status: FAIL` a `deploy_ready: false`
zůstávají nezměněny. Žádné falešné PASS nebylo zavedeno. Repo je nyní konzistentní.
