# 3 - Docker Compose Advanced

<!-- {% raw %} -->

Verdieping bij [Docker Compose](3-compose.md). Lees eerst die les: hier staan de onderwerpen die je niet nodig hebt
om te starten, maar wel als je project groeit.

---

## 1. Wat Compose onder de motorkap doet

Bij `docker compose up` in de map `2-fe-be` maakt Compose:

| Wat | Naam | Afleiding |
|---|---|---|
| Project | `2-fe-be` | naam van de map (of `-p <naam>` / `name:` bovenaan het bestand) |
| Netwerk | `2-fe-be_default` | `<project>_default` |
| Containers | `2-fe-be-backend-1`, … | `<project>-<service>-<nummer>` |
| Volumes | `2-fe-be_dbdata` | `<project>_<volume>` |

Bekijk het zelf:

```bash
docker network ls
docker network inspect 2-fe-be_default      # welke containers zitten erin, met welk IP?
docker volume ls
```

### Service discovery (DNS)

Elke container in een Compose-netwerk gebruikt de ingebouwde DNS-server van Docker (`127.0.0.11`). Die vertaalt
een **servicenaam** naar het IP van de container. Containers krijgen bij elke start mogelijk een ander IP, maar de
naam blijft: daarom gebruik je altijd namen, nooit IP-adressen.

```bash
docker compose exec backend sh
nslookup mongodb        # toont het IP achter de naam
cat /etc/resolv.conf    # nameserver 127.0.0.11
```

Schaal je een service (`docker compose up -d --scale backend=3`), dan geeft de naam `backend` alle drie de IP's
terug: eenvoudige load balancing.

### `container_name`

Met `container_name: backendcontainer` kies je zelf de containernaam (zie `extended-compose.yml`). Dat is handig voor
`docker logs backendcontainer`, maar dan kan je de service niet meer schalen en botsen twee projecten met dezelfde
naam. Meestal laat je het weg.

---

## 2. Meerdere netwerken: services van elkaar afschermen

Standaard kan elke service elke andere bereiken. Met eigen netwerken bepaal je wie met wie mag praten:

```yaml
services:
  frontend:
    build: ./frontend
    ports: ["8080:80"]
    networks: [front]

  backend:
    build: ./api
    networks: [front, back]     # zit in beide: praat met frontend én database

  mongodb:
    image: mongo:7
    networks: [back]            # de frontend kan de database NIET bereiken

networks:
  front:
  back:
```

Wil je dat een netwerk helemaal geen verbinding met de buitenwereld heeft: `back: { internal: true }`.

---

## 3. `environment`, `env_file` en `.env`: wat is het verschil?

| | Waarvoor | Komt in de container? |
|---|---|---|
| `.env` naast `compose.yaml` | waarden voor `${VAR}` **in het compose-bestand** (interpolatie) | nee, niet automatisch |
| `environment:` | variabelen voor de container | ja |
| `env_file: backend.env` | alle variabelen uit een bestand naar de container | ja |

Voorbeeld met beide:

```yaml
services:
  backend:
    env_file: backend.env              # bv. LOG_LEVEL=debug
    environment:
      DB_PASSWORD: ${DB_PASSWORD}      # uit .env, ingevuld door Compose
```

Bij een conflict wint `environment:` van `env_file:`. Waarden in je shell (`export DB_PASSWORD=...`) winnen van `.env`.
Een ander bestand gebruiken: `docker compose --env-file .env.prod up -d`.

---

## 4. Verschillende omgevingen: override-bestanden

Compose voegt `compose.yaml` en `compose.override.yaml` **automatisch** samen. Gebruik dat voor ontwikkel-instellingen:

`compose.override.yaml` (development):

```yaml
services:
  backend:
    ports: ["3000:3000"]              # in development wil je de API rechtstreeks testen
    volumes:
      - ./api:/app                    # bind mount: codewijzigingen meteen in de container
      - /app/node_modules             # behalve node_modules
    command: npx nodemon server.js
```

Voor productie maak je een apart bestand en geef je beide expliciet mee (dan wordt de override niet gebruikt):

`compose.prod.yaml`:

