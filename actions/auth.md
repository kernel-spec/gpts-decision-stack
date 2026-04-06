# Autentizační Konfigurace — Backend Binding

## Přehled

Systém `gpts-decision-stack` využívá API klíče pro autentizaci GPT agentů
k backend službě. Každý GPT deployment slot obdrží unikátní API klíč spravovaný
prostřednictvím GitHub Actions secrets a Wrangler secret injection do Cloudflare Worker.

## Metoda autentizace

| Parametr | Hodnota |
|---|---|
| Typ | API klíč |
| HTTP header | `X-API-Key` |
| Správa klíčů | GitHub Actions secrets + Wrangler secret injection |
| Rotace | dle bezpečnostní politiky; po rotaci musí být evidence re-run |
| Scope | jeden klíč per prostředí (dev: `DEV_API_KEY`, prod: `PROD_API_KEY`) |

## Operační secret flow

API klíč je spravován takto:

1. **GitHub Actions secrets**: `DEV_API_KEY` a `PROD_API_KEY` jsou uloženy jako GitHub Actions secrets v repozitáři.
2. **Wrangler secret injection**: Deployment workflow (`deploy-workers.yaml`) nastaví `API_KEY_SECRET` na příslušném Worker prostředí příkazem `wrangler secret put API_KEY_SECRET`.
3. **Worker runtime**: Worker čte `API_KEY_SECRET` z binding prostředí Cloudflare Workers — nikoli z kódu ani ze systémového promptu.

Klíč nesmí být součástí systémového promptu, nesmí být přenášen v konverzaci
a nesmí být ukládán modelem.

Injektování klíče probíhá výhradně prostřednictvím deployment procesu
popsaného v `release/deployment_target.yaml`.

Viz `operations/checklists/ENVIRONMENT_SECRET_ALIGNMENT_CHECKLIST.md` pro postup
ověření souladu secrets a detekci driftu.

## Bezpečnostní pravidla

- Model nikdy neukládá API klíč do paměti konverzace.
- API klíč nesmí být součástí systémového promptu ani uživatelských zpráv.
- Veškerá komunikace mezi GPT agentem a backend službou probíhá přes
  autentizovaný HTTPS endpoint.
- Neplatný nebo chybějící API klíč vrátí `401 Unauthorized`.
- Přístup k endpointu bez odpovídající autority vrátí `403 Forbidden`.

## Founder console action usage

Founder console akce používají stejný model `X-API-Key` jako ostatní GPT action
sloty. Founder console je pouze tenká prezentační a orchestration vrstva nad
Worker kernelem a smí:

- číst kanonický stav pouze přes Worker-backed action endpointy
- ukládat artefakty a model output pouze přes backend write endpointy
- žádat founder rozhodnutí pouze přes explicitní founder action contract

Founder console ani GPT vrstva nesmí tvrdit, že jsou zdrojem pravdy. Zdrojem
pravdy zůstává Worker + D1 + R2 a founder action odpovědi musí být chápány jako
autorizované backendové čtení a zápis tohoto stavu.

Pro founder-level akce platí stejná autentizační očekávání jako pro ostatní
action endpointy:

- každý deployment slot má vlastní API klíč
- klíč opravňuje pouze k definovanému action surface pro daný slot
- pokud lze stav získat founder action endpointem, GPT jej nesmí nahrazovat
  odhadem z konverzace

## Failure policy

| Chyba | HTTP status | Akce |
|---|---|---|
| Chybějící API klíč | 401 | Odmítnutí požadavku, log chyby |
| Neplatný API klíč | 401 | Odmítnutí požadavku, log chyby |
| Klíč bez oprávnění k endpointu | 403 | Odmítnutí požadavku, log chyby |
| Vypršelý klíč | 401 | Odmítnutí požadavku, log chyby, upozornění na rotaci |

## Audit přístupu

Každý pokus o přístup k action endpointu je zaznamenán v Cloud Logging
ve strukturovaném JSON formátu se dvěma povinými hodnotami:
- identifikátor GPT slotu (`submitted_by`)
- identifikátor pipeline session (`session_id`)

Záznamy přístupu jsou uchovávány po dobu 90 dní v produkci.
Záznamy governance endpointů (veto, approval) jsou uchovávány 365 dní.

## Reference

- Action contract: `actions/openapi.yaml`
- Mapování vlastníků endpointů: `operations/endpoint_owner_mapping.yaml`
- Backend binding: `operations/backend_binding.yaml`
- Deployment target: `release/deployment_target.yaml`
