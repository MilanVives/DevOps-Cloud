# 🌩 Permanente Evaluatieopdracht 1 — Minikube 4/20ptn

## 🎯 Doel van de opdracht

In deze opdracht deploy je een applicatie met minstens drie services naar een lokale Kubernetes-cluster met **Minikube**. Je schrijft zelf de **Kubernetes manifests** en gebruikt **ConfigMaps** en **Secrets** voor configuratie.

---

## 🚀 Stap 0 — Je projectrepository opzetten

Doe dit **meteen** — je hebt de repository nodig om in te werken.

1. **Aanvaard de uitnodiging van de GitHub-organisatie `VivesMDima`** die je per mail ontvangt (check ook je spam). Zonder lidmaatschap van de organisatie werkt de accept-link niet.
2. **Aanvaard de opdracht** via de accept-link van je klasgroep:
   **Accept-link 3CYB (AJ 26-27):** https://classroom50.org/VivesMDima/2627-cloudinfra-ti/assignments/project/accept
3. Classroom 50 maakt een **privé repository** voor jou aan: `VivesMDima/2627-cloudinfra-ti-project-<jouw-github-username>`.
4. **Clone die repository** — niet de template-repository waarop ze gebaseerd is!
5. Vul `project.yaml` in. De automatische controles lezen dit bestand:

```yaml
naam: Voornaam Achternaam
studentennummer: r0123456
github: jouw-github-username
```

De template bevat al de volledige mappenstructuur. Hernoem of verplaats **geen** mappen: de automatische controles zoeken je bestanden op deze plaatsen.

```
project.yaml           ← jouw gegevens
README.md
app/                   ← (optioneel) broncode en Dockerfiles van je applicatie
compose.yaml           ← (optioneel) lokaal testen, niet geëvalueerd
k8s/                   ← PE1: Kubernetes manifests
docs/
  pe1-minikube.md      ← PE1 documentatie
  images/              ← screenshots
scripts/submit.sh      ← indienen
```

> De eindopdracht (Final Assessment) krijgt later een **eigen repository** met dezelfde mappenstructuur. Je kopieert je werk uit deze projectrepository naar daar.

---

## 🧩 Opdrachtomschrijving

- De applicatie mag je **vrij kiezen**, maar ze bevat minstens **drie services** die met elkaar communiceren, bv. frontend → backend → database. De applicatie zelf wordt niet geëvalueerd — de deployment wel.
- Gebruik **publieke container images**: je eigen images op Docker Hub (of een andere publieke registry), of bestaande images.
- Docker en Docker Compose worden in een ander vak geëvalueerd. Je mag je applicatie lokaal met Compose testen, maar dat telt hier niet mee.

---

## 🧱 Vereisten

### PE1-R0: project.yaml ingevuld

- `naam`, `studentennummer` en `github` zijn ingevuld; `github` komt overeen met de eigenaar van de repository.
- **0 punten, maar vereist**: zonder geldige `project.yaml` kunnen de andere controles niet draaien.

### Structuur

```
k8s/
  <service-1>/   deployment.yaml  service.yaml
  <service-2>/   deployment.yaml  service.yaml  configmap.yaml
  <service-3>/   deployment.yaml  service.yaml  secret.example.yaml
docs/pe1-minikube.md
```

> **Secrets horen niet in Git.** Je commit `secret.example.yaml` met **voorbeeldwaarden**. Je echte Secret maak je aan met `kubectl create secret …` (documenteer het commando) of uit een `secret.yaml` die in `.gitignore` staat.

### PE1-R1: Geldige manifests

- Alle YAML-bestanden in `k8s/` zijn geldige Kubernetes-objecten (gecontroleerd met `kubeconform`).
- Minstens drie services, elk met een **Deployment** (of **StatefulSet** voor de database) en een **Service**.

### PE1-R2: ConfigMap en Secret correct gebruikt

- Een **ConfigMap** bevat niet-gevoelige configuratie.
- Een **Secret** bevat de credentials.
- De workloads lezen deze via `configMapKeyRef`/`secretKeyRef` of `envFrom`.

### PE1-R3: Geen gevoelige waarden in workloads

- Geen wachtwoorden, tokens of keys als letterlijke `value:` in een Deployment of StatefulSet.

