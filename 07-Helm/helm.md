# 7 - Helm: je Kubernetes-app als één pakket

<!-- {% raw %} -->

## Waar gaat deze les over?

Je PetShelter-app bestaat in Kubernetes uit een hele map YAML-bestanden: Deployments, Services, een ConfigMap, een
Secret. Dat werkt, maar:

- je moet alles in de juiste volgorde `kubectl apply`'en, en bij het verwijderen alles weer opruimen;
- wil je een **test**- en een **productie**-omgeving (1 replica tegenover 3, een andere hostnaam), dan kopieer je alle
  bestanden en pas je ze met de hand aan. Na een paar weken zijn de twee kopieën niet meer gelijk;
- gaat een update mis, dan is er geen knop "terug naar de vorige versie".

**Helm** lost dat op. Het is de **package manager voor Kubernetes**, zoals `npm` voor Node.js of `apt` voor Ubuntu:

- je bundelt al je YAML in één **chart**, met **variabelen** in plaats van vaste waarden;
- je installeert, upgradet en verwijdert de hele app met **één commando**;
- Helm onthoudt elke versie, zodat je met `helm rollback` terug kan;
- per omgeving heb je enkel een klein bestand met de **verschillen**.

**Na deze les kan je:**
- een bestaande chart installeren, configureren, upgraden en terugdraaien;
- je eigen chart schrijven met templates en values;
- dezelfde chart naar een test- en een productie-omgeving deployen.

**Ook in dit hoofdstuk:**
- [PetShelter naar Helm, stap voor stap](helm-petshelter.md): de manifests uit les 6 omzetten naar een chart (de basis
  voor de Final);
