# Autentizační Konfigurace — Backend Binding

## Přehled

Systém `gpts-decision-stack` využívá API klíče pro autentizaci GPT agentů
k backend službě. Každý GPT deployment slot obdrží unikátní API klíč spravovaný
prostřednictvím Google Secret Manager.

## Metoda autentizace

| Parametr | Hodnota |
|---|---|
| Typ | API klíč |
| HTTP header | `X-API-Key` |
| Správa klíčů | Google Secret Manager |
| Rotace | každých 90 dní |
| Scope | jeden klíč per GPT deployment slot |

## Founder action contract

Founder-facing contract v `actions/openapi.yaml` obsahuje přesně těchto 7
action operací:

1. `createSession`
2. `getSessionState`
3. `submitArtifact`
4. `triggerReentry`
5. `getDecisionLog`
6. `getVetoStatus`
7. `getApprovals`

Privilegované governance mutace a service health endpoint zůstávají
backend-interní a nejsou součástí founder contractu.

## Injektování klíče do GPT slotu

API klíč je injektován do GPT deployment slotu jako service secret v okamžiku
nasazení. Klíč nesmí být součástí systémového promptu, nesmí být přenášen
v konverzaci a nesmí být ukládán modelem.

Injektování klíče probíhá výhradně prostřednictvím deployment procesu
popsaného v `release/deployment_target.yaml`.

## Bezpečnostní pravidla

- Model nikdy neukládá API klíč do paměti konverzace.
- API klíč nesmí být součástí systémového promptu ani uživatelských zpráv.
- Veškerá komunikace mezi GPT agentem a backend službou probíhá přes
  autentizovaný HTTPS endpoint.
- Každý founder action request v kontraktu vyžaduje hlavičku `X-API-Key`.
- Neplatný nebo chybějící API klíč vrátí `401 Unauthorized`.
- Přístup k endpointu bez odpovídající autority vrátí `403 Forbidden`.

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
