---
marp: true
theme: gaia
paginate: true
header: 'Les 8 – Traefik met Docker'
footer: 'DevOps & Cloud Infrastructure'
---

<!-- {% raw %} -->

<!-- _class: lead -->

# Traefik met Docker

Al je containers achter één reverse proxy, met automatisch HTTPS

Uitleg: [Traefik.md](Traefik.md) · Bestanden: [traefik-examples/](traefik-examples/)

---

## Agenda

<style scoped>section { font-size: 30px; }</style>

1. Het probleem: een reverse proxy
2. Traefik: de bouwstenen
3. Labels: hoe Traefik je containers vindt
4. De server klaarzetten: DNS, firewall, Docker
5. `traefik.yaml` en `compose.yaml`, regel per regel
6. Starten en HTTPS met Let's Encrypt
7. Het dashboard via een SSH-tunnel
8. Meer apps: load balancing en middlewares
9. Fouten zoeken

---

<!-- _class: lead -->

## 1. Het probleem

---

## Elke app een eigen poort?

![bg right:40% contain](images/8-traefik-zonder-met.png)

<style scoped>section { font-size: 28px; }</style>

Zonder reverse proxy:

- `http://203.0.113.10:3000`, `:8081`, `:9000`...
- geen HTTPS, geen domeinnaam
- elke poort open in de firewall

Met een **reverse proxy**:

- één ingang: poort **80 en 443**
- de proxy kiest de app op **hostnaam**
- HTTPS op één plaats geregeld

---

## Reverse proxy: wat doet hij?

<style scoped>table { font-size: 25px; }</style>

| Taak | Betekent |
|---|---|
| **Routeren** | `app1.domein.be` → container A, `app2.domein.be` → container B |
| **TLS-terminatie** | HTTPS stopt bij de proxy, de containers praten gewoon HTTP |
| **Load balancing** | 3 kopieën van een app? De proxy verdeelt de requests |
| **Middlewares** | headers toevoegen, login vragen, rate limiting, redirects |
| **Afschermen** | containers hebben geen `ports:`, enkel de proxy is publiek |

Bekende reverse proxies: **Nginx**, HAProxy, Caddy, Envoy, **Traefik**

---

## Waarom Traefik en niet Nginx?

<style scoped>section { font-size: 27px; }</style>

**Nginx**: per app een `server { ... }`-blok schrijven, certificaten zelf regelen (certbot), `nginx -s reload` na elke wijziging

**Traefik**: je zet **labels** op je container, Traefik

- ziet de container meteen verschijnen (via de Docker API)
- maakt zelf de route aan, **zonder herstart**
- vraagt zelf een **Let's Encrypt**-certificaat aan en vernieuwt het
- toont alles in een **dashboard**

De configuratie zit bij de app, niet in een centraal bestand

---

<!-- _class: lead -->

## 2. De bouwstenen

---

## Van request tot container

![w:1150](images/8-traefik-flow.png)

<style scoped>section { font-size: 26px; } table { font-size: 23px; }</style>

| Bouwsteen | Vraag die hij beantwoordt | Bij ons |
|---|---|---|
| **EntryPoint** | op welke poort komt het binnen? | `web` :80, `websecure` :443 |
| **Router** | is dit request voor mij? | `` Host(`whoami.jouwdomein.be`) `` |
| **Middleware** | moet er iets aan veranderen? | security headers |
| **Service** | naar welke container(s)? | 3 × whoami |

---

## Provider: waar haalt Traefik de routes?

<style scoped>section { font-size: 28px; }</style>

Twee soorten configuratie:

| | Wat | Waar |
|---|---|---|
| **Statisch** | entrypoints, certificaten, providers, dashboard | `traefik.yaml`, gelezen bij opstart |
| **Dynamisch** | routers, middlewares, services | **labels** op containers, live |

De **provider** levert de dynamische configuratie:
`docker` (labels), `kubernetes` (Ingress, zie vorige les), `file`, ...

Wijzig je `traefik.yaml`? → `docker compose restart traefik`
Wijzig je labels? → `docker compose up -d` van **die app**, Traefik volgt vanzelf

---

<!-- _class: lead -->

## 3. Labels

---

## Hoe Traefik je containers vindt

<style scoped>section { font-size: 26px; }</style>

![w:780](images/8-traefik-discovery.png)

Traefik heeft `/var/run/docker.sock` en krijgt zo **elke** start en stop van een container te zien

---

## Een label lezen

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.nginx.rule=Host(`test.jouwdomein.be`)"
  - "traefik.http.routers.nginx.entrypoints=websecure"
