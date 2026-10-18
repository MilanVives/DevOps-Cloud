# 2 - Dockerfile cheatsheet

Alle Dockerfile-instructies op één pagina. **Deel 1** bevat de instructies die je in bijna elke Dockerfile gebruikt.
**Deel 2** de instructies die je minder vaak nodig hebt, maar die goed zijn om te kennen.

Uitleg met voorbeelden: [Dockerfile-les](Dockerfile-Intro.md) · Verdieping: [Dockerfile Advanced](Dockerfile-Advanced.md)

---

## Deel 1 — De meest gebruikte instructies

| Instructie | Uitleg | Voorbeeld |
|---|---|---|
| **`FROM`** | De **basis-image** waarop je verderbouwt. Altijd de eerste instructie. Kies een vaste versie en liefst een slanke variant (`-alpine`, `-slim`). | `FROM node:22-alpine` |
| **`WORKDIR`** | Stelt de **werkmap** in de image in (en maakt ze aan). Alle volgende `COPY`, `RUN` en `CMD` werken vanaf hier. Beter dan `RUN cd …`. | `WORKDIR /app` |
| **`COPY`** | **Kopieert** bestanden of mappen van je laptop (de *build context*) naar de image. De standaardkeuze om bestanden toe te voegen. | `COPY package*.json ./` <br> `COPY . .` |
| **`ADD`** | Zoals `COPY`, maar kan ook een **`.tar`-archief uitpakken** en een **bestand van een URL** downloaden. Gebruik het enkel daarvoor; voor gewone bestanden kies je `COPY`. | `ADD site.tar.gz /usr/share/nginx/html/` |
| **`RUN`** | Voert een commando uit **tijdens het bouwen**; het resultaat wordt een nieuwe layer in de image. Voor installeren en compileren. Combineer gerelateerde commando's met `&&`. | `RUN npm ci --omit=dev` <br> `RUN apk add --no-cache curl` |
| **`CMD`** | Het **standaardcommando bij het starten** van de container (`docker run`). Eén per Dockerfile, de laatste telt. Wordt overschreven als je een commando meegeeft: `docker run image node andere.js`. | `CMD ["node", "server.js"]` |
| **`ENTRYPOINT`** | Het **vaste programma** van de container. Wat je achter `docker run image …` typt (of wat in `CMD` staat) wordt als **argumenten** meegegeven. Handig voor images die zich als een commando gedragen. | `ENTRYPOINT ["curl"]` <br> `CMD ["--help"]` |
| **`EXPOSE`** | **Documenteert** op welke poort de app luistert. Opent zelf niets: daarvoor gebruik je `docker run -p 8080:80` of `ports:` in Compose. | `EXPOSE 3000` |
| **`ENV`** | Zet een **environment variable**, tijdens de build én in de draaiende container. Overschrijfbaar met `docker run -e`. Niet voor wachtwoorden. | `ENV NODE_ENV=production` |

### `CMD` vs `ENTRYPOINT`

| Dockerfile | `docker run image` | `docker run image -I https://vives.be` |
|---|---|---|
| `CMD ["curl", "--help"]` | `curl --help` | fout: `-I` vervangt het hele commando |
| `ENTRYPOINT ["curl"]` + `CMD ["--help"]` | `curl --help` | `curl -I https://vives.be` |

**Kort:** `CMD` = "dit start standaard, maar je mag het vervangen". `ENTRYPOINT` = "dit programma start altijd, jij
kiest de argumenten". Voor een gewone app (webserver, API) volstaat `CMD`.

### `COPY` vs `ADD`

Gebruik **`COPY`**. Neem `ADD` enkel als je bewust een lokaal `.tar`-bestand wil laten uitpakken. Een download van een
URL doe je beter met `RUN curl …`, zodat je de download kan controleren.

### Exec-vorm vs shell-vorm (`CMD`, `ENTRYPOINT`, `RUN`)

| Vorm | Voorbeeld | Wat gebeurt er |
|---|---|---|
| **Exec** (aanbevolen voor `CMD`/`ENTRYPOINT`) | `CMD ["node", "server.js"]` | het programma start rechtstreeks en krijgt signalen zoals `docker stop` netjes binnen |
| **Shell** | `CMD node server.js` | start via `/bin/sh -c`: variabelen zoals `$PORT` werken, maar `docker stop` bereikt je app soms niet en wacht dan 10 seconden |

`RUN` schrijf je meestal in shell-vorm: `RUN apk add --no-cache curl && rm -rf /tmp/*`.