```yaml
services:
  backend:
    image: jouw-dockerhub-naam/backend:1.4.0
    restart: always
```

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d
docker compose -f compose.yaml -f compose.prod.yaml config    # bekijk het samengevoegde resultaat
```

### `docker compose watch`

Een moderner alternatief voor bind mounts in development:

```yaml
services:
  backend:
    build: ./api
    develop:
      watch:
        - action: sync           # kopieer gewijzigde bestanden naar de container
          path: ./api
          target: /app
          ignore: [node_modules/]
        - action: rebuild        # bouw opnieuw als package.json wijzigt
          path: ./api/package.json
```

Start met `docker compose watch`.

---

## 5. Profiles: services enkel starten als je ze nodig hebt

```yaml
services:
  mongo-express:                 # web-UI voor MongoDB, enkel tijdens debuggen
    image: mongo-express
    ports: ["8081:8081"]
    environment:
      ME_CONFIG_MONGODB_URL: mongodb://${DB_USER}:${DB_PASSWORD}@mongodb:27017/
    profiles: [debug]
```

`docker compose up -d` start mongo-express **niet**; `docker compose --profile debug up -d` wel.

---

## 6. Restart policies en resources

```yaml
services:
  backend:
    restart: unless-stopped       # no | always | on-failure | unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.50"
          memory: 256M
```

| Policy | Herstart wanneer |
|---|---|
| `no` (standaard) | nooit |
| `on-failure` | enkel als de container crasht (exit code ≠ 0) |
| `always` | altijd, ook na een herstart van Docker |
| `unless-stopped` | altijd, behalve als je hem zelf stopte |

`docker stats` toont live het CPU- en geheugengebruik per container.

---

## 7. Volumes: named volume of bind mount?

| | Named volume `dbdata:/data/db` | Bind mount `./api:/app` |
|---|---|---|
| Waar staan de bestanden? | beheerd door Docker | in een map op je laptop |
| Typisch gebruik | databases, data die moet blijven | code tijdens development |
| Werkt op elke machine? | ja | enkel als die map bestaat |

Een back-up van een named volume:

```bash
docker run --rm -v 2-fe-be_dbdata:/data -v "$PWD":/backup alpine \
  tar czf /backup/dbdata.tgz -C /data .
```

---

## 8. Meer commando's

| Commando | Wat |
|---|---|
| `docker compose up -d --force-recreate` | containers opnieuw aanmaken, ook als er niets wijzigde |
| `docker compose up -d --no-deps backend` | enkel `backend` (her)starten, niet de services waarvan hij afhangt |
| `docker compose pull` | nieuwste versies van de `image:`-images ophalen |
| `docker compose build --no-cache backend` | opnieuw bouwen zonder cache |
| `docker compose run --rm backend npm test` | eenmalig een commando in een nieuwe container |
| `docker compose top` | processen in alle containers |
| `docker compose events` | live gebeurtenissen (start, stop, health) |
| `docker compose cp backend:/app/log.txt .` | bestanden kopiëren uit een container |
| `docker compose down --rmi local -v` | alles opruimen: containers, netwerk, volumes en zelf gebouwde images |

---

## 9. Troubleshooting stap voor stap

1. **Leest Compose mijn bestand zoals ik denk?** `docker compose config`
2. **Draait alles?** `docker compose ps -a` (ook gestopte containers, met exit code)
3. **Wat zegt de service?** `docker compose logs --tail 50 backend`
4. **Is hij healthy, en waarom niet?** `docker inspect --format '{{json .State.Health}}' <container>`
5. **Kan service A service B bereiken?** `docker compose exec backend sh`, dan `nslookup mongodb` en `wget -qO- http://mongodb:27017`
6. **Klopt de configuratie in de container?** `docker compose exec backend env`
7. **Oude rommel?** `docker compose down -v`, daarna `docker compose up -d --build`

---

## 10. Best practices (samengevat)

- Gebruik **vaste versies** van images (`mongo:7`, `nginx:1.27-alpine`), niet enkel `latest`.
- Publiceer **enkel poorten die echt van buitenaf nodig zijn**; de rest praat via het Compose-netwerk.
- **Geen wachtwoorden in `compose.yaml`**: gebruik `.env` (in `.gitignore`) en commit een `.env.example`.
- Geef elke service waar andere van afhangen een **healthcheck**, en gebruik `condition: service_healthy`.
- Gebruik **named volumes** voor data die moet blijven.
- Houd development-instellingen (bind mounts, extra poorten) in `compose.override.yaml`, niet in het basisbestand.
- Test zoals een ander het zal doen: verse clone, `cp .env.example .env`, `docker compose up -d --wait`.

<!-- {% endraw %} -->
