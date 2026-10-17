# 🌩 Permanente Evaluatieopdracht 2 — Minikube 2/20ptn

## 🎯 Doel van de opdracht

In deze opdracht deploy je je applicatie uit PE1 naar een lokale Kubernetes-cluster met **Minikube**. Je schrijft zelf de **Kubernetes manifests** en gebruikt **ConfigMaps** en **Secrets** voor configuratie.

Je werkt verder in dezelfde **projectrepository** als PE1.

---

## 🧩 Opdrachtomschrijving

Je deployt dezelfde **drieservicetoepassing** uit PE1 (frontend, backend, database) naar Minikube, met je Docker Hub images uit PE1 en een officiële database-image.

---

## 🧱 Vereisten

### Structuur

```
k8s/
  frontend/   deployment.yaml  service.yaml
  backend/    deployment.yaml  service.yaml  configmap.yaml
  database/   deployment.yaml  service.yaml  secret.example.yaml
docs/pe2-minikube.md
```

> **Secrets horen niet in Git.** Je commit `secret.example.yaml` met **voorbeeldwaarden**. Je echte Secret maak je aan met `kubectl create secret …` (documenteer het commando) of uit een `secret.yaml` die in `.gitignore` staat.

### PE2-R1: Geldige manifests

- Alle YAML-bestanden in `k8s/` zijn geldige Kubernetes-objecten (gecontroleerd met `kubeconform`).
- Elke service heeft een **Deployment** en een **Service**.

### PE2-R2: ConfigMap en Secret correct gebruikt

- Een **ConfigMap** bevat niet-gevoelige configuratie (bv. `DB_URL`).
- Een **Secret** bevat de database-credentials.
- Backend en database lezen deze via `configMapKeyRef`/`secretKeyRef` of `envFrom`.

### PE2-R3: Geen gevoelige waarden in Deployments

- Geen wachtwoorden, tokens of keys als letterlijke `value:` in een Deployment.

### PE2-R4: Deployt in een testcluster

- `kubectl apply -f k8s/ --recursive` op een **verse** cluster brengt alle Deployments in de status *Available*.
- De controle maakt zelf de Secret aan vanuit `secret.example.yaml` — zorg dus dat je applicatie werkt met die voorbeeldwaarden.

### PE2-R5: Probes en resources

- Frontend en backend hebben een `readinessProbe`.
- Elke container heeft `resources.requests` en `resources.limits`.

### PE2-R6: Documentatie volledig

`docs/pe2-minikube.md` bevat minstens deze koppen, en elke afbeelding waarnaar je verwijst staat in `docs/images/`:

1. `## Architectuur` — welke Kubernetes-objecten heb je, en hoe vinden de services elkaar (DNS, Service-types)?
2. `## Deployment` — stap-voor-stap commando's van `minikube start` tot een werkende app, inclusief het aanmaken van de Secret.
3. `## Configuratie` — welke waarden zitten in de ConfigMap, welke in de Secret, en **waarom**?
4. `## Toegang` — hoe bereik je de frontend vanaf je host (`minikube service`, NodePort, port-forward)?
5. `## Screenshots` — minstens: `kubectl get all`, `kubectl describe` van één Deployment, de werkende app via Minikube.
6. `## Reflectie` — verschillen tussen Docker Compose en Kubernetes; wat liep moeilijk?

---

## 📤 Indienen

```bash
./scripts/submit.sh
```

Je resultaat verschijnt onder **Releases**. De PE1-controles blijven ook zichtbaar, maar voor PE1 telt enkel je indiening vóór de PE1-deadline.

---

## ✅ Beoordelingscriteria

### Automatische controles — 1.2 pt

| Controle | Punten | Hoe gecontroleerd |
|---|---|---|
| PE2-R1: Geldige manifests | 0.2 | `kubeconform`, Deployment + Service per service |
| PE2-R2: ConfigMap en Secret correct gebruikt | 0.2 | referenties naar ConfigMap/Secret in de Deployments |
| PE2-R3: Geen gevoelige waarden in Deployments | 0.2 | geen letterlijke wachtwoorden in `env` |
| PE2-R4: Deployt in een testcluster | 0.4 | `kind`-cluster in GitHub Actions, alle Deployments *Available* |
| PE2-R5: Probes en resources | 0.1 | `readinessProbe`, `requests`/`limits` aanwezig |
| PE2-R6: Documentatie volledig | 0.1 | koppen aanwezig, afbeeldingen bestaan |

### Beoordeling door de docent — 0.8 pt

| Onderdeel | Punten | Criteria |
|---|---|---|
| Kwaliteit documentatie | 0.5 | • Een derde kan je deployment reproduceren met enkel je stappenplan<br>• Keuzes (Service-types, ConfigMap vs Secret) worden **uitgelegd**<br>• Screenshots leesbaar en tonen wat gevraagd is<br>• Reflectie is concreet |
| Werkend in Minikube | 0.2 | Screenshots tonen de werkende app in Minikube, frontend bereikbaar vanaf de host |
| Versiebeheer | 0.1 | Incrementele commits met betekenisvolle boodschappen |

**Totaal: 2 punten**

---

## ⚙️ Praktische tips

- Start Minikube met voldoende resources: `minikube start --memory=4096 --cpus=2`.
- Test zoals de controle: `kubectl delete -f k8s/ --recursive` en daarna opnieuw `kubectl apply -f k8s/ --recursive`.
- Valideer lokaal: `kubeconform -summary -recursive k8s/`.
- Debuggen: `kubectl get pods`, `kubectl describe pod …`, `kubectl logs …`.

---

## 📅 Deadline

> **vrijdag 4 december 2026 om 13:59**.
