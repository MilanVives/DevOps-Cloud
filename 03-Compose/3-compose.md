# 3 - Docker Compose: meerdere containers met één bestand

## Waar gaat deze les over?

Een echte applicatie bestaat zelden uit één container. Onze **foods-app** heeft er drie:

```
Browser ──► frontend (nginx, HTML)  ──►  backend (Node.js API)  ──►  database (MongoDB)
```

Met `docker run` moet je elke container apart starten, met een netwerk, poorten, variabelen en volumes.
**Docker Compose** zet dat allemaal in één bestand (`compose.yaml`) en start alles met één commando.

**Na deze les kan je:**
- een `compose.yaml` lezen en schrijven voor een app met meerdere services;
- de belangrijkste `docker compose`-commando's gebruiken;
- uitleggen hoe services elkaar vinden (service name = hostname);
- wachtwoorden uit een `.env`-bestand halen en services laten wachten op elkaar;
- een compose-bestand opzetten zoals gevraagd in [PE1](../00-Assessment/Devops/1-PE_Compose-Devops.md).

De voorbeelden staan in [`compose-files/`](compose-files/):

| Map | Wat |
|---|---|
| `1-fe/` | enkel een statische website (nginx) |
| `2-fe-be/` | frontend + backend + database met Compose |
| `3-best-practice/` | dezelfde app, maar netjes: enkel de frontend bereikbaar, wachtwoorden in `.env`, healthchecks |

> Meer weten (netwerken onder de motorkap, override-bestanden, profiles, troubleshooting)?
> Zie [Compose Advanced](Compose-Advanced.md).

---

## 1. Het probleem: drie containers met `docker run`

Zonder Compose start je de foods-app zo:

```bash
# 1. Een netwerk zodat de containers elkaar kunnen vinden
docker network create foods-net

# 2. De database, met een volume zodat de data blijft bestaan
docker run -d --name mongodb --network foods-net -v dbdata:/data/db mongo:7

# 3. De backend (eerst bouwen), met de verbinding naar de database
docker build -t foods-api ./api
docker run -d --name backend --network foods-net -p 3000:3000 \
  -e MONGO_URI=mongodb://mongodb:27017/foodsdb foods-api

# 4. De frontend
docker build -t foods-frontend ./frontend
docker run -d --name frontend --network foods-net -p 8080:80 foods-frontend
```

En stoppen? `docker stop` + `docker rm` voor elke container, en het netwerk opruimen.
Dat is veel typwerk, je moet de volgorde onthouden, en een collega kan het moeilijk nadoen.

---

## 2. De oplossing: `compose.yaml`

Hetzelfde in Compose (`compose-files/2-fe-be/compose.yml`):

```yaml
services:
  backend:
    build: ./api
    ports:
      - 3000:3000
    environment:
      - PORT=3000
      - MONGO_URI=mongodb://mongodb:27017/foodsdb
    depends_on:
      - mongodb

  frontend:
    build: ./frontend
    ports:
      - 8080:80

  mongodb:
    image: mongo:7
    volumes:
      - dbdata:/data/db

volumes:
  dbdata:
```

Starten en stoppen:

```bash
cd compose-files/2-fe-be
docker compose up -d --build     # bouwt de images en start alles op de achtergrond
docker compose ps                # wat draait er?
docker compose down              # alles stoppen en opruimen
```

Open http://localhost:8080: de frontend toont de lijst met foods uit de database.

### Regel per regel

| Regel | Betekenis | Vergelijk met `docker run` |
|---|---|---|
| `services:` | de lijst met containers van je app; elke naam (`backend`, `frontend`, `mongodb`) is één service | — |
| `build: ./api` | bouw een image met de `Dockerfile` in de map `./api` | `docker build ./api` |
| `image: mongo:7` | gebruik een bestaande image van Docker Hub, **met een vaste versie** | `docker run mongo:7` |
| `ports: - 3000:3000` | `host:container`: poort 3000 van je laptop gaat naar poort 3000 in de container | `-p 3000:3000` |
| `environment:` | environment variables voor de container | `-e MONGO_URI=...` |
| `depends_on:` | start `mongodb` vóór `backend` | (volgorde zelf onthouden) |
| `volumes: - dbdata:/data/db` | bewaar `/data/db` in het named volume `dbdata`: de data overleeft `down` | `-v dbdata:/data/db` |
| `volumes: dbdata:` (onderaan) | maak het named volume `dbdata` aan | `docker volume create dbdata` |

En het **netwerk**? Dat maakt Compose zelf: alle services van één compose-bestand komen automatisch in hetzelfde netwerk.

