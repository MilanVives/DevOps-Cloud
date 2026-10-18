# 2 - Dockerfile: je eigen image bouwen

## Waar gaat deze les over?

In les 1 startte je containers van bestaande images, zoals `nginx`, en koppelde je je eigen bestanden met een volume:

```bash
docker run -d -p 8080:80 -v "$(pwd)/index.html:/usr/share/nginx/html/index.html" nginx
```

Dat werkt op **jouw** laptop, maar de website zit niet in de container: die staat in een map op je laptop.
Je kan dit niet zomaar naar een collega, een server of de cloud sturen.

De oplossing: een **eigen image** waarin je code zit. Die bouw je met een **Dockerfile**: een tekstbestand met
stap-voor-stap instructies. Iedereen met die Dockerfile bouwt exact dezelfde image, en de image zelf kan je delen via
Docker Hub.

```
Dockerfile ──docker build──► image ──docker run──► container
                               │
                               └──docker push──► Docker Hub ──docker pull──► andere machine
```

**Na deze les kan je:**
- een Dockerfile schrijven met de belangrijkste instructies;
- een image bouwen, starten en op Docker Hub zetten (ook voor Intel/AMD én Apple Silicon);
- uitleggen wat layers en de build cache zijn, en je Dockerfile daarop afstemmen;
- een `.dockerignore` gebruiken.

**Ook in dit hoofdstuk:**
- [Dockerfile cheatsheet](Dockerfile-Cheatsheet.md): alle instructies op één pagina, met uitleg;
- [Dockerfile Advanced](Dockerfile-Advanced.md): multi-stage builds, security, productie, CI/CD;
- [Dockerfile Multiplatform](Dockerfile-Multiplatform.md): builds voor ARM en x86 in detail.

---

## 1. Je eerste Dockerfile: een statische website

Maak een map met twee bestanden.

`index.html`:

```html
<!DOCTYPE html>
<html>
  <body>
    <h1>Hallo vanuit mijn eigen image!</h1>
  </body>
</html>
```

`Dockerfile` (exact deze naam, zonder extensie):

```dockerfile
# Start van de officiële nginx-image (een webserver)
FROM nginx:1.27-alpine

# Kopieer onze pagina naar de map waar nginx zijn website zoekt
COPY index.html /usr/share/nginx/html/index.html

# Documenteer dat de container op poort 80 luistert
EXPOSE 80
```

Bouwen en starten:

```bash
docker build -t mijn-website:1.0 .       # -t = naam:tag, de punt = "de Dockerfile staat hier"
docker run -d -p 8080:80 mijn-website:1.0
```

Open http://localhost:8080. Geen volume meer nodig: de pagina **zit in de image**.

> **Waarom geen CMD?** De nginx-image heeft er al één (`nginx -g "daemon off;"`). Je Dockerfile erft die over van
> `FROM`. Je schrijft enkel een eigen `CMD` als je iets anders wil starten.

Wijzig je `index.html`? Dan bouw je opnieuw (`docker build -t mijn-website:1.1 .`) en start je een nieuwe container.

---

## 2. De basisinstructies

Een Dockerfile is een lijst instructies die Docker **van boven naar beneden** uitvoert. Deze heb je bijna altijd nodig:

| Instructie | Wat ze doet | Voorbeeld |
|---|---|---|
| `FROM` | de basis-image waarop je verderbouwt; altijd de eerste instructie | `FROM node:22-alpine` |
| `WORKDIR` | de werkmap in de image; volgende instructies werken vanaf hier | `WORKDIR /app` |
| `COPY` | bestanden van je laptop naar de image kopiëren | `COPY . .` |
| `RUN` | een commando uitvoeren **tijdens het bouwen** (installeren, compileren) | `RUN npm install` |
| `ENV` | een environment variable instellen | `ENV PORT=3000` |
| `EXPOSE` | documenteren op welke poort de app luistert | `EXPOSE 3000` |
| `CMD` | het commando dat start **wanneer de container start** | `CMD ["node", "server.js"]` |

