# 7 - Helm: alle commando's

<!-- {% raw %} -->

Naslag bij de [Helm-les](helm.md). Uitleg en voorbeelden staan daar; hier vind je alle commando's en de belangrijkste
opties op één plek. Volledige documentatie: `helm <commando> --help` of [helm.sh/docs/helm](https://helm.sh/docs/helm/helm/).

Voeg `-n <namespace>` toe bij elk commando over een release die niet in `default` staat.

---

## Een nieuwe chart maken

| Commando | Wat |
|---|---|
| `helm create <naam>` | nieuwe chart in map `<naam>/`, met een volledige voorbeeldchart (nginx) |
| `rm -rf <naam>/templates/*` | voorbeeldtemplates weg: begin met een lege chart |
| `helm create <naam> --starter <starter>` | nieuwe chart op basis van een eigen startersjabloon |

**Een bestaande app omzetten** (zoals in [PetShelter naar Helm](helm-petshelter.md)):

```bash
helm create petshelter-chart
rm -rf petshelter-chart/templates/*
: > petshelter-chart/values.yaml
cp k8s/*.yaml petshelter-chart/templates/              # werkt meteen, zonder variabelen
helm install petshelter ./petshelter-chart -n test --create-namespace
# daarna: vaste waarden één voor één vervangen door {{ .Values... }}
```

> **`helm init` bestaat niet meer.** In Helm 2 installeerde `helm init` de servercomponent Tiller in je cluster. Een
> chart maken was toen ook al `helm create`. Sinds Helm 3 is er geen Tiller en geen `helm init` meer (zie de
> tabel onderaan).

---

## Een chart ontwikkelen en controleren

| Commando | Wat |
|---|---|
| `helm lint <map>` | chart controleren op fouten en slechte gewoontes |
| `helm lint <map> -f values-prod.yaml` | controleren met een bepaald values-bestand |
| `helm template <release> <map>` | de ingevulde YAML tonen, zonder iets te installeren |
| `helm template <release> <map> -f values-prod.yaml` | idem, met de waarden van een omgeving |
| `helm template <release> <map> -s templates/ingress.yaml` | één template tonen |
| `helm template <release> <map> --debug` | ook ongeldige YAML tonen, met de fout |
| `helm install <release> <map> --dry-run` | install simuleren, zonder iets te installeren |
| `helm install <release> <map> --dry-run=server` | idem, en de cluster valideert de objecten |
| `helm template … \| kubeconform -strict -summary` | valideren tegen de Kubernetes-schema's (zonder cluster) |

---

## Installeren en upgraden

| Commando | Wat |
|---|---|
| `helm install <release> <chart>` | installeren; `<chart>` = map, `.tgz`, `repo/chart` of `oci://…` |
| `helm upgrade <release> <chart>` | een bestaande release bijwerken |
| `helm upgrade --install <release> <chart>` | installeren als hij nog niet bestaat, anders upgraden (**ideaal voor CI/CD**) |

**Opties** voor `install` en `upgrade`:

| Optie | Wat |
|---|---|
| `-n <ns>` / `--create-namespace` | namespace / namespace aanmaken als hij niet bestaat |
| `-f <bestand>` (`--values`) | values-bestand; meerdere keren mag, het laatste wint |
| `--set a.b=waarde` | één waarde op de command line (wint van `-f`) |
| `--set-string a=123` | waarde altijd als tekst (niet als getal) |
| `--set-file a=pad` | inhoud van een bestand als waarde |
| `--reuse-values` | (upgrade) de vorige values behouden en enkel de nieuwe `--set`/`-f` erbovenop |
| `--reset-values` | (upgrade) terug naar de standaardwaarden van de chart |
| `--version <x>` | een bepaalde versie van de chart (uit een repository) |
| `--wait` / `--timeout 5m` | wachten tot alles Ready is / hoe lang maximaal |
| `--atomic` | bij een fout automatisch terugdraaien (Helm 4: `--rollback-on-failure`) |
| `--description "…"` | eigen omschrijving, zichtbaar in `helm history` |
| `--history-max 10` | maximaal 10 revisions bewaren |
| `--dry-run` / `--debug` | simuleren / meer uitvoer |

**Welke values winnen?** `values.yaml` van de chart → `-f bestand1` → `-f bestand2` → `--set` (rechts wint).

---

## Releases bekijken en beheren

| Commando | Wat |
|---|---|
| `helm list` (`ls`) | releases in de huidige namespace |
| `helm list -A` | releases in alle namespaces |
| `helm list --all` | ook mislukte en verwijderde (met `--keep-history`) releases |
| `helm status <release>` | status, laatste deploy en NOTES |
| `helm get values <release>` | de values die jij hebt ingesteld |
| `helm get values <release> --all` | alle values, ook de standaardwaarden |
| `helm get manifest <release>` | de YAML die echt geïnstalleerd is |
| `helm get notes <release>` | de NOTES.txt |
| `helm get hooks <release>` | de hooks |
| `helm get all <release>` | alles hierboven samen |
| `helm history <release>` | alle revisions, met datum en status |
| `helm rollback <release>` | terug naar de vorige revision |
| `helm rollback <release> <revision>` | terug naar een bepaalde revision |
| `helm test <release>` | de tests uit `templates/tests/` uitvoeren |
| `helm uninstall <release>` | release en al zijn objecten verwijderen |
| `helm uninstall <release> --keep-history` | verwijderen, maar de geschiedenis bewaren |

---

## Charts zoeken en bekijken

| Commando | Wat |
|---|---|
| `helm repo add <naam> <url>` | repository toevoegen |
| `helm repo update` | lijst van charts bijwerken (zoals `apt update`) |
| `helm repo list` / `helm repo remove <naam>` | repositories tonen / verwijderen |
| `helm search repo <woord>` | zoeken in je toegevoegde repositories |
| `helm search repo <woord> --versions` | alle versies tonen |
| `helm search hub <woord>` | zoeken op [Artifact Hub](https://artifacthub.io) |
| `helm show values <chart>` | alle instelbare waarden (vertrekpunt voor je eigen values-bestand) |
| `helm show chart <chart>` / `helm show readme <chart>` | `Chart.yaml` / README |
| `helm show all <chart>` | alles samen |
| `helm pull <chart> --untar` | chart downloaden en uitpakken, om de templates te bekijken |

Handig: `helm show values traefik/traefik > traefik-values.yaml`, aanpassen, en installeren met `-f traefik-values.yaml`.

---

## Dependencies

| Commando | Wat |
|---|---|
| `helm dependency update <map>` | dependencies uit `Chart.yaml` downloaden naar `charts/`, maakt `Chart.lock` |
| `helm dependency build <map>` | `charts/` opnieuw opbouwen volgens `Chart.lock` |
| `helm dependency list <map>` | dependencies en hun status |

---

## Verpakken en publiceren

| Commando | Wat |
|---|---|
| `helm package <map>` | chart verpakken tot `<naam>-<versie>.tgz` |
| `helm package <map> -d <doelmap>` | in een andere map |
| `helm repo index <map> --url <url>` | `index.yaml` maken voor een eigen repository (bv. GitHub Pages) |
| `helm registry login <registry>` | inloggen op een OCI-registry (Docker Hub, GHCR) |
| `helm push <chart>.tgz oci://<registry>/<gebruiker>` | chart naar een OCI-registry |
| `helm install <release> oci://<registry>/<gebruiker>/<chart> --version <x>` | installeren uit een OCI-registry |
| `helm pull oci://… --version <x>` | downloaden uit een OCI-registry |

---

## Plugins en omgeving

| Commando | Wat |
|---|---|
| `helm plugin install <url>` | plugin installeren, bv. `https://github.com/databus23/helm-diff` |
| `helm plugin list` / `update` / `uninstall` | plugins beheren |
| `helm diff upgrade <release> <chart> -f …` | (plugin helm-diff) tonen wat een upgrade zou veranderen |
| `helm version` | versie van Helm |
| `helm env` | waar Helm zijn bestanden bewaart (cache, config, plugins) |
| `helm completion zsh` (of `bash`, `fish`, `powershell`) | tab-aanvulling voor je shell |
| `helm <commando> --help` | alle opties van een commando |

---

## Van Helm 2 naar Helm 3/4

Oude tutorials gebruiken nog Helm 2. Die commando's werken niet meer:

| Helm 2 | Helm 3 en 4 |
|---|---|
| `helm init` (installeert Tiller) | niet meer nodig: geen Tiller |
| `helm install --name mijnapp ./chart` | `helm install mijnapp ./chart` |
| `helm delete --purge mijnapp` | `helm uninstall mijnapp` |
| `helm inspect values` | `helm show values` |
| `helm fetch` | `helm pull` |
| `helm search` | `helm search repo` of `helm search hub` |
| releases voor de hele cluster | releases per **namespace** (`-n`) |
| `apiVersion: v1` in `Chart.yaml` | `apiVersion: v2` |

<!-- {% endraw %} -->