> **Waarom `mongo:7` en niet gewoon `mongo`?** `mongo` betekent `mongo:latest`, en dat verandert zonder dat je het
> merkt. In oktober 2026 werd `latest` MongoDB 9, en die weigert te starten op de Linux-kernel van de huidige
> Docker Desktop (*"Linux kernel versions 6.19.0 through 7.0.13 have a known incompatibility"*). Met een vaste versie
> werkt je app morgen nog precies zoals vandaag.

> **Tip:** de bestandsnaam `compose.yaml` (of `compose.yml`, `docker-compose.yml`) vindt Compose vanzelf.
> Een andere naam geef je mee met `-f`: `docker compose -f extended-compose.yml up -d`.

---

## 3. De commando's die je elke dag gebruikt

Voer ze uit in de map met je `compose.yaml`.

| Commando | Wat het doet |
|---|---|
| `docker compose up -d` | alles starten op de achtergrond (`-d` = detached) |
| `docker compose up -d --build` | eerst de images opnieuw bouwen (na een wijziging in je code of Dockerfile) |
| `docker compose ps` | status van alle services |
| `docker compose logs -f backend` | logs van één service volgen (`Ctrl+C` om te stoppen met volgen) |
| `docker compose exec backend sh` | een shell openen in een draaiende container |
| `docker compose restart backend` | één service herstarten |
| `docker compose stop` | stoppen, containers blijven bestaan |
| `docker compose down` | stoppen en containers + netwerk verwijderen (volumes blijven) |
| `docker compose down -v` | ook de volumes verwijderen: **je database is leeg** |
| `docker compose config` | toont je compose-bestand zoals Compose het leest (handig om fouten te vinden) |

---

## 4. Hoe vinden de services elkaar?

Kijk naar de backend:

```yaml
MONGO_URI=mongodb://mongodb:27017/foodsdb
```

`mongodb` is hier de **naam van de service**. In het netwerk dat Compose aanmaakt, werkt elke servicenaam
als hostname: de backend vindt de database op `mongodb:27017`, zonder IP-adressen.

```
┌──────────────── Compose-netwerk ────────────────┐
│  frontend:80      backend:3000      mongodb:27017 │
└──────────────────────────────────────────────────┘
        ▲ 8080            ▲ 3000
        │                 │          (poorten op je laptop)
      browser           browser
```

Twee regels die veel fouten voorkomen:

1. **`localhost` in een container = die container zelf.** De backend moet `mongodb:27017` gebruiken, niet `localhost:27017`.
2. **De browser draait op je laptop, niet in het netwerk.** In `2-fe-be` haalt JavaScript in de browser de data op via
   `http://localhost:3000`. Daarom moet de backend daar een poort publiceren. In `3-best-practice` lossen we dat netter op (sectie 7).

Zelf testen:

```bash
docker compose exec backend sh
# in de container:
ping mongodb          # werkt: de servicenaam wordt een IP
wget -qO- localhost:3000
exit
```

---

## 5. Wachtwoorden en instellingen in `.env`

Wachtwoorden horen niet in `compose.yaml`: dat bestand staat in Git. Zet ze in een bestand `.env`
**naast** `compose.yaml`; Compose leest dat automatisch en vult `${...}` in.

`.env` (komt **niet** in Git, zet het in `.gitignore`):

```bash
DB_USER=admin
DB_PASSWORD=mijn-geheim
```

`compose.yaml`:

```yaml
services:
  mongodb:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${DB_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${DB_PASSWORD}
```

Commit wel een **`.env.example`** met voorbeeldwaarden, zodat iemand anders weet welke variabelen nodig zijn:

```bash
cp .env.example .env     # en daarna je eigen wachtwoord invullen
```

Controleer met `docker compose config` of de waarden goed ingevuld worden.

---

## 6. Wachten tot een service echt klaar is: healthchecks

`depends_on` regelt enkel de **startvolgorde**: de backend start ná de database, maar de database is op dat moment
misschien nog niet klaar om verbindingen aan te nemen. Met een **healthcheck** weet Compose wanneer een service
echt werkt, en met `condition: service_healthy` wacht de volgende service daarop:

```yaml
services:
  mongodb:
    image: mongo:7
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      retries: 20

  backend:
    build: ./api
    depends_on:
      mongodb:
        condition: service_healthy     # start pas als mongodb "healthy" is
```

`docker compose ps` toont dan `(healthy)` naast de service, en `docker compose up -d --wait` wacht tot alles healthy is.

---

## 7. Alles samen: de "best practice"-versie (zoals in PE1)

`compose-files/3-best-practice/` is dezelfde foods-app, met alles uit deze les:

```yaml
services:
  mongodb:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${DB_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${DB_PASSWORD}
    volumes:
      - dbdata:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      retries: 20

  backend:
    build: ./api
    environment:
      PORT: 3000
      MONGO_URI: mongodb://${DB_USER}:${DB_PASSWORD}@mongodb:27017/foodsdb?authSource=admin
    depends_on:
      mongodb:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/"]
      interval: 5s
      retries: 20

  frontend:
    build: ./frontend
    ports:
      - "8080:80"            # de ENIGE poort naar buiten
    depends_on:
      backend:
        condition: service_healthy

volumes:
  dbdata:
```

