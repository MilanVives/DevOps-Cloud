# Final Assessment — Devops & Cloud Computing (80%)

> Docker, Docker Compose en Minikube worden al apart geëvalueerd via [PE1](1-PE_Compose-Devops.md) en [PE2](2-PE_Minikube-Devops.md) en tellen hier niet opnieuw mee.

Voor het vak Devops & Cloud Computing (V3R316) lever je een eigen project op en verdedig je dit tijdens de examenperiode mondeling (zie [Mondelinge Verdediging](mondelinge-verdediging.md)).

Dit is de laatste stap: je neemt de applicatie die je al gecontaineriseerd hebt (PE1) en lokaal getest hebt op Minikube (PE2), en deployt ze nu **echt naar een Kubernetes-cluster in de cloud**, met productierijpe features: secrets management, Helm, meerdere omgevingen, HTTPS, CI/CD en monitoring.

---

## ⛔ Uitsluitingscriterium — lees dit eerst

> [!CAUTION]
> Voldoet je deployment **niet** aan onderstaande drie voorwaarden, dan kan je voor de eindopdracht **niet slagen**, ongeacht de kwaliteit van de rest van je project.

**1. Een echte multi-node cluster in de cloud**

- Minstens **3 worker nodes**, elk op een **eigen VM/instance** bij een cloudprovider, plus een control plane.
- ✅ Toegelaten: managed Kubernetes (Linode LKE, Azure AKS, AWS EKS, Google GKE, DigitalOcean DOKS, …) of k3s/kubeadm verspreid over **minstens 3 afzonderlijke VM's**.
- ❌ **Niet** toegelaten: Minikube, kind, k3d, Docker Desktop, of **eender welke cluster op één enkele VM** — ook niet als die "3 nodes" toont (bv. k3d/kind/minikube met meerdere nodes in containers op dezelfde machine).

**2. Publiek bereikbaar**

- De applicatie is vanaf het internet bereikbaar via **HTTPS op een domeinnaam**, zonder browserwaarschuwing.

**3. Schaalbaar**

- Frontend en backend draaien met **minstens 2 replicas**, verspreid over verschillende nodes (`topologySpreadConstraints`).
- De backend heeft een **HorizontalPodAutoscaler** (zie [Les 13 – Scalability](../../13-Scalability/)).

**Hoe dit gecontroleerd wordt**

- Je Helm chart bevat een kleine **`nodeinfo`**-service (staat al klaar in de template — **niet verwijderen**). Die toont op `https://<jouw-domein>/nodeinfo` de naam van de node waarop ze draait. De automatische controle roept die URL herhaaldelijk op en verwacht **minstens 3 verschillende nodenamen**.
- Bij het begin van de mondelinge verdediging toon je live `kubectl get nodes -o wide` en `kubectl get pods -o wide -A`. Draait alles op één machine, dan stopt de verdediging daar.

---

## Weging

- **20%** — PE1 + PE2 (permanente evaluatie, al gescoord vóór dit project)
- **80%** — Deze eindopdracht (cloud deployment, analysedossier, mondelinge verdediging)

---

## Repository

- Je krijgt voor de eindopdracht een **nieuwe repository** via Classroom 50:
  **Accept-link 3SD (AJ 26-27):** https://classroom50.org/VivesMDima/2627-devops-ti/assignments/final/accept
- De template heeft dezelfde mappenstructuur als je projectrepository. Kopieer `frontend/`, `backend/`, `compose.yaml` en `k8s/` uit je projectrepository naar deze nieuwe repository.
- Vul `project.yaml` aan met `live_url` (de HTTPS-URL van je productie-omgeving).

```
project.yaml  README.md
frontend/  backend/  compose.yaml  k8s/      ← uit je projectrepository
helm/app/                                    ← jouw Helm chart
  values.yaml  values-test.yaml  values-prod.yaml
  templates/nodeinfo.yaml                    ← niet verwijderen
infra/terraform/                             ← optioneel (Terraform/OpenTofu)
monitoring/                                  ← Prometheus/Grafana config, dashboards
.github/workflows/deploy.yml                 ← jouw CI/CD pipeline
docs/analysedossier.md  docs/images/
scripts/submit.sh
```

---

## Stap voor stap

Volg onderstaande stappen in volgorde. Elke stap bouwt verder op de vorige.

### Stap 1 — Bevestig je applicatie

- Standaard gebruik je dezelfde drieservicetoepassing als in PE1/PE2.
- **Wil je een andere applicatie gebruiken?** Vraag dan eerst **goedkeuring van de docent**. Zonder goedkeuring wordt een afwijkende applicatie niet aanvaard.
- De applicatie zelf wordt niet inhoudelijk geëvalueerd — de deployment, infrastructuur en jouw begrip ervan wel.

### Stap 2 — Zet een Kubernetes-cluster op in de cloud