- [Helm: alle commando's](helm-commands.md): naslag met alle commando's en opties;
- [Prometheus en Grafana met Helm](helm-prometheus-grafana.md): demo van Helm als package manager, een volledige
  monitoringstack met één commando;
- [Helm Advanced](helm-advanced.md): helpers, hooks, tests, dependencies, charts publiceren, Helm in CI/CD.

---

## 1. Vier begrippen

| Begrip | Wat | Vergelijking |
|---|---|---|
| **Chart** | een map met YAML-templates en standaardwaarden: het "pakket" | een npm-package |
| **Values** | de instellingen waarmee je een chart invult (replicas, image, hostnaam, …) | de opties van een installer |
| **Release** | een geïnstalleerde chart in je cluster, met een eigen naam | een geïnstalleerd programma |
| **Repository** | een plaats waar charts gedeeld worden; zoeken via [Artifact Hub](https://artifacthub.io) | de npm registry |

Je kan dezelfde chart meerdere keren installeren, elke keer met een andere releasenaam of in een andere namespace.
Elke `install`, `upgrade` of `rollback` maakt een nieuwe **revision** van die release.

```
chart (templates)  +  values  ──helm install──►  release (revision 1)  ──helm upgrade──►  revision 2
                                                                        ◄─helm rollback─┘
```

---

## 2. Helm installeren

```bash
brew install helm            # macOS
winget install Helm.Helm     # Windows (of: choco install kubernetes-helm)
# Linux: zie https://helm.sh/docs/intro/install/

helm version
```

Helm gebruikt dezelfde cluster als `kubectl` (je `~/.kube/config`). Draait `kubectl get nodes`, dan werkt Helm ook.
De commando's in deze les werken in Helm 3 en Helm 4.

---

## 3. Een bestaande chart gebruiken

We installeren **podinfo**, een kleine demo-webapp.

```bash
# 1. De repository toevoegen en de lijst charts ophalen (zoals apt update)
helm repo add podinfo https://stefanprodan.github.io/podinfo
helm repo update

# 2. Welke instellingen heeft de chart?
helm show values podinfo/podinfo | less

# 3. Installeren: releasenaam "mijn-podinfo", met twee eigen instellingen
helm install mijn-podinfo podinfo/podinfo --set replicaCount=2 --set ui.message="Hallo VIVES"
```

Bekijken en openen:

```bash
helm list                                   # je releases
helm status mijn-podinfo
kubectl get pods                            # 2 pods mijn-podinfo-...
kubectl port-forward svc/mijn-podinfo 9898:9898
# open http://localhost:9898
```

Een andere instelling, en terug:

```bash
helm upgrade mijn-podinfo podinfo/podinfo --reuse-values --set replicaCount=3
helm history mijn-podinfo                   # revision 1 en 2
helm rollback mijn-podinfo 1                # terug naar revision 1 (2 replicas)
helm get values mijn-podinfo                # welke values zijn er nu ingesteld?

helm uninstall mijn-podinfo                 # alles van deze release weg
```

> `--reuse-values` behoudt je vorige `--set`-waarden. Zonder die optie begint `helm upgrade` opnieuw van de
> standaardwaarden van de chart, en zou het bericht "Hallo VIVES" verdwijnen. Duidelijker is om je values in een
> **bestand** te zetten (sectie 6).

Zo installeer je ook grote, bekende software met één commando: Traefik ([les 8](../08-Ingress-and-Reverse-Proxies/ingress.md)),
Prometheus en Grafana (monitoring), cert-manager, … Kijk op [Artifact Hub](https://artifacthub.io) wie de chart
maakt: kies bij voorkeur de chart van het project zelf (een "official" of "verified publisher").

Een volledig voorbeeld, van zoeken tot verwijderen: [Prometheus en Grafana met Helm](helm-prometheus-grafana.md).

---

## 4. Je eigen chart

Een chart is gewoon een map. De kleinste chart die werkt, staat in [hello-chart/](hello-chart/) (voer de commando's
hieronder uit in de map `07-Helm` van de cursusrepository):

```
hello-chart/
├── Chart.yaml          naam en versie van de chart
├── values.yaml         de standaardwaarden
└── templates/          je Kubernetes-YAML, met {{ }} op de plaatsen die variabel zijn
    ├── deployment.yaml
    └── service.yaml
```

`Chart.yaml`:

```yaml
apiVersion: v2          # v2 = Helm 3 of nieuwer
name: hello
description: Mijn eerste Helm chart
type: application
version: 0.1.0          # versie van de chart zelf: verhoog bij elke wijziging aan de chart
appVersion: "1.10"      # versie van de app die erin zit (informatief)
```

`values.yaml`:

```yaml
replicas: 1
image: traefik/whoami:v1.10

# Environment variables voor de container. whoami toont WHOAMI_NAME in zijn antwoord.
env:
  WHOAMI_NAME: hallo
```

`templates/deployment.yaml`: een gewone Deployment, met `{{ }}` waar een waarde vandaan moet komen:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}
spec:
  replicas: {{ .Values.replicas }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app: {{ .Release.Name }}
    spec:
      containers:
        - name: web
          image: {{ .Values.image }}
          ports:
            - containerPort: 80
          {{- if .Values.env }}
          env:
            {{- range $name, $value := .Values.env }}
            - name: {{ $name }}
              value: {{ $value | quote }}
            {{- end }}
          {{- end }}
```

`templates/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ .Release.Name }}
spec:
  selector:
    app: {{ .Release.Name }}
  ports:
    - port: 80
```

**Eerst kijken, dan installeren.** `helm template` toont de YAML die Helm zou maken, zonder iets te installeren:

```bash
helm lint ./hello-chart                     # syntaxfouten?
helm template demo ./hello-chart            # de ingevulde YAML
```

```bash
helm install hallo ./hello-chart
helm install dag ./hello-chart --set replicas=2 --set env.WHOAMI_NAME=dag
kubectl get deploy                          # hallo (1/1) en dag (2/2): twee releases van dezelfde chart
```

Omdat de namen uit `{{ .Release.Name }}` komen, botsen de twee releases niet.

### Een chart starten met `helm create`

Je hoeft de map niet met de hand te maken:

```bash
helm create mijnchart
```

Dat maakt `Chart.yaml`, `values.yaml`, `.helmignore` en een map `templates/` met een volledige voorbeeldchart voor een
nginx-webserver (Deployment, Service, Ingress, HPA, ServiceAccount, helpers, een test). Goed als naslag, maar voor je
eigen app maak je hem meestal eerst leeg:

```bash
rm -rf mijnchart/templates/*
: > mijnchart/values.yaml
```

Daarna kopieer je je bestaande YAML-bestanden in `templates/` (dat werkt meteen) en vervang je stap voor stap vaste
waarden door `{{ .Values... }}`. Zo zet je in [PetShelter naar Helm](helm-petshelter.md) de app uit les 6 om.

> `helm init` uit oude tutorials was Helm 2 en bestaat niet meer. Een chart maak je met `helm create`.

---

## 5. Templates: wat je het meest gebruikt

Helm gebruikt de template-taal van Go. Alles tussen `{{ }}` wordt vervangen; de rest blijft letterlijk staan.

| Template | Resultaat |
|---|---|
| `{{ .Values.replicas }}` | waarde uit values.yaml (`replicas: 3` → `3`) |
| `{{ .Values.image.tag }}` | geneste waarde (`image:` → `tag:`) |
| `{{ .Release.Name }}` | de naam van de release (`helm install hallo …` → `hallo`) |
| `{{ .Release.Namespace }}` | de namespace waarin je installeert |
| `{{ .Chart.Version }}` | `version` uit Chart.yaml |
| `{{ .Values.host \| quote }}` | met aanhalingstekens: `"mijnsite.be"` |
| `{{ .Values.port \| default 3000 }}` | `3000` als `port` niet ingesteld is |

**Voorwaarden en lussen:**

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
...
{{- end }}
```

```yaml
env:
  {{- range $name, $value := .Values.env }}
  - name: {{ $name }}
    value: {{ $value | quote }}
  {{- end }}
```

**Een heel blok overnemen** (bv. `resources:` uit de values):

```yaml
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

`toYaml` zet het blok om naar YAML, `nindent 12` zet het op een nieuwe regel met 12 spaties inspringing.

**Het streepje `{{-`** haalt de witruimte (en de nieuwe regel) vóór de tag weg. Zonder streepje krijg je lege regels
in je YAML. Dat is niet fout, maar wel lelijk. Bij een rare inspringing: bekijk de uitvoer met `helm template`.

> **Typische fouten**
> - `nil pointer evaluating interface {}.tag`: je gebruikt `.Values.image.tag`, maar `image:` bestaat niet in je values.
> - Een getal waar een string moet (`value: 3000` in `env`): gebruik `| quote`.
> - Verkeerde inspringing na een `if` of `range`: tel de spaties in de uitvoer van `helm template`.

---

## 6. Eén chart, meerdere omgevingen

Dit is de grootste winst van Helm, en wat je in de Final doet. `values.yaml` bevat de standaardwaarden. Per omgeving
maak je een klein bestand met **enkel wat verschilt**:

```yaml
# values-test.yaml
ingress:
  enabled: true
  host: petshelter-test.localhost
```

```yaml
# values-prod.yaml
replicas:
  frontend: 3
  backend: 3

database:
  storage: 5Gi

ingress:
  enabled: true
  host: petshelter.jouwdomein.be
  tls:
    enabled: true
    clusterIssuer: letsencrypt
```

(Dit zijn de bestanden uit [petshelter-chart/](petshelter-chart/).)

Elke omgeving krijgt een eigen **namespace**:

```bash
helm upgrade --install petshelter ./petshelter-chart -n test --create-namespace -f petshelter-chart/values-test.yaml
helm upgrade --install petshelter ./petshelter-chart -n prod --create-namespace -f petshelter-chart/values-prod.yaml

helm list -A                                # beide releases, elk in hun namespace
```

**Wie wint?** Van laag naar hoog: `values.yaml` van de chart → `-f bestand1.yaml` → `-f bestand2.yaml` (het laatste
bestand wint) → `--set`.

**`helm upgrade --install`** installeert als de release nog niet bestaat, en upgradet anders. Gebruik dit in scripts
en CI/CD: hetzelfde commando werkt de eerste keer en elke keer daarna.

> **Geen wachtwoorden in values-bestanden.** Die staan in git. Maak de Secret apart aan (`kubectl create secret`, of
> vanuit je CI/CD) en verwijs ernaar vanuit de chart. Zie [PetShelter naar Helm](helm-petshelter.md#stap-4-de-secret-buiten-de-chart).

---

## 7. Commando's

De belangrijkste hieronder; **alle** commando's en opties staan in [Helm: alle commando's](helm-commands.md).

| Commando | Wat |
|---|---|
| `helm repo add <naam> <url>` / `helm repo update` | repository toevoegen / bijwerken |
| `helm search repo <woord>` | charts zoeken in je repositories (`helm search hub` zoekt op Artifact Hub) |
| `helm show values <chart>` | alle instelbare waarden van een chart |
| `helm lint <map>` | chart controleren op fouten |
| `helm template <release> <map> [-f values.yaml]` | de ingevulde YAML tonen, zonder installeren |
| `helm install <release> <chart> [-n ns] [-f …] [--set …]` | installeren |
| `helm upgrade --install <release> <chart> …` | installeren of upgraden |
| `helm list [-A]` | releases (in alle namespaces) |
| `helm status <release>` | status en NOTES van een release |
| `helm get values <release>` / `helm get manifest <release>` | ingestelde values / de geïnstalleerde YAML |
| `helm history <release>` | alle revisions |
| `helm rollback <release> <revision>` | terug naar een vorige revision |
| `helm uninstall <release>` | release en al zijn objecten verwijderen |

Voeg `-n <namespace>` toe als je release niet in `default` staat.

---

## 8. Oefeningen

1. **Bestaande chart.** Installeer podinfo met 2 replicas en een eigen bericht. Upgrade naar 3 replicas, bekijk
   `helm history` en rol terug naar revision 1. Hoeveel pods draaien er nu?
2. **Values-bestand.** Zet je instellingen voor podinfo in `mijn-values.yaml` en installeer met `-f mijn-values.yaml`.
   Wat gebeurt er als je dezelfde waarde ook met `--set` meegeeft?
3. **Eigen chart.** Bekijk de uitvoer van `helm template demo ./hello-chart`. Voeg een value `port` toe (standaard
   `80`) en gebruik die in de Service. Installeer twee releases met een verschillend `WHOAMI_NAME` en test met
   `kubectl port-forward`.
4. **Voorwaarde.** Voeg aan de hello-chart een `templates/ingress.yaml` toe die enkel aangemaakt wordt als
   `ingress.enabled` op `true` staat. Controleer met `helm template` met en zonder `--set ingress.enabled=true`.
5. **PetShelter.** Volg [PetShelter naar Helm](helm-petshelter.md) en deploy een test- en een productieomgeving.
6. **Package manager.** Zoek de officiële chart van Prometheus op [Artifact Hub](https://artifacthub.io) en installeer
   Prometheus en Grafana in je Minikube-cluster. Volg [Prometheus en Grafana met Helm](helm-prometheus-grafana.md).

**Volgende les:** je app van buitenaf bereikbaar maken met [Ingress](../08-Ingress-and-Reverse-Proxies/ingress.md).

<!-- {% endraw %} -->
