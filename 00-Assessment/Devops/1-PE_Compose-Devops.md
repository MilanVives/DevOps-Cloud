# 🌩 Permanente Evaluatieopdracht 1 — Docker Compose 2/20ptn

## 🎯 Doel van de opdracht

In deze opdracht toon je aan dat je een cloud-ready applicatie kan containeriseren met Docker en meerdere services kan laten samenwerken met **Docker Compose**.

Je werkt in een **projectrepository** die ook voor PE2 (Minikube) dient — je project groeit mee doorheen het semester.

---

## 🚀 Stap 0 — Je projectrepository opzetten

Doe dit **meteen** — je hebt de repository nodig om in te werken.

1. **Aanvaard de uitnodiging van de GitHub-organisatie `VivesMDima`** die je per mail ontvangt (check ook je spam). Zonder lidmaatschap van de organisatie werkt de accept-link niet.
2. **Aanvaard de opdracht** via de accept-link van je klasgroep:
   **Accept-link 3SD (AJ 26-27):** LINK VOLGT
3. Classroom 50 maakt een **privé repository** voor jou aan: `VivesMDima/2627-devops-ti-project-<jouw-github-username>`.
4. **Clone die repository** — niet de template-repository waarop ze gebaseerd is!
5. Vul `project.yaml` in. De automatische controles lezen dit bestand:

```yaml
naam: Voornaam Achternaam
studentennummer: r0123456
github: jouw-github-username
dockerhub: jouw-dockerhub-username
frontend_port: 8080          # de host-poort waarop je frontend bereikbaar is (zelf te kiezen)
```

De template bevat al de volledige mappenstructuur. Hernoem of verplaats **geen** mappen: de automatische controles zoeken je bestanden op deze plaatsen.

```
project.yaml           ← jouw gegevens
README.md
frontend/              ← PE1: code + Dockerfile
backend/               ← PE1: code + Dockerfile
compose.yaml           ← PE1
.env.example           ← PE1: voorbeeldwaarden, géén echte wachtwoorden
k8s/                   ← PE2: Kubernetes manifests
  frontend/ backend/ database/
docs/
  pe1-compose.md       ← PE1 documentatie
  pe2-minikube.md      ← PE2 documentatie
  images/              ← screenshots
scripts/submit.sh      ← indienen
```

> De eindopdracht (Final Assessment) krijgt later een **eigen repository** met dezelfde mappenstructuur. Je kopieert je werk uit deze projectrepository naar daar.

---

## 🧩 Opdrachtomschrijving

Je containeriseert een **drieservicetoepassing**:

1. **Frontend** – je **React Native**-applicatie uit de les Cross Platform (web-build).
2. **Backend** – je **Java Springboot** API uit de les Java Backend.
3. **Database** – naar keuze (**Postgres**, **MongoDB** of **MySQL**), een officiële Docker Hub image volstaat.

De applicaties hoeven niet af te zijn, maar de drie services moeten **effectief met elkaar communiceren** (frontend → backend → database).

> Volg je de vakken Cross Platform / Java Backend niet? Vraag dan **vooraf** goedkeuring voor een andere applicatie met minstens drie services.

---

## 🧱 Vereisten

### PE1-R0: project.yaml ingevuld

- `naam`, `studentennummer`, `github`, `dockerhub` en `frontend_port` zijn ingevuld; `github` komt overeen met de eigenaar van de repository.
- **0 punten, maar vereist**: zonder geldige `project.yaml` kunnen de andere controles niet draaien.

### PE1-R1: Structuur en geldige compose

- Code + `Dockerfile` in `frontend/` en `backend/`.
- `compose.yaml` in de root van je repository; `docker compose config` geeft geen fouten.

### PE1-R2: Dockerfiles volgens best practices