Twee verschillen die je moet kennen:

**`RUN` vs `CMD`**

| `RUN` | `CMD` |
|---|---|
| draait tijdens `docker build` | draait tijdens `docker run` |
| het resultaat wordt opgeslagen in de image | start je applicatie |
| mag vaak voorkomen | slechts één per Dockerfile (de laatste telt) |

**`EXPOSE` vs `-p`**: `EXPOSE 3000` is enkel documentatie. Om de poort echt bereikbaar te maken vanaf je laptop
heb je nog steeds `docker run -p 3000:3000` nodig.

> Alle instructies, ook de minder gebruikte (`ADD`, `ENTRYPOINT`, `ARG`, `USER`, …), staan met uitleg in de
> [cheatsheet](Dockerfile-Cheatsheet.md).

---

## 3. Een Node.js-applicatie

Een eenvoudige API met Express. `server.js`:

```javascript
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.json({ message: 'Hallo vanuit een container!' }));

app.listen(port, () => console.log(`API luistert op poort ${port}`));
```

`package.json` met `express` als dependency (maak het met `npm init -y && npm install express`).

`Dockerfile`:

```dockerfile
FROM node:22-alpine

WORKDIR /app

# 1. Eerst enkel de package-bestanden, en dependencies installeren
COPY package*.json ./
RUN npm ci --omit=dev

# 2. Dan pas de rest van de code
COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
```

```bash
docker build -t mijn-api:1.0 .
docker run -d -p 3000:3000 --name api mijn-api:1.0
curl localhost:3000
docker logs api
```

Waarom eerst `package*.json` en pas daarna de rest van de code? Dat zie je in de volgende sectie.

> **`npm ci` of `npm install`?** `npm ci` installeert exact de versies uit `package-lock.json`: reproduceerbaar.
> `--omit=dev` laat development-tools weg, zodat je image kleiner wordt.

---

## 4. Layers en de build cache

Elke instructie in je Dockerfile maakt een **layer**: een laag bovenop de vorige. Bouw je opnieuw, dan **hergebruikt**
Docker elke layer waarvan niets veranderd is (de *cache*). Verandert er iets, dan wordt die layer **en alles erna**
opnieuw gebouwd.

```
FROM node:22-alpine          ← cache
WORKDIR /app                 ← cache
COPY package*.json ./        ← cache (package.json niet gewijzigd)
RUN npm ci --omit=dev        ← cache  ✅ geen nieuwe npm install!
COPY . .                     ← opnieuw (server.js gewijzigd)
CMD ["node", "server.js"]    ← opnieuw
```

Met de **verkeerde volgorde** kopieer je eerst alle code: bij elke kleine codewijziging moet `npm install` opnieuw.

```dockerfile
# ❌ traag: elke codewijziging = opnieuw alle dependencies installeren
COPY . .
RUN npm install

# ✅ snel: dependencies enkel opnieuw als package.json wijzigt
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
```

**Vuistregel:** zet wat zelden verandert bovenaan, en wat vaak verandert (je code) onderaan.

Zelf bekijken: bouw twee keer na elkaar en kijk naar `CACHED` in de output, of bekijk de layers met
`docker history mijn-api:1.0`.

---

## 5. `.dockerignore`

Met `COPY . .` kopieer je **alles** uit de map naar de image, ook `node_modules`, `.git` en `.env` met je
wachtwoorden. Een `.dockerignore`-bestand (naast je Dockerfile) sluit bestanden uit, net als `.gitignore`:

```
node_modules
.git
.env
*.log
.DS_Store
```

Voordelen: een kleinere en snellere build, geen geheimen in je image, en `node_modules` van je laptop (misschien
voor een ander besturingssysteem) komt niet in de container.

---

## 6. Handige commando's