```

<style scoped>section { font-size: 27px; } pre { font-size: 0.8em; }</style>

`traefik` . `http` . `routers` . **`nginx`** . `rule`
↳ een HTTP-**router** met de zelfgekozen naam **nginx**, en zijn **regel**

- `enable=true`: nodig, want `exposedByDefault: false`
- `rule`: let op de **backticks** rond de hostnaam
- `entrypoints=websecure`: enkel op 443
- routernaam: vrij te kiezen, maar **uniek op de server**

---

## Regels: meer dan `Host()`

<style scoped>section { font-size: 26px; } pre { font-size: 0.78em; }</style>

```yaml
# één hostnaam
rule=Host(`shop.jouwdomein.be`)
# twee hostnamen
rule=Host(`jouwdomein.be`) || Host(`www.jouwdomein.be`)
# hostnaam + pad: frontend en API op hetzelfde domein
rule=Host(`shop.jouwdomein.be`) && PathPrefix(`/api`)
```

Matchen meerdere routers? De **langste regel wint**
(`/api` gaat voor op `/`), of zet zelf `priority=10`

Service-poort: Traefik neemt de poort uit `EXPOSE` van het image. Meerdere of geen?

```yaml
- "traefik.http.services.mijnapp.loadbalancer.server.port=3000"
```

---

<!-- _class: lead -->

## 4. De server klaarzetten

---

## Wat je nodig hebt

<style scoped>section { font-size: 27px; }</style>

Linux-server met **publiek IP** · een **domeinnaam** · **Docker**
Firewall: **22, 80, 443** open. Poort **8080** (dashboard) blijft **dicht**

![w:1150](images/8-traefik-server.png)

---

## DNS: naam → IP

![w:900](images/8-traefik-dns.png)

<style scoped>section { font-size: 26px; } pre { font-size: 0.8em; }</style>

Per app een **A-record** naar je server, of één wildcard `*.jouwdomein.be`

```bash
dig +short test.jouwdomein.be       # 203.0.113.10? Dan pas verder
```

---

## Firewall en Docker

<style scoped>section { font-size: 27px; } pre { font-size: 0.8em; }</style>

```bash
sudo ufw allow 22,80,443/tcp && sudo ufw enable
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER           # opnieuw inloggen
```

**Valkuil:** `ufw` beschermt **geen** poorten die Docker publiceert.
Docker zet zijn eigen iptables-regels, vóór die van ufw.

```yaml
ports:
  - "8080:8080"             # publiek op het internet, ufw of niet!
  - "127.0.0.1:8080:8080"   # enkel bereikbaar vanop de server zelf
```

---

## Bestanden naar de server

<style scoped>section { font-size: 27px; } pre { font-size: 0.78em; }</style>

```
traefik-examples/
├── traefik/
│   ├── compose.yaml     Traefik + nginx-testsite
│   ├── traefik.yaml     configuratie van Traefik zelf
│   └── html/index.html
└── whoami/
    └── compose.yaml     tweede app
```

```bash
scp -r traefik-examples gebruiker@203.0.113.10:~/
```

Aanpassen: alles met `# <-- WIJZIG` (e-mail en hostnamen)

```bash
grep -rn WIJZIG ~/traefik-examples
```

---

<!-- _class: lead -->

## 5. De configuratie, regel per regel

---

## `traefik.yaml` (1/2): entrypoints

<style scoped>pre { font-size: 0.68em; } section { font-size: 25px; }</style>

```yaml
api:
  dashboard: true
  insecure: true          # dashboard zonder login op :8080 (enkel via tunnel!)

entryPoints:
  web:
    address: ":80"
    http:
      redirections:       # alles van http → https
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"
    http:
      tls:
        certResolver: letsencrypt   # elke router op 443 krijgt een certificaat
```

Door de `certResolver` op het entrypoint heeft een app **geen** TLS-labels nodig

---

## `traefik.yaml` (2/2): certificaten en provider

