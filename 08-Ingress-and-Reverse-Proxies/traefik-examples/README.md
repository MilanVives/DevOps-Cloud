# Traefik op een server: kopiëren, aanpassen, starten

Getest met Traefik v3.7 en Docker 29. Uitleg: [Traefik.md](../Traefik.md) · Slides: [traefik-slides.md](../traefik-slides.md)

```
traefik-examples/
├── traefik/
│   ├── compose.yaml     Traefik + nginx-testsite
│   ├── traefik.yaml     configuratie van Traefik zelf
│   └── html/index.html  testpagina
└── whoami/
    └── compose.yaml     tweede app: 3 replica's + middleware
```

Wat je nodig hebt:

- een Linux-server met een **publiek IP** (Ubuntu, Debian, ...)
- een **domeinnaam** waarvan je de DNS kunt aanpassen
- firewall open voor **22, 80 en 443**. Niet voor 8080: het dashboard bereik je via een SSH-tunnel

## 1. DNS

Maak bij je DNS-provider een **A-record** per app, naar het IP van je server:

| Naam | Type | Waarde |
|---|---|---|
| `test.jouwdomein.be` | A | `203.0.113.10` |
| `whoami.jouwdomein.be` | A | `203.0.113.10` |

Of één wildcard: `*.jouwdomein.be → 203.0.113.10`. Controleer vanaf je laptop:

```bash
dig +short test.jouwdomein.be      # moet het IP van je server tonen
```

## 2. Firewall

Bij je cloudprovider (security group / firewall rules): inkomend **22, 80, 443** toelaten. Met `ufw` op de server:

```bash
sudo ufw allow 22,80,443/tcp
sudo ufw enable
```

> Poort 8080 open je **niet**. Opgelet: `ufw` beschermt geen poorten die Docker publiceert.
> Docker zet zijn eigen iptables-regels, dus `ports: - "8080:8080"` zou publiek staan, firewall of niet.
> Daarom staat in compose.yaml `127.0.0.1:8080:8080`.

## 3. Docker installeren

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER      # daarna uit- en opnieuw inloggen
docker version
```

## 4. Bestanden naar de server

Vanaf je laptop, in de map `08-Ingress-and-Reverse-Proxies`:

```bash
scp -r traefik-examples gebruiker@203.0.113.10:~/
```

## 5. Waarden aanpassen

Alles wat je moet aanpassen staat bij `# <-- WIJZIG`:

| Bestand | Wat |
|---|---|
| `traefik/traefik.yaml` | je e-mailadres (2x) |
| `traefik/compose.yaml` | `test.jouwdomein.be` |
| `whoami/compose.yaml` | `whoami.jouwdomein.be` |

Met `nano`, of in één keer met `sed` op de server:

```bash
cd ~/traefik-examples
sed -i 's/jouwdomein\.be/mijndomein.be/g' traefik/compose.yaml whoami/compose.yaml
sed -i 's/jouw\.naam@student\.vives\.be/voornaam.naam@student.vives.be/g' traefik/traefik.yaml
grep -rn "WIJZIG" .                # controleer
```

## 6. Starten

```bash
docker network create traefik      # één keer
cd ~/traefik-examples/traefik
docker compose up -d
docker compose logs -f traefik     # Ctrl+C om te stoppen met kijken
```

Surf naar `https://test.jouwdomein.be`: groen slotje, "Traefik werkt!".
Het eerste certificaat duurt een paar seconden.

## 7. Dashboard via een SSH-tunnel

Op je **laptop**:

```bash
ssh -L 8080:localhost:8080 gebruiker@203.0.113.10
```

Laat dat venster open en surf op je laptop naar <http://localhost:8080/dashboard/>.

Wat er gebeurt: poort 8080 op je laptop gaat door de (versleutelde) SSH-verbinding naar `localhost:8080` **op de server**, waar Traefik het dashboard toont.

Niet elke keer typen? In `~/.ssh/config` op je laptop:

```
Host traefik
    HostName 203.0.113.10
    User gebruiker
    LocalForward 8080 localhost:8080
```

Daarna volstaat `ssh traefik`. Zonder shell, enkel de tunnel: `ssh -N traefik`.

## 8. Een tweede app: whoami

```bash
cd ~/traefik-examples/whoami
docker compose up -d
```

Ververs `https://whoami.jouwdomein.be` een paar keer: `Hostname` wisselt tussen 3 containers. Dat is load balancing, zonder extra configuratie.
In het dashboard zie je de router `whoami@docker`, de service met 3 servers en de middleware `secure-headers`.

## 9. Je eigen app achter Traefik

In de `compose.yaml` van je eigen project:

```yaml
services:
  mijnapp:
    image: mijnimage
    # geen ports: nodig
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mijnapp.rule=Host(`mijnapp.jouwdomein.be`)"
      - "traefik.http.routers.mijnapp.entrypoints=websecure"
      # enkel nodig als de container niet op poort 80 luistert of meerdere poorten heeft:
      - "traefik.http.services.mijnapp.loadbalancer.server.port=3000"
    networks:
      - traefik

networks:
  traefik:
    external: true
```

De naam na `routers.` (hier `mijnapp`) kies je zelf, maar hij moet **uniek** zijn op de server.

## Problemen?

| Symptoom | Oorzaak | Oplossing |
|---|---|---|
| `404 page not found` | Traefik kent geen router voor die hostnaam | label `traefik.enable=true`? container op netwerk `traefik`? typfout in `Host()`? Kijk in het dashboard |
| `Bad Gateway` | Traefik vindt de router, maar bereikt de container niet | verkeerde poort: voeg `loadbalancer.server.port` toe |
| Browser: "certificaat niet veilig", `TRAEFIK DEFAULT CERT` | Let's Encrypt gaf (nog) geen certificaat | `docker logs traefik 2>&1 \| grep -i acme` |
| log: `NXDOMAIN looking up A` | geen DNS-record | stap 1 |
| log: `Invalid response ... 404` of `Timeout during connect` | DNS wijst naar een ander IP, of poort 80 is dicht | `dig`, firewall stap 2 |
| log: `too many certificates` / `rateLimited` | te vaak opnieuw geprobeerd | tijdelijk `letsencrypt-staging` in traefik.yaml |
| log: `Error response from daemon` (docker provider) | oude Traefik-versie, Docker-API te nieuw | `image: traefik:v3.7` |
| `network traefik declared as external, but could not be found` | netwerk niet aangemaakt | `docker network create traefik` |
| dashboard: `connection refused` | tunnel niet open, of Traefik draait niet | `ssh -L ...` open laten, `docker ps` |

Waarschuwingen (`WRN`) over *encoded characters* en *aliasHeadersStrategy* bij het opstarten mag je negeren.

Opnieuw beginnen (certificaten blijven bewaard in `traefik/letsencrypt/`):

```bash
cd ~/traefik-examples/whoami  && docker compose down
cd ~/traefik-examples/traefik && docker compose down && docker compose up -d
```