- Je Dockerfiles geven **geen errors** in [hadolint](https://github.com/hadolint/hadolint).
- Gebruik een `.dockerignore`, een geschikte (liefst slanke) base image en bij voorkeur een multi-stage build.

### PE1-R3: Images publiek op Docker Hub

- Publiceer je frontend- en backend-image **onder je eigen Docker Hub-account** (`dockerhub` uit `project.yaml`), bv. `<dockerhub>/frontend:latest` en `<dockerhub>/backend:latest`.
- De images zijn **publiek** en bestaan voor **`linux/amd64`** — de automatische controle draait op een Intel/AMD-server. Werk je op een Mac met Apple Silicon, bouw dan voor beide platformen:
  `docker buildx build --platform linux/amd64,linux/arm64 -t <dockerhub>/backend:latest --push backend/`
- `compose.yaml` gebruikt **deze** images (`image:`), niet `build:`.

### PE1-R4: Veilige compose-configuratie

- **Enkel de frontend** publiceert een poort naar de host — welke poort kies je zelf, vul ze in als `frontend_port` in `project.yaml`. Backend en database zijn enkel bereikbaar binnen het Docker-netwerk.
- De database vereist authenticatie. Wachtwoorden staan **niet** hardgecodeerd in `compose.yaml` maar komen uit een `.env`-bestand (`${DB_PASSWORD}`).
- `.env` staat in `.gitignore`; je commit enkel `.env.example` met voorbeeldwaarden.

### PE1-R5: Applicatie start volledig automatisch

- `cp .env.example .env && docker compose up -d --wait` start alles zonder manuele tussenkomst.
- Daarna antwoordt `http://localhost:<frontend_port>` met HTTP 200.
- Voorzie een `healthcheck` voor backend en database, en `depends_on` met `condition: service_healthy`.

### PE1-R6: Documentatie volledig

`docs/pe1-compose.md` bevat minstens deze koppen, en elke afbeelding waarnaar je verwijst staat in `docs/images/`:

1. `## Services` — wat doet elke service?
2. `## Docker Hub` — links naar je images.
3. `## Compose-configuratie` — netwerken, poorten, volumes, environment variables: **wat** en **waarom**.
4. `## Commando's` — de commando's die je gebruikte (build, push, up, logs, …) met korte uitleg.
5. `## Screenshots` — minstens: `docker compose ps` met healthy services, de werkende app in de browser, en een bewijs van communicatie frontend → backend → database (bv. data uit de database zichtbaar in de frontend).
6. `## Reflectie` — wat liep moeilijk, wat heb je geleerd?

---

## 📤 Indienen

Gewoon pushen is **niet** indienen. Je dient in door een `submit/…`-tag te pushen; enkel dan draaien de automatische controles:

```bash
git add . && git commit -m "…"
./scripts/submit.sh        # pusht je branch + een submit-tag
```

(Windows: gebruik **Git Bash**. Alternatief: `gh student submit`.)

Bekijk het resultaat onder **Releases**. Elke controle hierboven (PE1-R1 … R6) verschijnt daar met PASS/FAIL. **Je mag onbeperkt opnieuw indienen** — de laatste indiening vóór de deadline telt. De PE2-controles (Minikube) falen op dit moment nog; dat is normaal.

---

## ✅ Beoordelingscriteria

### Automatische controles — 1.2 pt

| Controle | Punten | Hoe gecontroleerd |
|---|---|---|
| PE1-R0: project.yaml ingevuld | 0 | vereist voor de andere controles |
| PE1-R1: Structuur en geldige compose | 0.1 | bestanden aanwezig, `docker compose config` |
| PE1-R2: Dockerfiles volgens best practices | 0.2 | `hadolint`, geen errors |
| PE1-R3: Images publiek op Docker Hub | 0.2 | `docker manifest inspect` (publiek, `linux/amd64`), images gebruikt in `compose.yaml` |
| PE1-R4: Veilige compose-configuratie | 0.3 | enkel de frontend publiceert een poort (`frontend_port`), geen hardgecodeerde wachtwoorden, `.env` niet gecommit |
| PE1-R5: Applicatie start volledig automatisch | 0.3 | `docker compose up --wait` + HTTP 200 op `frontend_port` |
| PE1-R6: Documentatie volledig | 0.1 | koppen aanwezig, afbeeldingen bestaan |

### Beoordeling door de docent — 0.8 pt

| Onderdeel | Punten | Criteria |
|---|---|---|
| Kwaliteit documentatie | 0.5 | • Keuzes worden **uitgelegd** (waarom), niet enkel opgesomd<br>• Commando's correct en met uitleg<br>• Screenshots leesbaar en tonen wat gevraagd is<br>• Reflectie is persoonlijk en concreet |
| Werkende communicatie | 0.2 | Aangetoond dat frontend → backend → database effectief werkt |
| Versiebeheer | 0.1 | Incrementele commits met betekenisvolle boodschappen (niet één grote commit) |

**Totaal: 2 punten**

---

## ⚙️ Praktische tips

- Test lokaal precies wat de controle doet: `cp .env.example .env && docker compose up -d --wait && curl -I localhost:<frontend_port>`.
- Lint je Dockerfiles lokaal: `docker run --rm -i hadolint/hadolint < backend/Dockerfile`.
- Controleer je platformen: `docker manifest inspect -v <dockerhub>/backend:latest | grep architecture` moet `amd64` tonen.
- De code in je repository moet overeenkomen met je gepubliceerde images.

---

## 📅 Deadline

> **maandag 2 november 2026 om 23:59**.