- Maak een cluster aan bij een cloudprovider naar keuze, manueel of via **Terraform/OpenTofu** (in `infra/terraform/`).
- Respecteer het **uitsluitingscriterium**: minstens 3 worker nodes op afzonderlijke VM's.
- Cloud credits/vouchers voor dit academiejaar: **LINK VOLGT** (het aanvraagportaal wordt later gecommuniceerd).

### Stap 3 — Deploy je applicatie naar het cluster

- Gebruik je Docker images uit PE1 en een officiële database-image.
- Bouw verder op je manifests uit PE2.
- Test dat de drie services in de cloud met elkaar communiceren.

### Stap 4 — Secrets management

- Gebruik **Kubernetes Secrets** (of een externe secret manager) voor alles wat gevoelig is: database-wachtwoorden, API keys, tokens.
- Niets gevoelig staat hardgecodeerd in een manifest, values-bestand of workflow, of wordt gecommit naar Git. In CI/CD gebruik je **GitHub Actions secrets**.

### Stap 5 — Bundel alles in een Helm chart

- Herwerk je manifests tot één herbruikbare **Helm chart** in `helm/app/`.
- Alles wat per omgeving verschilt (replicas, image tags, hostnames, resources) staat in `values`-bestanden.

### Stap 6 — Deploy naar meerdere omgevingen

- Deploy je chart naar minstens **twee omgevingen**: **test** en **productie** (aparte namespaces of clusters).
- De omgevingen verschillen enkel via `values-test.yaml` en `values-prod.yaml`.

### Stap 7 — Schaalbaarheid

- In productie draaien frontend en backend met **minstens 2 replicas**, met `topologySpreadConstraints` over de nodes.
- Voeg een **HorizontalPodAutoscaler** toe voor de backend (vereist `resources.requests` en de metrics-server).
- Toon in je analysedossier dat de HPA effectief opschaalt onder belasting (bv. met `hey` of `k6`).

### Stap 8 — Maak de applicatie publiek bereikbaar via HTTPS

Kies één van beide opties (zie [Les 8 – Ingress & Reverse Proxies](../../08-Ingress-and-Reverse-Proxies/)):