### PE1-R4: Deployt in een testcluster

- `kubectl apply -f k8s/ --recursive` op een **verse** cluster brengt alle workloads in de status *Ready*.
- De controle maakt zelf de Secret aan vanuit `secret.example.yaml` — zorg dus dat je applicatie werkt met die voorbeeldwaarden.

### PE1-R5: Probes en resources

- Elke container heeft een `readinessProbe`, `resources.requests` en `resources.limits`.

### PE1-R6: Documentatie volledig

`docs/pe1-minikube.md` bevat minstens deze koppen, en elke afbeelding waarnaar je verwijst staat in `docs/images/`:

1. `## Applicatie` — welke services, welke images, hoe communiceren ze?
2. `## Architectuur` — welke Kubernetes-objecten, welke Service-types, hoe vinden de services elkaar (DNS)?
3. `## Deployment` — stap-voor-stap commando's van `minikube start` tot een werkende app, inclusief het aanmaken van de Secret.
4. `## Configuratie` — wat staat in de ConfigMap, wat in de Secret, en **waarom**? Hoe veilig is een Kubernetes Secret eigenlijk?
5. `## Toegang` — hoe bereik je de applicatie vanaf je host?
6. `## Screenshots` — minstens: `kubectl get all`, `kubectl describe` van één workload, de werkende app via Minikube.
7. `## Reflectie` — wat liep moeilijk, wat heb je geleerd?

---

## 📤 Indienen

Gewoon pushen is **niet** indienen. Je dient in door een `submit/…`-tag te pushen; enkel dan draaien de automatische controles:

```bash
git add . && git commit -m "…"
./scripts/submit.sh        # pusht je branch + een submit-tag
```

(Windows: gebruik **Git Bash**. Alternatief: `gh student submit`.)

Bekijk het resultaat onder **Releases**. Elke controle hierboven verschijnt daar met PASS/FAIL. **Je mag onbeperkt opnieuw indienen** — de laatste indiening vóór de deadline telt.

---

## ✅ Beoordelingscriteria

### Automatische controles — 2.4 pt

| Controle | Punten | Hoe gecontroleerd |
|---|---|---|
| PE1-R0: project.yaml ingevuld | 0 | vereist voor de andere controles |
| PE1-R1: Geldige manifests | 0.4 | `kubeconform`, workload + Service per service |
| PE1-R2: ConfigMap en Secret correct gebruikt | 0.4 | referenties naar ConfigMap/Secret in de workloads |
| PE1-R3: Geen gevoelige waarden in workloads | 0.4 | geen letterlijke wachtwoorden in `env` |
| PE1-R4: Deployt in een testcluster | 0.8 | `kind`-cluster in GitHub Actions, alle workloads *Ready* |
| PE1-R5: Probes en resources | 0.2 | `readinessProbe`, `requests`/`limits` aanwezig |
| PE1-R6: Documentatie volledig | 0.2 | koppen aanwezig, afbeeldingen bestaan |

### Beoordeling door de docent — 1.6 pt

| Onderdeel | Punten | Criteria |
|---|---|---|
| Kwaliteit documentatie | 1.0 | • Een derde kan je deployment reproduceren met enkel je stappenplan<br>• Keuzes (Service-types, ConfigMap vs Secret) worden **uitgelegd**<br>• Commando's correct en met uitleg<br>• Screenshots leesbaar en tonen wat gevraagd is |
| Werkend in Minikube | 0.4 | Screenshots tonen de werkende app in Minikube, met communicatie tussen de services |
| Versiebeheer | 0.2 | Incrementele commits met betekenisvolle boodschappen |

**Totaal: 4 punten**

---

## ⚙️ Praktische tips

- Start Minikube met voldoende resources: `minikube start --memory=4096 --cpus=2`.
- Test zoals de controle: `kubectl delete -f k8s/ --recursive` en daarna opnieuw `kubectl apply -f k8s/ --recursive`.
- Valideer lokaal: `kubeconform -summary -recursive k8s/`.
- Images gebouwd op een Mac met Apple Silicon: bouw voor `linux/amd64` (`docker buildx build --platform linux/amd64 …`).

---

## 📅 Deadline

> **vrijdag 30 oktober 2026 om 23:59**.