| Commando | Wat |
|---|---|
| `docker build -t naam:tag .` | image bouwen met de Dockerfile in de huidige map |
| `docker build -t naam:tag -f Dockerfile.dev .` | een Dockerfile met een andere naam gebruiken |
| `docker build --no-cache -t naam:tag .` | bouwen zonder cache |
| `docker images` | je lokale images |
| `docker run -d -p 8080:80 --name web naam:tag` | container starten (`-d` achtergrond, `-p` poort, `--name` naam) |
| `docker logs -f web` | logs bekijken |
| `docker exec -it web sh` | shell in een draaiende container: kijk wat er in je image zit |
| `docker history naam:tag` | de layers van een image |
| `docker rmi naam:tag` | image verwijderen |

---

## 7. Je image delen via Docker Hub

1. Maak een (gratis) account op https://hub.docker.com.
2. Geef je image een naam met je Docker Hub-gebruikersnaam ervoor, log in en push:

```bash
docker tag mijn-api:1.0 jouw-naam/mijn-api:1.0      # of meteen zo bouwen: docker build -t jouw-naam/mijn-api:1.0 .
docker login
docker push jouw-naam/mijn-api:1.0
```

Op elke andere machine:

```bash
docker run -d -p 3000:3000 jouw-naam/mijn-api:1.0   # Docker downloadt de image automatisch
```

### Let op: Apple Silicon vs Intel/AMD

Een image bevat programma's voor één **processorarchitectuur**. Bouw je op een Mac met Apple Silicon (M1–M4), dan is je
image **`arm64`**, en die draait **niet** op de meeste servers, cloud-VM's en de GitHub-runner die je PE controleert
(die zijn **`amd64`**). Bouw en push daarom voor beide in één keer:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t jouw-naam/mijn-api:1.0 --push .
```

Controleren welke architecturen je image heeft:

```bash
docker manifest inspect -v jouw-naam/mijn-api:1.0 | grep architecture
```

Meer hierover in [Dockerfile Multiplatform](Dockerfile-Multiplatform.md).

---

## 8. Checklist voor een goede Dockerfile

- [ ] Een **vaste versie** in `FROM` (`node:22-alpine`, niet `node` of `node:latest`)
- [ ] Een **slanke basis-image** waar het kan (`-alpine` of `-slim`)
- [ ] `WORKDIR` in plaats van `cd` in `RUN`
- [ ] **Eerst dependencies, dan code** (cache)
- [ ] Een **`.dockerignore`** (geen `node_modules`, `.git` of `.env` in je image)
- [ ] `CMD` in **exec-vorm**: `CMD ["node", "server.js"]`
- [ ] Geen wachtwoorden of tokens in de Dockerfile: die geef je mee bij het starten (`-e`, of `.env` in Compose)
- [ ] Gepusht voor **`linux/amd64`** (en `arm64` als je op een Mac werkt)

Controleer je Dockerfile automatisch met **hadolint** (dat doet de PE1-controle ook):

```bash
docker run --rm -i hadolint/hadolint < Dockerfile
```

---

## 9. Oefeningen

1. **Statische website.** Bouw de website uit sectie 1, start ze op poort 8080, wijzig de tekst, bouw versie `1.1` en
   start die op poort 8081. Draaien beide versies naast elkaar?
2. **Node.js API.** Bouw de API uit sectie 3. Wijzig daarna enkel `server.js` en bouw opnieuw: welke stappen zijn
   `CACHED`? Wissel de volgorde van `COPY . .` en `RUN npm ci` om en vergelijk.
3. **Kijk binnen.** `docker exec -it api sh` en `ls /app`: staat `node_modules` erin? Voeg een `.dockerignore` toe en
   controleer dat er geen `.git`-map in je image zit.
4. **Delen.** Push je API naar Docker Hub voor `linux/amd64` en `linux/arm64`. Laat een medestudent hem starten met
   enkel `docker run`.
5. **hadolint.** Laat hadolint los op je Dockerfiles en los de meldingen op.

**Volgende les:** meerdere containers samen laten werken met [Docker Compose](../03-Compose/3-compose.md).
