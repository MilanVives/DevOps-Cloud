# Final Assessment — Cloud Infrastructure (80%)

> Minikube wordt al apart geëvalueerd via [PE1](1-PE_Minikube-CloudInfra.md) en telt hier niet opnieuw mee. Docker en Docker Compose worden in een ander vak geëvalueerd.

Voor het vak Cloud Infrastructure (V3R449) lever je een eigen project op en verdedig je dit tijdens de examenperiode mondeling (zie [Mondelinge Verdediging](mondelinge-verdediging.md)).

Je bouwt de **volledige cloudinfrastructuur** voor een applicatie: je maakt ze aan met **Terraform/OpenTofu**, beheert ze met **Ansible**, deployt de applicatie met **Helm** naar een test- en productieomgeving, maakt ze veilig publiek bereikbaar en monitort ze van buitenaf.

---

## ⛔ Uitsluitingscriterium — lees dit eerst

> [!CAUTION]
> Voldoet je deployment **niet** aan onderstaande drie voorwaarden, dan kan je voor de eindopdracht **niet slagen**, ongeacht de kwaliteit van de rest van je project.

**1. Een echte multi-node cluster in de cloud**

- Minstens **3 worker nodes**, elk op een **eigen VM/instance** bij een cloudprovider, plus een control plane — aangemaakt via **Terraform/OpenTofu**.
- ✅ Toegelaten: managed Kubernetes (Linode LKE, Azure AKS, AWS EKS, Google GKE, DigitalOcean DOKS, …) of k3s/kubeadm verspreid over **minstens 3 afzonderlijke VM's**.
- ❌ **Niet** toegelaten: Minikube, kind, k3d, Docker Desktop, of **eender welke cluster op één enkele VM** — ook niet als die "3 nodes" toont (bv. k3d/kind/minikube met meerdere nodes in containers op dezelfde machine).

**2. Publiek bereikbaar**

- De applicatie is vanaf het internet bereikbaar via **HTTPS op een domeinnaam**, zonder browserwaarschuwing.

**3. Schaalbaar**

- De applicatieservices (niet de database) draaien met **minstens 2 replicas**, verspreid over verschillende nodes (`topologySpreadConstraints`).
- Minstens één service heeft een **HorizontalPodAutoscaler** (zie [Les 13 – Scalability](../../13-Scalability/)).

**Hoe dit gecontroleerd wordt**

- Je Helm chart bevat een kleine **`nodeinfo`**-service (staat al klaar in de template — **niet verwijderen**). Die toont op `https://<jouw-domein>/nodeinfo` de naam van de node waarop ze draait. De automatische controle roept die URL herhaaldelijk op en verwacht **minstens 3 verschillende nodenamen**.
- Bij het begin van de mondelinge verdediging toon je live `kubectl get nodes -o wide` en `kubectl get pods -o wide -A`. Draait alles op één machine, dan stopt de verdediging daar.

---

## Weging

- **20%** — PE1 (permanente evaluatie, al gescoord vóór dit project)
- **80%** — Deze eindopdracht (cloudinfrastructuur, analysedossier, mondelinge verdediging)

---

## Repository

- Je krijgt voor de eindopdracht een **nieuwe repository** via Classroom 50:
  **Accept-link 3CYB (AJ 26-27):** LINK VOLGT
- De template heeft dezelfde mappenstructuur als je projectrepository. Kopieer je `app/` en `k8s/` uit je projectrepository.
- Vul `project.yaml` aan met `live_url` (de HTTPS-URL van je productie-omgeving).

```
project.yaml  README.md
app/  k8s/                                   ← uit je projectrepository
infra/terraform/                             ← cluster + netwerk + extra cloudresources
ansible/
  inventory/                                 ← je cloud-VM's/nodes
  playbooks/
helm/app/                                    ← jouw Helm chart
  values.yaml  values-test.yaml  values-prod.yaml
  templates/nodeinfo.yaml                    ← niet verwijderen
monitoring/                                  ← monitoringconfig, dashboards
docs/analysedossier.md  docs/images/
scripts/submit.sh
```

---

## Applicatie

- De applicatie mag je **vrij kiezen** (je mag ze ook laten genereren), maar ze bevat minstens **drie services** die met elkaar communiceren, bv. frontend, backend en database. Je mag dezelfde applicatie gebruiken als in PE1.
- De applicatie zelf wordt **niet** geëvalueerd — de infrastructuur, de deployment en jouw begrip ervan wel.

---

## Stap voor stap

### Stap 1 — Cloudinfrastructuur met Terraform/OpenTofu