### Een typische Dockerfile met deel 1

```dockerfile
# Basis
FROM node:22-alpine
# Werkmap
WORKDIR /app
# Eerst de dependencies (cache!)
COPY package*.json ./
RUN npm ci --omit=dev
# Dan de code
COPY . .
# Configuratie en documentatie van de poort
ENV NODE_ENV=production
EXPOSE 3000
# Start bij docker run
CMD ["node", "server.js"]
```

> **Let op:** een `#` is in een Dockerfile **enkel aan het begin van een regel** een commentaar.
> `FROM node:22-alpine  # basis` werkt niet: `# basis` wordt dan deel van de instructie.

---

## Deel 2 — Minder gebruikte, maar belangrijke instructies

| Instructie | Uitleg | Voorbeeld |
|---|---|---|
| **`ARG`** | Een variabele die **enkel tijdens het bouwen** bestaat. Instellen met `docker build --build-arg`. Niet zichtbaar in de draaiende container (gebruik `ENV` als je dat wel wil). Niet voor geheimen: de waarde blijft zichtbaar in de image-geschiedenis. | `ARG NODE_VERSION=22` <br> `FROM node:${NODE_VERSION}-alpine` |
| **`USER`** | Voert de volgende instructies en de container uit als een **andere gebruiker** dan root. Belangrijk voor security: een aanvaller in je container is dan geen root. | `USER node` |
| **`HEALTHCHECK`** | Een commando dat Docker regelmatig uitvoert om te controleren of de app **echt werkt**. De container krijgt de status `healthy` of `unhealthy` (zichtbaar in `docker ps`). | `HEALTHCHECK CMD wget -qO- http://localhost:3000/ \|\| exit 1` |
| **`VOLUME`** | Markeert een map als **plaats voor data** die buiten de container moet blijven bestaan. Docker maakt er automatisch een anoniem volume voor aan. Meestal regel je volumes liever bij het starten (`-v`, Compose). | `VOLUME /data` |
| **`LABEL`** | Voegt **metadata** toe aan de image: auteur, versie, repository. Op te vragen met `docker inspect`. | `LABEL org.opencontainers.image.source="https://github.com/jij/app"` |
| **`SHELL`** | Verandert de **shell** die `RUN`, `CMD` en `ENTRYPOINT` in shell-vorm gebruiken (standaard `/bin/sh -c`). Vooral voor Windows-containers (PowerShell) of om `bash` met strengere opties te gebruiken. | `SHELL ["/bin/bash", "-o", "pipefail", "-c"]` |
| **`STOPSIGNAL`** | Welk **signaal** `docker stop` naar je app stuurt (standaard `SIGTERM`). Nodig als een programma op een ander signaal netjes afsluit. | `STOPSIGNAL SIGQUIT` |
| **`ONBUILD`** | Een instructie die **pas uitgevoerd wordt in een image die op deze image verderbouwt** (`FROM jouw-basis`). Voor gedeelde basis-images in een team. | `ONBUILD COPY . /app` |
| **`COPY --from`** | Kopieert bestanden **uit een andere build-stage** of image. De kern van **multi-stage builds**: bouwen in een grote image, enkel het resultaat naar een kleine image. | `COPY --from=build /app/dist /usr/share/nginx/html` |
| **`FROM … AS naam`** | Geeft een **build-stage** een naam, zodat je er met `COPY --from=naam` naar kan verwijzen. | `FROM node:22 AS build` |

### Multi-stage in een notendop

```dockerfile
# Stage 1: bouwen (groot: compiler, devDependencies)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: enkel het resultaat (klein)
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

Meer in [Dockerfile Advanced – Multi-stage builds](Dockerfile-Advanced.md).

---

## Snel opzoeken: welke instructie heb ik nodig?

| Ik wil… | Instructie |
|---|---|
| beginnen van een bestaande image | `FROM` |
| bestanden in mijn image krijgen | `COPY` (archief uitpakken: `ADD`) |
| software installeren of mijn app compileren | `RUN` |
| instellen in welke map alles gebeurt | `WORKDIR` |
| bepalen wat er start bij `docker run` | `CMD` (vast programma: `ENTRYPOINT`) |
| aangeven op welke poort mijn app luistert | `EXPOSE` |
| configuratie meegeven aan mijn app | `ENV` (enkel tijdens build: `ARG`) |
| mijn app niet als root laten draaien | `USER` |
| laten controleren of mijn app gezond is | `HEALTHCHECK` |
| een kleine productie-image maken | multi-stage: `FROM … AS` + `COPY --from` |