- **Optie A — Traefik ingress**: een Traefik ingress controller in je cluster, met automatisch SSL-certificaat (Let's Encrypt).
- **Optie B — Cloudflare tunnel**: een Cloudflare tunnel naar je cluster, met HTTPS via Cloudflare.

In beide gevallen: geen rechtstreeks opengezette NodePorts, en de applicatie is zonder browserwaarschuwing bereikbaar. Routeer ook het pad **`/nodeinfo`** naar de Service `nodeinfo` (poort 80), zodat `https://<jouw-domein>/nodeinfo` werkt.

> ⚠️ De VIVES-firewall blokkeert soms niet-standaard HTTP/HTTPS-poorten — gebruik 80/443.

### Stap 9 — Automatiseer met een CI/CD pipeline

- Bouw een GitHub Actions workflow (`.github/workflows/deploy.yml`) die bij een push naar `main` automatisch **build + push + deploy** uitvoert naar de juiste omgeving.
- Een falende build/deploy moet zichtbaar falen in GitHub Actions.
- **Zuinig met Actions-minuten** — de minuten worden gedeeld door alle studenten van de organisatie:
  - trigger enkel op `main` en gebruik `paths:`-filters (bv. enkel de backend bouwen als `backend/**` wijzigt);
  - gebruik build-caching (`cache-from`/`cache-to: type=gha`);
  - zet `timeout-minutes` op je jobs.

### Stap 10 — Monitoring

- Zet **Prometheus** op om metrics van je cluster/applicatie te verzamelen (bv. via `kube-prometheus-stack`).
- Bouw een **Grafana**-dashboard met minstens de kernmetrics: CPU, geheugen, pods per node, en (indien mogelijk) requests.

### Stap 11 — Schrijf je analysedossier

`docs/analysedossier.md` volgt de koppen uit de template (**Architectuur, Cluster, Deployment, Secrets, Helm en omgevingen, Schaalbaarheid, HTTPS, CI/CD, Monitoring, Keuzes**; niet hernoemen) en bevat minstens 8 screenshots in `docs/images/`. Een extra PDF-versie mag. Inhoudelijk:

- Beschrijving van je applicatie en een **architectuurschema** (cluster, nodes, namespaces, ingress/tunnel, monitoring).
- Een **stappenplan** van stap 2 t.e.m. 10: wat heb je gedaan, met welke **commando's**, en hoe kan iemand anders het reproduceren?
- **Screenshots** van elke belangrijke stap: `kubectl get nodes -o wide`, `kubectl get pods -o wide`, secrets (zonder gevoelige waarden!), Helm-releases per omgeving, HTTPS in de browser, HPA die opschaalt, een geslaagde CI/CD-run, het Grafana-dashboard.
- **Motivatie** van je keuzes: cloudprovider, node-sizing, Traefik vs. Cloudflare, … — waarom, en wat zijn de nadelen?

### Stap 12 — Dien in en houd je live deployment online

- Commit **regelmatig** doorheen het project — spreiding en aantal commits tellen mee.
- Dien in met `./scripts/submit.sh`, **ten laatste 7 dagen vóór het examen**. De laatste indiening vóór die deadline wordt geëvalueerd.
- Zet de links naar je live deployment (test + productie) en je analysedossier in `README.md` en `live_url` in `project.yaml`.
- Houd je live deployment **10 dagen online**: van één week vóór je mondelinge verdediging tot 3 dagen erna.
- Studenten in tweede zittijd werken verder op hun repository uit de eerste zittijd.

### Stap 13 — Mondelinge verdediging

- Zie [Mondelinge Verdediging](mondelinge-verdediging.md) voor het format, de voorbeeldvragen en de scoring.
- Duur: 10 à maximum 15 minuten, live demo's aangeraden.

---

## Evaluatie

### Automatische controles (bij elke indiening)

Bij elke indiening krijg je onder **Releases** een overzicht. Deze controles zijn een **vangnet**: een FAIL wijst op een probleem dat ook in de beoordeling zal meetellen. Een volledige PASS garandeert geen maximumscore — de docent beoordeelt het geheel.

| Controle | Wat |
|---|---|
| F-R0: project.yaml ingevuld | `naam`, `studentennummer`, `github`, `dockerhub` en `live_url` ingevuld |
| F-R1: Helm chart geldig | `helm lint` en `helm template` met `values-test.yaml` én `values-prod.yaml`, gevalideerd met `kubeconform`; naast `nodeinfo` minstens 3 workloads |
| F-R2: Schaalbaarheid geconfigureerd | productie: elke Deployment ≥ 2 replicas (of via HPA) en `topologySpreadConstraints`, minstens één HPA |
| F-R3: Resources en probes | `requests`/`limits` en `readinessProbe` op elke container |
| F-R4: Geen gecommitte secrets | `gitleaks` over de volledige Git-geschiedenis, geen `*.tfstate` in de repository |
| F-R5: CI/CD aanwezig | workflow met trigger op `main`, `paths`-filter, `timeout-minutes` op elke job, een image-build en `helm upgrade --install` |
| F-R6: Live via HTTPS | `live_url` antwoordt met HTTP 200 over HTTPS met geldig certificaat |
| F-R7: Multi-node | `live_url/nodeinfo` toont minstens **3 verschillende nodes** |
| F-R8: Analysedossier volledig | alle koppen uit de template en minstens 8 screenshots die in de repository staan |

### Puntenverdeling (100% van deze opdracht)

| Onderdeel | % | Criteria |
|---|---|---|
| Cloudinfrastructuur | 12% | • Voldoet aan het uitsluitingscriterium (≥ 3 worker nodes op afzonderlijke VM's)<br>• Bij Terraform/OpenTofu: reproduceerbaar vanaf nul (`apply`/`destroy`)<br>• Keuzes (provider, node-sizing) beargumenteerd |
| Live deployment | 10% | • Bereikbaar en functioneel op het moment van de verdediging<br>• Alle 3 services communiceren correct in de cloud |
| Schaalbaarheid | 8% | • Replicas verspreid over nodes<br>• HPA aanwezig en aantoonbaar werkend onder belasting |
| Secrets management | 8% | • Geen enkele gevoelige waarde hardgecodeerd of gecommit<br>• Secrets correct gebruikt in deployments en CI/CD |
| Helm chart & omgevingen | 12% | • Eén herbruikbare chart, verschillen enkel in values-bestanden<br>• Test én productie beide werkend |
| HTTPS & externe toegang | 8% | • HTTPS zonder browserwaarschuwing, geen opengezette NodePorts |
| CI/CD pipeline | 12% | • Push naar `main` → build + deploy zonder manuele tussenkomst<br>• Faalt zichtbaar bij een fout<br>• Juiste omgeving getarget, zuinig met minuten |
| Monitoring | 10% | • Prometheus verzamelt metrics<br>• Leesbaar Grafana-dashboard met kernmetrics |
| Documentatie (analysedossier) | 15% | • Stappenplan waarmee een derde de deployment kan reproduceren<br>• Commando's met uitleg en screenshots van elke belangrijke stap<br>• Ontwerpkeuzes **gemotiveerd**, niet enkel beschreven |
| Versiebeheer | 5% | • Regelmatige commits over de projectperiode<br>• Betekenisvolle commit-boodschappen |

> [!WARNING]
> **Totaal: 100%** — dit totaal wordt vervolgens **vermenigvuldigd** met de factor uit de mondelinge verdediging (30% – 100%, zie [Mondelinge Verdediging](mondelinge-verdediging.md)). Een perfecte score die je niet kan uitleggen, levert dus **geen 100% eindscore** op!

---

## Mogelijke strafpunten

- **-1 punt per dag** laattijdig indienen (deadline: 7 dagen vóór het examen).
- Live deployment niet bereikbaar tijdens de afgesproken periode zonder geldige reden.