- Maak je cluster (≥ 3 worker nodes + control plane) aan met **Terraform/OpenTofu** in `infra/terraform/`. Zie ook [Les 5 – Infrastructure as Code](../../05-IaC/) en [Linode: Deploy a cluster using Terraform](https://www.linode.com/docs/products/compute/kubernetes/guides/deploy-cluster-using-terraform/).
- Extra cloudresources die je nodig hebt (netwerk, firewall, DNS, monitoring-VM, …) maak je **ook** via Terraform/OpenTofu.
- `tofu apply` vanaf nul en `tofu destroy` moeten werken. Gebruik variabelen en outputs; geen hardgecodeerde tokens.
- **Commit nooit** `*.tfstate`, `*.tfvars` met secrets of `.terraform/` — zet ze in `.gitignore`. Commit wel `terraform.tfvars.example`.
- Cloud credits/vouchers voor dit academiejaar: **LINK VOLGT**.

### Stap 2 — Beheer met Ansible

- Je cloud-VM's/nodes zitten in een **Ansible inventory** in `ansible/inventory/` (statisch of dynamisch, bv. gegenereerd uit Terraform-outputs).
- Zet de collecties die je playbooks gebruiken (bv. `kubernetes.core`) in `ansible/requirements.yml`; je playbooks staan in `ansible/playbooks/`.
- Installaties en configuraties gebeuren **zoveel mogelijk via Ansible-playbooks** in plaats van manueel: bv. pakketten, hardening, de monitoring-agent, de Helm-deploys (`kubernetes.core.helm`).
- Playbooks zijn **idempotent**: twee keer na elkaar uitvoeren geeft geen wijzigingen (`changed=0`) de tweede keer.

### Stap 3 — Helm chart en omgevingen

- Bundel je manifests uit PE1 tot één herbruikbare **Helm chart** in `helm/app/`.
- Deploy naar minstens **twee omgevingen**: **test** en **productie** (aparte namespaces of clusters). Ze verschillen enkel via `values-test.yaml` en `values-prod.yaml`.
- Secrets staan niet in de values-bestanden of in Git: gebruik Kubernetes Secrets die je via Ansible (bv. met Ansible Vault) of een externe secret manager aanmaakt.

### Stap 4 — Schaalbaarheid

- In productie draaien de applicatieservices met **minstens 2 replicas**, met `topologySpreadConstraints` over de nodes.
- Voeg minstens één **HorizontalPodAutoscaler** toe en toon in je analysedossier dat die opschaalt onder belasting (bv. met `hey` of `k6`).

### Stap 5 — Publiek bereikbaar via HTTPS

- Maak de applicatie bereikbaar via **HTTPS op een domeinnaam**, via een ingress controller (bv. **Traefik** met Let's Encrypt) of een **Cloudflare tunnel**. Zie [Les 8 – Ingress & Reverse Proxies](../../08-Ingress-and-Reverse-Proxies/).
- Geen rechtstreeks opengezette NodePorts. Routeer ook het pad **`/nodeinfo`** naar de Service `nodeinfo` (poort 80), zodat `https://<jouw-domein>/nodeinfo` werkt.

> ⚠️ De VIVES-firewall blokkeert soms niet-standaard HTTP/HTTPS-poorten — gebruik 80/443.

### Stap 6 — Extra features

Onderzoek de volgende features en implementeer er **minstens twee** die een meerwaarde bieden voor je project. Motiveer in je analysedossier waarom je ze wel of niet gebruikt.

- **Traefik** (geavanceerd: middlewares, rate limiting, basic auth op het dashboard, …)
- **HashiCorp Vault** (secrets uit Vault in plaats van Kubernetes Secrets)
- **WireGuard** (beheertoegang tot je nodes/cluster enkel via een VPN)
- **Cloudflare** (tunnel, DNS, WAF, Zero Trust Access)

### Stap 7 — Externe monitoring

- Je cluster wordt **van buitenaf** gemonitord: de monitoring draait **niet** (enkel) in de cluster die ze bewaakt, zodat je ook ziet wanneer de cluster zelf down is. Bv. een aparte monitoring-VM (via Terraform + Ansible) of een externe dienst.
- Kies en onderzoek één van: **Prometheus + Grafana**, **Zabbix** of **Flowmon**.
- Minstens: beschikbaarheid van je nodes, CPU/geheugen per node, en een alert of melding wanneer een node of je applicatie onbereikbaar wordt.

### Stap 8 — Schrijf je analysedossier

`docs/analysedossier.md` volgt de koppen uit de template (**Architectuur, Cloudinfrastructuur, Ansible, Deployment, Helm en omgevingen, Schaalbaarheid, HTTPS, Extra features, Monitoring, Conclusies**; niet hernoemen) en bevat minstens 8 screenshots in `docs/images/`. Een extra PDF-versie mag. Inhoudelijk:

- Beschrijving van je applicatie en een **architectuurschema** (cloudresources, nodes, netwerk, namespaces, ingress/tunnel, VPN, monitoring).
- Een **stappenplan**: hoe is alles gedeployed, met welke **commando's**, en hoe kan iemand anders het reproduceren en testen?
- **Screenshots** van elke belangrijke stap: `tofu apply`-output, `kubectl get nodes -o wide`, `kubectl get pods -o wide`, een Ansible-run (tweede keer `changed=0`), Helm-releases per omgeving, HTTPS in de browser, HPA die opschaalt, je extra features, het monitoringdashboard en een alert.
- **Onderzoek en conclusies**: welke extra features en monitoringtool heb je gekozen, waarom (en waarom andere niet), hoe heb je ze geïmplementeerd en hoe gebruik je ze?

### Stap 9 — Dien in en houd je live deployment online

- Commit **regelmatig** doorheen het project — spreiding en aantal commits tellen mee.
- Dien in met `./scripts/submit.sh`, **ten laatste 7 dagen vóór het examen**. De laatste indiening vóór die deadline wordt geëvalueerd.
- Zet de links naar je live deployment (test + productie), je monitoringdashboard en je analysedossier in `README.md`, en `live_url` in `project.yaml`.
- Houd je live deployment **10 dagen online**: van één week vóór je mondelinge verdediging tot 3 dagen erna.
- Studenten in tweede zittijd werken verder op hun repository uit de eerste zittijd.

### Stap 10 — Mondelinge verdediging

- Zie [Mondelinge Verdediging](mondelinge-verdediging.md) voor het format, de voorbeeldvragen en de scoring.
- Duur: 15 à 20 minuten, live demo's aangeraden.

---

## Evaluatie

### Automatische controles (bij elke indiening)

Bij elke indiening krijg je onder **Releases** een overzicht. Deze controles zijn een **vangnet**: een FAIL wijst op een probleem dat ook in de beoordeling zal meetellen. Een volledige PASS garandeert geen maximumscore — de docent beoordeelt het geheel.

| Controle | Wat |
|---|---|
| F-R0: project.yaml ingevuld | `naam`, `studentennummer`, `github` en `live_url` ingevuld |
| F-R1: Terraform geldig | `tofu fmt -check` en `tofu validate` in `infra/terraform/` |
| F-R2: Ansible geldig | inventory met hosts, collecties uit `requirements.yml`, `ansible-playbook --syntax-check` en `ansible-lint` op de playbooks |
| F-R3: Helm chart geldig | `helm lint` en `helm template` met `values-test.yaml` én `values-prod.yaml`, gevalideerd met `kubeconform`; naast `nodeinfo` minstens 3 workloads |
| F-R4: Schaalbaarheid geconfigureerd | productie: elke Deployment behalve de database ≥ 2 replicas (of via HPA) en `topologySpreadConstraints`, minstens één HPA |
| F-R5: Geen gecommitte secrets | `gitleaks` over de volledige Git-geschiedenis, geen `*.tfstate` in de repository |
| F-R6: Live via HTTPS | `live_url` antwoordt met HTTP 200 over HTTPS met geldig certificaat |
| F-R7: Multi-node | `live_url/nodeinfo` toont minstens **3 verschillende nodes** |
| F-R8: Analysedossier volledig | alle koppen uit de template en minstens 8 screenshots die in de repository staan |

### Puntenverdeling (100% van deze opdracht)

| Onderdeel | % | Criteria |
|---|---|---|
| Cloudinfrastructuur (Terraform/OpenTofu) | 15% | • Voldoet aan het uitsluitingscriterium<br>• Reproduceerbaar vanaf nul (`apply`/`destroy`), variabelen en outputs gebruikt<br>• Extra cloudresources ook via code |
| Management (Ansible) | 12% | • Inventory van de cloudinfrastructuur<br>• Installaties/configuratie via playbooks, idempotent<br>• Zo weinig mogelijk manuele handelingen |
| Live deployment & schaalbaarheid | 12% | • Bereikbaar en functioneel op het moment van de verdediging<br>• Replicas verspreid over nodes, HPA aantoonbaar werkend |
| Helm chart & omgevingen | 12% | • Eén herbruikbare chart, verschillen enkel in values-bestanden<br>• Test én productie beide werkend |
| Secrets management | 6% | • Geen gevoelige waarden in Git (ook geen tfstate/tfvars)<br>• Secrets correct aangeleverd aan de workloads |
| HTTPS & externe toegang | 8% | • HTTPS zonder browserwaarschuwing, geen opengezette NodePorts |
| Extra features | 10% | • Minstens twee van Traefik / Vault / WireGuard / Cloudflare, werkend en met meerwaarde<br>• Keuze onderbouwd |
| Externe monitoring | 10% | • Monitoring van buiten de cluster<br>• Node-beschikbaarheid, CPU/geheugen, werkende alert |
| Documentatie (analysedossier) | 15% | • Stappenplan waarmee een derde alles kan reproduceren en testen<br>• Commando's met uitleg en screenshots van elke belangrijke stap<br>• Onderzoek en ontwerpkeuzes **gemotiveerd**, met conclusies |

> [!WARNING]
> **Totaal: 100%** — dit totaal wordt vervolgens **vermenigvuldigd** met de factor uit de mondelinge verdediging (30% – 100%, zie [Mondelinge Verdediging](mondelinge-verdediging.md)). Een perfecte score die je niet kan uitleggen, levert dus **geen 100% eindscore** op!

---

## Mogelijke strafpunten

- **-1 punt per dag** laattijdig indienen (deadline: 7 dagen vóór het examen).
- Live deployment niet bereikbaar tijdens de afgesproken periode zonder geldige reden.
- Onregelmatige commitgeschiedenis (bv. alles in de laatste dagen).
