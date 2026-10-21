# 7 - Helm Advanced

<!-- {% raw %} -->

Verdieping bij de [Helm-les](helm.md) en [PetShelter naar Helm](helm-petshelter.md). Alle voorbeelden bouwen verder
op [petshelter-chart/](petshelter-chart/).

**Inhoud**

1. [De volledige chartstructuur](#1-de-volledige-chartstructuur)
2. [Herbruikbare stukken: `_helpers.tpl`](#2-herbruikbare-stukken-_helperstpl)
3. [Meer templatefuncties](#3-meer-templatefuncties)
4. [Values controleren: `required` en `values.schema.json`](#4-values-controleren)
5. [Tests en hooks](#5-tests-en-hooks)
6. [Dependencies: charts in je chart](#6-dependencies)
7. [Charts verpakken en publiceren](#7-charts-verpakken-en-publiceren)
8. [Veilig upgraden](#8-veilig-upgraden)
9. [Helm in CI/CD](#9-helm-in-cicd)
10. [Secrets en Helm](#10-secrets-en-helm)
11. [Debuggen](#11-debuggen)
12. [Achtergrond: Helm 2, 3 en 4](#12-achtergrond-helm-2-3-en-4)

---

## 1. De volledige chartstructuur

```
mijnchart/
├── Chart.yaml            naam, versie, dependencies
├── values.yaml           standaardwaarden
├── values.schema.json    OPTIONEEL: controleert de values (sectie 4)
├── .helmignore           OPTIONEEL: bestanden die niet in het pakket mogen (zoals .gitignore)
├── README.md             OPTIONEEL: uitleg voor gebruikers van je chart
├── charts/               dependencies (sectie 6)
├── crds/                 OPTIONEEL: Custom Resource Definitions, worden vóór de rest geïnstalleerd
└── templates/
    ├── *.yaml            je Kubernetes-objecten
    ├── _helpers.tpl      herbruikbare stukken (bestanden met _ worden geen object)
    ├── NOTES.txt         tekst na install/upgrade
    └── tests/            tests voor helm test (sectie 5)
```

`helm create mijnchart` maakt al deze onderdelen aan, met voorbeelden. Goed om eens te bekijken.

---

## 2. Herbruikbare stukken: `_helpers.tpl`

Wil je op elk object dezelfde labels, dan schrijf je ze één keer met `define` en gebruik je ze met `include`:

```yaml
# templates/_helpers.tpl
{{/* Labels die elk object van deze chart krijgt. */}}
{{- define "petshelter.labels" -}}
app.kubernetes.io/part-of: petshelter
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}
```

```yaml
# templates/backend.yaml
metadata:
  name: backend
  labels:
    {{- include "petshelter.labels" . | nindent 4 }}
```

Resultaat:

```yaml
metadata:
  name: backend
  labels:
    app.kubernetes.io/part-of: petshelter
    app.kubernetes.io/managed-by: Helm
    helm.sh/chart: petshelter-0.1.0
```

- De **punt** in `include "..." .` geeft alle gegevens (`.Values`, `.Release`, …) door aan het stuk.
- Geef namen een prefix met de naam van je chart (`petshelter.`), zodat ze niet botsen met die van dependencies.

### Namen met de releasenaam

`helm create` gebruikt een helper `fullname` die van elke objectnaam `<release>-<chart>` maakt. Dan kan je dezelfde
chart **meerdere keren in één namespace** installeren:

```yaml
{{- define "petshelter.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
```

```yaml
metadata:
  name: {{ include "petshelter.fullname" . }}-backend
```

Nadeel: ook de Service-namen veranderen (`mijnrelease-petshelter-backend`), dus ook `MONGO_HOST`, `BACKEND_URL` en de
Ingress moeten die helper gebruiken. Daarom kozen we in de les voor vaste namen en één namespace per omgeving.
`trunc 63` is nodig omdat Kubernetes-namen maximaal 63 tekens lang mogen zijn.

---

## 3. Meer templatefuncties

| Functie | Voorbeeld | Resultaat |
|---|---|---|
| `quote` | `{{ .Values.host \| quote }}` | `"mijnsite.be"` |
| `default` | `{{ .Values.port \| default 3000 }}` | `3000` als `port` leeg is |
| `upper` / `lower` | `{{ .Values.env \| upper }}` | `PROD` |
| `printf` | `{{ printf "%s:%s" .Values.image .Values.tag }}` | `app:1.2` |
| `b64enc` | `{{ .Values.x \| b64enc }}` | base64, voor `data:` in een Secret |
| `toYaml` + `nindent` | `{{- toYaml .Values.resources \| nindent 12 }}` | een heel YAML-blok, ingesprongen |
| `with` | `{{- with .Values.nodeSelector }} … {{ toYaml . }} {{- end }}` | blok enkel als de waarde bestaat; binnenin is `.` die waarde |
| `eq`, `ne`, `and`, `or`, `not` | `{{- if and .Values.ingress.enabled (eq .Values.env "prod") }}` | voorwaarden |
| `sha256sum` | zie hieronder | een hash van een tekst |

**Pods herstarten als een ConfigMap wijzigt.** Kubernetes herstart pods niet als enkel een ConfigMap verandert. Zet
een hash van de ConfigMap als annotation op de pods: verandert de inhoud, dan verandert de hash, en Kubernetes rolt
nieuwe pods uit.

```yaml
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
```

Alle functies: [Helm template function list](https://helm.sh/docs/chart_template_guide/function_list/).

---

## 4. Values controleren

### `required`

Stopt met een duidelijke fout als een waarde ontbreekt:

```yaml
          image: {{ required "images.backend is verplicht" .Values.images.backend }}
```

```
$ helm template x ./petshelter-chart --set images.backend=
Error: execution error at (petshelter/templates/backend.yaml:19:20): images.backend is verplicht
```

### `values.schema.json`

Een JSON Schema naast `values.yaml` laat Helm de **types en grenzen** van je values controleren bij `lint`, `template`,
`install` en `upgrade`:

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["images", "replicas"],
  "properties": {
    "replicas": {
      "type": "object",
      "properties": {
        "frontend": { "type": "integer", "minimum": 1 },
        "backend": { "type": "integer", "minimum": 1 }
      }
    }
  }
}
```

```
$ helm template x ./petshelter-chart --set replicas.backend=0
- replicas.backend: Must be greater than or equal to 1
$ helm template x ./petshelter-chart --set replicas.backend=twee
- replicas.backend: Invalid type. Expected: integer, given: string
```

---

## 5. Tests en hooks

### `helm test`

Een test is een pod in `templates/tests/` met de annotation `helm.sh/hook: test`. Helm start hem enkel bij
`helm test`; slaagt het commando in de pod (exit code 0), dan slaagt de test.

```yaml
# templates/tests/test-api.yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-api
  annotations:
    "helm.sh/hook": test
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  restartPolicy: Never
  containers:
    - name: curl
      image: curlimages/curl:8.10.1
      command: ["curl", "-fsS", "http://backend:5000/api/pets"]
```

```bash
helm upgrade --install petshelter ./petshelter-chart -n test -f petshelter-chart/values-test.yaml --wait
helm test petshelter -n test
# TEST SUITE:     test-api
# Phase:          Succeeded
```

Handig als laatste stap in je CI/CD-pipeline: werkt de API na de deploy echt?

### Hooks

Met andere hook-annotations draai je een Job op een bepaald moment, bv. een databasemigratie voor elke upgrade:

| Hook | Wanneer |
|---|---|
| `pre-install` / `post-install` | voor / na de eerste installatie |
| `pre-upgrade` / `post-upgrade` | voor / na elke upgrade |
| `pre-delete` / `post-delete` | voor / na `helm uninstall` |
| `pre-rollback` / `post-rollback` | voor / na een rollback |

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate
  annotations:
    "helm.sh/hook": pre-upgrade
    "helm.sh/hook-weight": "0"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: {{ .Values.images.backend }}
          command: ["node", "migrate.js"]
```

Faalt een `pre-upgrade`-hook, dan gaat de upgrade niet door. Hooks maken een chart wel moeilijker te volgen: gebruik
ze enkel als het niet anders kan.

---

## 6. Dependencies

Een chart kan andere charts bevatten. Je zet ze in `Chart.yaml`:

```yaml
dependencies:
  - name: podinfo
    version: "6.x.x"
    repository: https://stefanprodan.github.io/podinfo
    condition: podinfo.enabled          # aan/uit via values
```

```bash
helm dependency update ./mijnchart     # downloadt naar mijnchart/charts/ en maakt Chart.lock
```

Instellingen voor de dependency zet je in je eigen `values.yaml`, onder de naam van de dependency:

```yaml
podinfo:
  enabled: true
  replicaCount: 2
```

Typisch gebruik: een database of cache met je app meeleveren. Let wel op wie de chart onderhoudt en of de images gratis
blijven: de populaire Bitnami-charts en -images zijn sinds 2025 grotendeels niet meer vrij beschikbaar. Voor een
eenvoudige MongoDB is een eigen Deployment (zoals in de PetShelter-chart) vaak de duidelijkste keuze.

---

## 7. Charts verpakken en publiceren

```bash
helm package ./petshelter-chart              # maakt petshelter-0.1.0.tgz
```

### In een OCI-registry (aanbevolen)

Docker Hub en GitHub Container Registry kunnen naast images ook charts bewaren:

```bash
helm registry login registry-1.docker.io -u jouw-naam
helm push petshelter-0.1.0.tgz oci://registry-1.docker.io/jouw-naam

# Installeren, door iedereen met toegang:
helm install petshelter oci://registry-1.docker.io/jouw-naam/petshelter --version 0.1.0
```

Voor GHCR: `helm registry login ghcr.io` met een token, en `oci://ghcr.io/<gebruiker>`.

### Als klassieke repository (bv. op GitHub Pages)

Een chart repository is een webserver met een `index.yaml` en de `.tgz`-bestanden:

```bash
helm package ./petshelter-chart -d docs/charts
helm repo index docs/charts --url https://<gebruiker>.github.io/<repo>/charts
# commit en push; daarna:
helm repo add mijnrepo https://<gebruiker>.github.io/<repo>/charts
```

**Versies:** verhoog `version` in `Chart.yaml` bij elke wijziging aan de chart (SemVer: `0.1.0` → `0.1.1` voor een
fix, `0.2.0` voor iets nieuws). `appVersion` is de versie van je app.

---

## 8. Veilig upgraden

```bash
helm upgrade --install petshelter ./petshelter-chart -n prod -f petshelter-chart/values-prod.yaml \
  --wait --timeout 5m --atomic
```

| Optie | Effect |
|---|---|
| `--wait` | Helm wacht tot alle pods Ready zijn; zo niet, dan faalt het commando (handig in CI/CD) |
| `--timeout 5m` | hoe lang `--wait` maximaal wacht |
| `--atomic` | faalt de upgrade, dan rolt Helm **automatisch terug** naar de vorige revision (in Helm 4: `--rollback-on-failure`) |
| `--history-max 10` | bewaar maximaal 10 revisions |

**Vooraf zien wat er verandert** kan met de plugin [helm-diff](https://github.com/databus23/helm-diff):

```bash
helm plugin install https://github.com/databus23/helm-diff
helm diff upgrade petshelter ./petshelter-chart -n prod -f petshelter-chart/values-prod.yaml
```

---

## 9. Helm in CI/CD

Een deploy-job in GitHub Actions, na het bouwen en pushen van de images met als tag de commit-hash:

```yaml
  deploy:
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: azure/setup-helm@v4
      - name: Kubeconfig
        run: |
          mkdir -p ~/.kube
          echo "${{ secrets.KUBECONFIG }}" > ~/.kube/config
          chmod 600 ~/.kube/config
      - name: Deploy
        run: |
          helm upgrade --install app ./helm/app -n prod --create-namespace \
            -f helm/app/values-prod.yaml \
            --set images.backend=${{ vars.DOCKERHUB_USER }}/backend:${{ github.sha }} \
            --wait --timeout 5m
```

- De image-tag komt uit de pipeline (`--set`), al de rest uit het values-bestand in git.
- De kubeconfig staat als **GitHub Secret**, nooit in je repository.
- Meer over pipelines: [les 9 – CI/CD](../09-CI-CD/).

**GitOps** is de omgekeerde aanpak: de pipeline wijzigt enkel de tag in git, en een tool in de cluster
([Argo CD](https://argo-cd.readthedocs.io/) of [Flux](https://fluxcd.io/)) voert zelf de `helm upgrade` uit.

---

## 10. Secrets en Helm

Values-bestanden staan in git, dus **geen wachtwoorden in values**. Mogelijkheden, van eenvoudig naar uitgebreid:

| Aanpak | Hoe |
|---|---|
| Secret apart aanmaken | `kubectl create secret …` met de hand of in je pipeline; de chart verwijst ernaar (`dbSecret: db-credentials`). **Zo doen we het in de les.** |
| `--set` vanuit de pipeline | `--set db.password=${{ secrets.DB_PASSWORD }}`; de chart maakt de Secret. Let op: de waarde staat dan in de release-gegevens in de cluster (`helm get values`) |
| Sealed Secrets | versleutelde Secrets die je wel in git mag zetten; enkel de controller in de cluster kan ze ontsleutelen |
| External Secrets / Vault | de Secret wordt opgehaald uit een kluis (HashiCorp Vault, cloud secret manager) |
| helm-secrets + SOPS | values-bestanden versleuteld in git, ontsleuteld bij `helm upgrade` |

Helm bewaart elke release als een Secret van het type `helm.sh/release.v1` in de namespace van de release. Iedereen
die Secrets in die namespace kan lezen, kan dus ook al je values lezen.

---

## 11. Debuggen

```bash
helm lint ./mijnchart -f values-prod.yaml          # fouten en waarschuwingen
helm template x ./mijnchart --debug                # toont ook ongeldige YAML, met de fout
helm template x ./mijnchart -s templates/ingress.yaml   # één template
helm install x ./mijnchart --dry-run=server        # zoals install, en de cluster valideert, maar installeert niets

helm get manifest <release>                        # wat er echt geïnstalleerd is
helm get values <release> --all                    # alle values, ook de standaard
helm history <release>                             # wat gebeurde er wanneer?
```

Valideren tegen de Kubernetes-schema's, zonder cluster (zo doet de automatische controle van de Final het):

```bash
helm template x ./mijnchart -f values-prod.yaml | kubeconform -strict -summary
```

Een release die vastzit in `pending-upgrade` of `pending-install` (bijvoorbeeld na een afgebroken commando): rol
terug naar de laatste goede revision met `helm rollback <release> <revision>`.

---

## 12. Achtergrond: Helm 2, 3 en 4

- **Helm 2** had een server-component in de cluster, **Tiller**, met ruime rechten. Een veiligheidsrisico.
- **Helm 3** (2019) schrapte Tiller: Helm praat rechtstreeks met de Kubernetes API, met jouw rechten uit
  `~/.kube/config`. Charts kregen `apiVersion: v2`.
- **Helm 4** (2025) blijft compatibel met `apiVersion: v2`-charts. Enkele opties kregen een nieuwe naam; bekijk bij
  twijfel `helm <commando> --help`.

Oude tutorials met `helm init` of Tiller zijn van Helm 2: niet meer bruikbaar.

---

## Bronnen

- [Helm documentatie](https://helm.sh/docs/) en [Chart Template Guide](https://helm.sh/docs/chart_template_guide/getting_started/)
- [Best practices voor charts](https://helm.sh/docs/chart_best_practices/)
- [Artifact Hub](https://artifacthub.io): charts zoeken

<!-- {% endraw %} -->