Wat is er anders dan in `2-fe-be`?

| | `2-fe-be` | `3-best-practice` |
|---|---|---|
| Poorten naar buiten | frontend **en** backend | **enkel de frontend** |
| Database | zonder wachtwoord | met wachtwoord uit `.env` |
| Startvolgorde | `depends_on` (enkel volgorde) | healthchecks + `condition: service_healthy` |
| Hoe bereikt de browser de API? | rechtstreeks via `localhost:3000` | via de frontend: `/api/` |

**Hoe komt de browser dan aan de API, zonder backend-poort?** De frontend-nginx stuurt alles onder `/api/`
door naar de backend, binnen het Docker-netwerk (`frontend/nginx.conf`):

```nginx
location /api/ {
  proxy_pass http://backend:3000/;
}
```

en de JavaScript in de pagina gebruikt een relatieve URL: `fetch('/api/')`. Zo is enkel de frontend bereikbaar,
en kan niemand de backend of de database rechtstreeks aanspreken.

Uitproberen:

```bash
cd compose-files/3-best-practice
cp .env.example .env
docker compose up -d --build --wait
docker compose ps                   # alle services (healthy), enkel frontend heeft een poort
curl localhost:8080/api/            # de foods, via de frontend
docker compose down -v
```

---

## 8. Images van Docker Hub gebruiken in plaats van `build:`

Tijdens het ontwikkelen gebruik je `build:`. Wil je de app op een andere machine draaien, dan push je de images
naar Docker Hub (zie [Dockerfile – Je image delen](../02-Dockerfile/Dockerfile-Intro.md#7-je-image-delen-via-docker-hub))
en verwijs je ernaar met `image:`:

```yaml
services:
  backend:
    image: jouw-dockerhub-naam/backend:latest
  frontend:
    image: jouw-dockerhub-naam/frontend:latest
```

Iedereen kan de app dan starten met enkel `compose.yaml` en `.env`: `docker compose up -d`. Dat is wat PE1 vraagt.

---

## 9. Veelgemaakte fouten

| Symptoom | Oorzaak en oplossing |
|---|---|
| `connect ECONNREFUSED 127.0.0.1:27017` in de backend-logs | je gebruikt `localhost` in de container: gebruik de servicenaam (`mongodb`) |
| `port is already allocated` | een andere container of app gebruikt die poort al: `docker ps`, of kies een andere host-poort (`8081:80`) |
| Wijziging in je code is niet zichtbaar | `docker compose up -d --build` (zonder `--build` gebruikt Compose de oude image) |
| Database is leeg na herstart | je deed `down -v` (volumes weg), of je hebt geen volume voor de data |
| `yaml: line 12: did not find expected key` | inspringing klopt niet: YAML gebruikt **spaties** (geen tabs), altijd evenveel per niveau |
| Variabele is leeg (`${DB_PASSWORD}`) | `.env` staat niet naast `compose.yaml`, of de naam is anders: controleer met `docker compose config` |
| Backend start, maar crasht meteen | de database is nog niet klaar: healthcheck + `condition: service_healthy` (sectie 6) |
| `mongodb` stopt meteen (`Exited (1)`) | bekijk `docker compose logs mongodb`; vaak een te nieuwe `latest`-versie: gebruik `mongo:7` |

Bij twijfel: `docker compose ps` (draait het?), `docker compose logs <service>` (wat zegt het?),
`docker compose config` (leest Compose wat ik denk?).

---

## 10. Oefeningen

1. **Starten.** Start `2-fe-be` met `docker compose up -d --build`. Open http://localhost:8080. Bekijk met
   `docker compose logs -f backend` hoe de backend verbinding maakt met de database.
2. **Service names.** Ga met `docker compose exec backend sh` in de backend en `ping mongodb`. Wat gebeurt er als je
   in `compose.yml` de service `mongodb` hernoemt naar `db`? Wat moet je nog aanpassen?
3. **Volumes.** Doe `docker compose down` en daarna weer `up -d`: is de data er nog? En na `down -v`?
4. **`.env`.** Geef de database in `2-fe-be` een gebruiker en wachtwoord via `.env` (kijk naar `3-best-practice`).
   Controleer met `docker compose config`.
5. **Enkel de frontend.** Start `3-best-practice`. Probeer `curl localhost:3000`: waarom werkt dat niet, en
   `curl localhost:8080/api/` wel?
6. **PE1.** Pas wat je geleerd hebt toe op je eigen frontend + backend + database (zie de
   [PE1-opdracht](../00-Assessment/Devops/1-PE_Compose-Devops.md)).