<style scoped>pre { font-size: 0.66em; } section { font-size: 25px; }</style>

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: jouw.naam@student.vives.be     # <-- WIJZIG
      storage: /letsencrypt/acme.json       # Traefik maakt het bestand zelf
      httpChallenge:
        entryPoint: web                     # bewijs via poort 80
  letsencrypt-staging:                      # testcertificaten, geen rate limits
    acme: { ... caServer: https://acme-staging-v02.api.letsencrypt.org/directory }

providers:
  docker:
    exposedByDefault: false   # enkel containers met traefik.enable=true
    network: traefik          # via dit netwerk bereikt Traefik de containers

log:
  level: INFO
accessLog: {}                 # één regel per request in docker logs
```

---

## `compose.yaml`: Traefik

<style scoped>pre { font-size: 0.7em; } section { font-size: 25px; }</style>

```yaml
services:
  traefik:
    image: traefik:v3.7                 # vaste versie, niet :latest
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "127.0.0.1:8080:8080"           # dashboard: enkel localhost
    volumes:
      - ./traefik.yaml:/etc/traefik/traefik.yaml:ro
      - ./letsencrypt:/letsencrypt      # certificaten overleven een herstart
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - traefik
```

Oude versies (v2.10) praten niet met Docker 29: `Error response from daemon`

---

## `compose.yaml`: de testsite

<style scoped>pre { font-size: 0.72em; } section { font-size: 26px; }</style>

```yaml
  nginx:
    image: nginx:alpine
    container_name: nginx-test
    volumes:
      - ./html:/usr/share/nginx/html:ro
    # geen ports: !
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.nginx.rule=Host(`test.jouwdomein.be`)"  # <-- WIJZIG
      - "traefik.http.routers.nginx.entrypoints=websecure"
    networks:
      - traefik

networks:
  traefik:
    external: true      # één gedeeld netwerk voor Traefik en al je apps
```

---

<!-- _class: lead -->

## 6. Starten en HTTPS

---

## Starten

<style scoped>section { font-size: 28px; }</style>

```bash
docker network create traefik          # één keer per server
cd ~/traefik-examples/traefik
docker compose up -d
docker compose logs -f traefik
```

Surf naar `https://test.jouwdomein.be`

![w:1000](images/8-traefik-tls.png)

Klik op het slotje: uitgegeven door **Let's Encrypt**

---

## Let's Encrypt: de HTTP-challenge

![w:1000](images/8-traefik-acme.png)

Daarom: DNS moet kloppen **en** poort 80 moet open staan

---

## Productie of staging?

<style scoped>section { font-size: 27px; } table { font-size: 24px; }</style>

| | `letsencrypt` | `letsencrypt-staging` |
|---|---|---|
| Browser vertrouwt het | ja | nee (waarschuwing) |
| Rate limits | 5 mislukte pogingen/uur per hostnaam, 50 certificaten/week per domein | ruim |
| Gebruik | standaard | als je blijft proberen en het mislukt |

Wisselen: in `traefik.yaml` bij `websecure` de `certResolver` aanpassen,
dan `docker compose restart traefik`

Certificaat 90 dagen geldig, Traefik **vernieuwt automatisch**

---

<!-- _class: lead -->

## 7. Het dashboard via een SSH-tunnel

---

## Het dashboard

![bg right:62% contain](images/8-traefik-dashboard.png)

<style scoped>section { font-size: 27px; }</style>

- alle routers, services, middlewares
- groen = OK, rood = fout
- schildje = TLS

**Zonder login.** Daarom nooit publiek:
het luistert enkel op `127.0.0.1:8080` van de server

---

## SSH LocalForward

![w:760](images/8-traefik-ssh.png)

<style scoped>pre { font-size: 0.8em; }</style>

```bash
ssh -L 8080:localhost:8080 gebruiker@203.0.113.10
```

Venster open laten → op je laptop: <http://localhost:8080/dashboard/>

---

## `-L 8080:localhost:8080` ontleed

<style scoped>section { font-size: 27px; } pre { font-size: 0.8em; }</style>

`-L` **8080** : **localhost** : **8080**
↳ poort op **je laptop** : vanuit de **server** gezien : poort **op de server**

Elke keer typen? `~/.ssh/config` op je laptop:

```
Host traefik
    HostName 203.0.113.10
    User gebruiker
    LocalForward 8080 localhost:8080
```

```bash
ssh traefik        # shell + tunnel
ssh -N traefik     # enkel de tunnel
```

Poort 8080 al in gebruik op je laptop? `LocalForward 9090 localhost:8080`

---

## Routers in het dashboard

<style scoped>section { font-size: 25px; }</style>

![h:390](images/8-traefik-dashboard-routers.png)

`@docker` = uit labels · `@internal` = door Traefik zelf (dashboard, redirect, ACME)

---

<!-- _class: lead -->

## 8. Meer apps

---

## Een tweede app, in een eigen project

<style scoped>pre { font-size: 0.66em; } section { font-size: 24px; }</style>

```yaml
services:
  whoami:
    image: traefik/whoami:v1.11
    deploy:
      replicas: 3                           # 3 containers
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.whoami.rule=Host(`whoami.jouwdomein.be`)"
      - "traefik.http.routers.whoami.entrypoints=websecure"
      - "traefik.http.middlewares.secure-headers.headers.stsSeconds=31536000"
      - "traefik.http.middlewares.secure-headers.headers.contentTypeNosniff=true"
      - "traefik.http.middlewares.secure-headers.headers.frameDeny=true"
      - "traefik.http.routers.whoami.middlewares=secure-headers"
    networks: [traefik]
networks:
  traefik:
    external: true
```

`cd ~/traefik-examples/whoami && docker compose up -d`: Traefik **niet** herstarten

---

## Load balancing: gratis

<style scoped>section { font-size: 27px; } pre { font-size: 0.78em; }</style>

Ververs `https://whoami.jouwdomein.be`:

```
Hostname: 48b0270ed6f1
Hostname: ee83ebe69343
Hostname: 5fac2310129c
```

3 containers met dezelfde labels → **één service met 3 servers**, round-robin

```bash
docker compose up -d --scale whoami=5      # live, zonder Traefik aan te raken
```

---

## Middlewares

<style scoped>section { font-size: 25px; } pre { font-size: 0.72em; }</style>

Definiëren (`middlewares.<naam>.<type>...`) en koppelen (`routers.<router>.middlewares=<naam>`)

```bash
docker run --rm httpd:2.4-alpine htpasswd -nbB admin geheim | sed 's/\$/$$/g'
```

```yaml
# Login: plak de uitvoer van hierboven ($ verdubbeld tot $$ voor compose)
- "traefik.http.middlewares.login.basicauth.users=admin:$$2y$$05$$..."
# Max 10 requests/s gemiddeld per IP
- "traefik.http.middlewares.rl.ratelimit.average=10"
# Enkel vanaf bepaalde IP-adressen
- "traefik.http.middlewares.allow.ipallowlist.sourcerange=203.0.113.0/24"
# /api wegknippen voor de backend het ziet
- "traefik.http.middlewares.strip.stripprefix.prefixes=/api"

# Meerdere, in volgorde
- "traefik.http.routers.mijnapp.middlewares=allow,login"
```

---

## Netwerken: de database blijft binnen

![bg right:45% contain](images/8-traefik-networks.png)

<style scoped>section { font-size: 26px; } pre { font-size: 0.72em; }</style>

```yaml
services:
  api:
    networks: [traefik, backend]
  db:
    networks: [backend]   # geen labels
networks:
  traefik:
    external: true
  backend:
    internal: true
```

Traefik zit **niet** op `backend`
→ de database is onbereikbaar van buiten

---

<!-- _class: lead -->

## 9. Fouten zoeken

---

## Eerst kijken, dan gissen

<style scoped>section { font-size: 28px; } pre { font-size: 0.8em; }</style>

```bash
docker ps                                   # draait alles?
docker logs traefik 2>&1 | grep -E "ERR|acme"
docker inspect nginx-test --format '{{json .Config.Labels}}'
docker network inspect traefik              # zit de container erop?
curl -I https://test.jouwdomein.be
```

En het **dashboard**: staat je router er? Groen?

Waarschuwingen (`WRN`) over *encoded characters* en *aliasHeadersStrategy* bij het opstarten mag je negeren

---

## Symptoom → oorzaak

<style scoped>table { font-size: 21px; }</style>

| Symptoom | Oorzaak |
|---|---|
| `404 page not found` | geen router: `traefik.enable`? netwerk `traefik`? typfout in `Host()`? |
| `Bad Gateway` | router OK, container onbereikbaar: verkeerde poort → `loadbalancer.server.port` |
| `TRAEFIK DEFAULT CERT` in de browser | geen Let's Encrypt-certificaat (nog niet, of mislukt): kijk in de logs |
| `NXDOMAIN looking up A` | DNS-record ontbreekt |
| `Invalid response ... 404` / `Timeout during connect` | DNS wijst naar een ander IP of poort 80 is dicht |
| `rateLimited` / `too many certificates` | te vaak geprobeerd: tijdelijk `letsencrypt-staging` |
| `Error response from daemon` (docker provider) | Traefik te oud voor Docker 29: `traefik:v3.7` |
| `network traefik ... could not be found` | `docker network create traefik` |
| dashboard: `connection refused` | SSH-tunnel niet open |

---

## Traefik en Kubernetes

<style scoped>section { font-size: 27px; } table { font-size: 24px; }</style>

Hetzelfde programma, andere **provider**:

| | Docker | Kubernetes |
|---|---|---|
| Routes uit | labels op containers | Ingress-objecten |
| Installeren | `compose.yaml` | `helm install traefik` |
| Certificaten | Traefik zelf (ACME) | meestal cert-manager |
| Netwerk | `traefik`-netwerk | Services (ClusterIP) |

Router, service, middleware, entrypoint: **dezelfde begrippen**

---

## Samenvatting

<style scoped>section { font-size: 28px; }</style>

- Eén reverse proxy op **80/443**, apps zonder `ports:`
- Statisch in `traefik.yaml`, dynamisch via **labels**
- 3 labels per app: `enable`, `rule`, `entrypoints`
- HTTPS **automatisch** via `certResolver` op `websecure`
- Dashboard op `127.0.0.1:8080` + `ssh -L 8080:localhost:8080`
- Gedeeld netwerk `traefik`, database op een `internal` netwerk
- Stappenplan: [traefik-examples/README.md](traefik-examples/README.md)

<!-- {% endraw %} -->
