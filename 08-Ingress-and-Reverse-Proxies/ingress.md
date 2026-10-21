# 8 - Ingress: al je apps bereikbaar via één ingang

## Waar gaat deze les over?

Je PetShelter-app draait in Kubernetes. Om ze vanuit je browser te openen, gebruikte je tot nu toe een
**NodePort** (`http://<minikube-ip>:32500`) of `kubectl port-forward`. Dat is prima om te testen, maar zo werkt geen
echte website:

- niemand typt een poortnummer zoals `:32500` in de adresbalk;
- elke app krijgt een eigen poort, dus 10 apps = 10 poorten om te onthouden en open te zetten;
- er is geen HTTPS en geen domeinnaam.

Een echte website is bereikbaar op **poort 80 (HTTP) en 443 (HTTPS)**, met een **domeinnaam**, en vaak draaien er
meerdere apps achter hetzelfde adres (`/` is de website, `/api` de backend). Dat regel je in Kubernetes met een
**Ingress**.

**Na deze les kan je:**
- uitleggen wat een Ingress en een Ingress controller zijn, en waarom je ze allebei nodig hebt;
- Traefik installeren als Ingress controller op Minikube;
- verkeer routeren op **pad** (`/api`) en op **hostnaam** (`api.mijnsite.be`);
- HTTPS instellen, lokaal met een eigen certificaat en in de cloud met Let's Encrypt;
- de meest voorkomende Ingress-fouten zelf oplossen.

**Ook in dit hoofdstuk:**
- [Ingress Advanced](ingress-advanced.md): hoe een controller intern werkt, cert-manager in detail, Traefik-middlewares
  (login, rate limiting), Gateway API, productie-checklist;
- [Traefik](Traefik.md) en [Nginx](Nginx.md): dezelfde ideeën (reverse proxy) **buiten** Kubernetes, met Docker Compose.

Alle YAML-bestanden van deze les staan in [ingress-examples/](ingress-examples/). Voer de commando's uit in de map
`08-Ingress-and-Reverse-Proxies` van de cursusrepository (`git clone https://github.com/MilanVives/DevOps-Cloud.git`).

---

## 1. Het idee: het onthaal van een gebouw

Denk aan een groot kantoorgebouw met veel bedrijven. Er is **één ingang**. Aan het onthaal hangt een **lijst**: "Firma A:
3de verdieping, firma B: 5de verdieping". De **onthaalmedewerker** kijkt naar wie je zoekt en stuurt je naar de juiste
plek.

| In het gebouw | In Kubernetes |
|---|---|
| de ene ingang | één IP-adres op poort 80/443 |
| de lijst aan het onthaal | de **Ingress**: een YAML-bestand met regels ("`/api` → backend") |
| de onthaalmedewerker die de lijst toepast | de **Ingress controller**: een programma (bij ons **Traefik**) dat de regels uitvoert |
| de kantoren | je **Services** (en daarachter je pods) |

Het belangrijkste om te onthouden:

> **Een Ingress zonder Ingress controller doet niets.** Het is een lijst zonder onthaalmedewerker. Kubernetes heeft
> standaard **geen** controller: die installeer je zelf.

![Ingress (regels) en Ingress controller (de routing)](../images/ingress/kubernetes-ingress-without-controller.png)

### Zo loopt een request

```
browser: http://petshelter.localhost/api/pets
   │
   ▼
Ingress controller (Traefik)  ← leest alle Ingress-regels in de cluster
   │   regel: host petshelter.localhost, pad /api  →  Service backend-service:5000
   ▼
Service backend-service       ← verdeelt over de pods
   │
   ▼
pod backend (een van de replicas)
```

### Vergelijking met de Service-types die je al kent

| | Wat | Van buiten bereikbaar? | Typisch gebruik |
|---|---|---|---|
| `ClusterIP` | intern IP-adres in de cluster | nee | database, backend, alles achter een Ingress |
| `NodePort` | een poort 30000–32767 op elke node | ja, op een rare poort | snel testen |
| `LoadBalancer` | een extern IP-adres van de cloudprovider | ja | **één keer**: voor de Ingress controller |
| **Ingress** | regels op poort 80/443, op host en pad | ja | **al je webapps** achter één IP-adres |

In de cloud kost elk `LoadBalancer`-IP geld. Met een Ingress heb je er maar **één** nodig (voor Traefik), en zet je
daar al je apps achter. Je apps zelf blijven gewone `ClusterIP`-Services.

---

## 2. Traefik installeren op Minikube

We gebruiken **Traefik** als Ingress controller: dezelfde als in de Final, en je installeert hem met Helm
([les 7](../07-Helm/helm.md)).

```bash
minikube start

helm repo add traefik https://traefik.github.io/charts
helm repo update
helm install traefik traefik/traefik -n traefik --create-namespace
```

Controleren:

```bash
kubectl get pods -n traefik         # traefik-xxxx   1/1   Running
kubectl get ingressclass            # traefik   traefik.io/ingress-controller
kubectl get svc -n traefik          # traefik   LoadBalancer   ...   EXTERNAL-IP <pending>
```

De **IngressClass** `traefik` is de naam waarmee je in je Ingress zegt: "deze regels zijn voor Traefik".

### `EXTERNAL-IP <pending>`: `minikube tunnel`

Traefik vraagt een `LoadBalancer`-Service aan. In de cloud krijg je daar een publiek IP-adres voor. Minikube heeft dat
niet, en daarom blijft het `<pending>`. Los dat op met een tunnel, in een **apart terminalvenster** dat je open laat:

```bash
minikube tunnel        # vraagt je wachtwoord: poort 80 en 443 openen vereist admin-rechten
```

```bash
kubectl get svc -n traefik          # EXTERNAL-IP 127.0.0.1
```

Traefik luistert nu op `http://localhost` (poort 80) en `https://localhost` (poort 443).

> **Werkt de tunnel niet?** Dan kan het altijd zo, zonder admin-rechten:
> `kubectl port-forward -n traefik svc/traefik 8080:80 8443:443`. Gebruik dan in de rest van de les
> `http://...:8080` en `https://...:8443`.
>
> **Linux:** zie je bij `EXTERNAL-IP` een ander adres dan `127.0.0.1`, gebruik dan dat adres in plaats van
> `localhost`, en zet hostnamen in `/etc/hosts` (zie sectie 5).

> **Wat met `minikube addons enable ingress`?** Die installeert de controller **ingress-nginx** in plaats van Traefik.
> Die werkt ook, maar het project wordt sinds maart 2026 niet meer onderhouden. Kies je hem toch, gebruik dan
> `ingressClassName: nginx` in je Ingress.

---

## 3. De app deployen

We gebruiken de PetShelter-app uit [les 6](../06-Kubernetes/6c-minikube-demo/) en een tweede, piepkleine app
**whoami** die antwoordt met de naam van de pod die je request beantwoordt.

```bash
kubectl apply -f ../06-Kubernetes/6c-minikube-demo/k8s/
kubectl apply -f ingress-examples/whoami.yaml
kubectl get pods                    # wacht tot alles Running is
kubectl get svc                     # frontend-service:3000, backend-service:5000, whoami:80
```

Noteer de **namen en poorten van de Services**: die heb je nodig in je Ingress.

---

## 4. Je eerste Ingress

[`ingress-examples/01-basic.yaml`](ingress-examples/01-basic.yaml): stuur al het verkeer naar de frontend.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: petshelter
spec:
  ingressClassName: traefik
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 3000
```

| Regel | Betekenis |
|---|---|
| `kind: Ingress` | een lijst routingregels |
| `ingressClassName: traefik` | welke controller deze regels uitvoert |
| `rules:` | de lijst regels; hier één regel zonder `host`, dus voor **elke** hostnaam |
| `path: /` + `pathType: Prefix` | alle paden die beginnen met `/`, dus alles |
| `backend.service.name` / `port.number` | naar welke **Service** en welke **Service-poort** (niet de NodePort!) |

```bash
kubectl apply -f ingress-examples/01-basic.yaml
kubectl get ingress
curl http://localhost/                # HTML van de PetShelter-frontend
```

Open http://localhost in je browser: daar is je app, zonder poortnummer.

> `kubectl get ingress` toont `ADDRESS` soms leeg op Minikube. Dat is normaal en geen fout: kijk naar
> `EXTERNAL-IP` van de Traefik-Service.

---

## 5. Routeren op pad en op hostnaam

### Op pad

[`ingress-examples/02-paths.yaml`](ingress-examples/02-paths.yaml): drie paden, drie Services.

```yaml
  rules:
    - http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 5000
          - path: /whoami
            pathType: Prefix
            backend:
              service:
                name: whoami
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 3000
```

```bash
kubectl apply -f ingress-examples/02-paths.yaml     # vervangt de vorige Ingress (zelfde naam)
curl http://localhost/api/pets                      # JSON, rechtstreeks van de backend
curl http://localhost/whoami                        # antwoord van whoami
curl http://localhost/                              # de frontend
```

- **Het langste pad wint.** `/api/pets` past bij `/api` én bij `/`; `/api` is langer, dus de backend krijgt de
  request. De volgorde in het bestand maakt niet uit.
- **Het pad wordt doorgegeven zoals het is.** De backend krijgt `/api/pets`, niet `/pets`. Dat werkt hier omdat de
  backend zelf luistert op `/api/pets`.

| `pathType` | `path: /api` past bij |
|---|---|
| `Prefix` | `/api`, `/api/`, `/api/pets`, maar **niet** `/apix` |
| `Exact` | enkel `/api` |

Gebruik `Prefix`, tenzij je bewust één exacte URL wil.

### Load balancing zien

whoami draait met 3 replicas. Voer dit een paar keer uit en kijk naar `Hostname`:

```bash
for i in 1 2 3 4 5 6; do curl -s http://localhost/whoami | grep Hostname; done
```

Je ziet verschillende podnamen: de controller verdeelt de requests over alle pods. Dit is ook hoe de
`/nodeinfo`-controle van de [Final](../00-Assessment/Devops/3-Final-Assessment.md) werkt: die vraagt herhaaldelijk
een pagina op en verwacht antwoorden van **3 verschillende nodes**.

### Op hostnaam

Meerdere websites achter hetzelfde IP-adres, elk met een eigen naam.
[`ingress-examples/03-hosts.yaml`](ingress-examples/03-hosts.yaml):

```yaml
  rules:
    - host: petshelter.localhost
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 3000
    - host: whoami.localhost
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: whoami
                port:
                  number: 80
```

```bash
kubectl apply -f ingress-examples/03-hosts.yaml
curl http://petshelter.localhost/      # de frontend
curl http://whoami.localhost/          # whoami
curl http://localhost/                 # 404 page not found: geen enkele regel past bij "localhost"
```

**Hoe weet Traefik welke site je wil?** Elke HTTP-request bevat een header `Host:` met de naam uit de adresbalk.
Beide namen wijzen naar hetzelfde IP-adres; Traefik kijkt naar die header.

**Waarom `.localhost`?** Namen die eindigen op `.localhost` wijzen in je browser en in `curl` automatisch naar
`127.0.0.1`, zonder DNS of `/etc/hosts`. Handig om lokaal te testen. Met een andere naam (bv. op Linux, of
`petshelter.local`) zet je zelf een regel in `/etc/hosts` (Windows: `C:\Windows\System32\drivers\etc\hosts`):

```
127.0.0.1  petshelter.local
```

Of test zonder iets in te stellen door de `Host`-header zelf mee te sturen:

```bash
curl -H "Host: whoami.localhost" http://127.0.0.1/
```

**Op pad of op host?** Allebei kan, ook samen in één regel (`host` + meerdere `paths`). Een typische opzet:
`mijnsite.be` met `/` naar de frontend en `/api` naar de backend.

---

## 6. HTTPS

De Ingress controller doet de HTTPS voor al je apps: de **controller** heeft het certificaat en ontsleutelt het
verkeer, en je pods spreken gewoon HTTP. Dat heet **TLS-termination**. Je app hoeft niets van certificaten te weten.

Het certificaat steek je in een **Secret** van het type `tls`, en in de Ingress verwijs je ernaar.

### Lokaal: een eigen (self-signed) certificaat

```bash
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout tls.key -out tls.crt \
  -subj "/CN=petshelter.localhost" -addext "subjectAltName=DNS:petshelter.localhost"

kubectl create secret tls petshelter-tls --cert=tls.crt --key=tls.key
```

[`ingress-examples/04-tls.yaml`](ingress-examples/04-tls.yaml): enkel het `tls`-blok is nieuw.

```yaml
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        - petshelter.localhost
      secretName: petshelter-tls
  rules:
    - host: petshelter.localhost
      ...
```

```bash
kubectl apply -f ingress-examples/04-tls.yaml
curl -k https://petshelter.localhost/                 # -k: accepteer een certificaat dat niemand ondertekend heeft
curl --cacert tls.crt https://petshelter.localhost/   # of: vertrouw expliciet jouw certificaat
```

Je browser toont een waarschuwing ("niet veilig"): logisch, want je hebt het certificaat zelf gemaakt. Voor een echte
website heb je een certificaat nodig dat de browser vertrouwt.

> Zet `tls.key` nooit in git: dat is de geheime sleutel van je certificaat.

### In de cloud: gratis certificaten met Let's Encrypt

In de Final heb je een echte cluster en een echte domeinnaam. Dan vraag je automatisch een gratis, vertrouwd
certificaat aan bij **Let's Encrypt**, met **cert-manager**. Het principe:

1. Je domeinnaam (DNS A-record) wijst naar het `EXTERNAL-IP` van Traefik.
2. cert-manager vraagt een certificaat aan. Let's Encrypt controleert of je het domein echt beheert, door een
   testbestand op te vragen via `http://jouwdomein/.well-known/acme-challenge/...` (de *HTTP-01 challenge*).
3. cert-manager steekt het certificaat in de Secret die in je Ingress staat, en vernieuwt het automatisch voor het
   vervalt (na 90 dagen).

```bash
# 1. cert-manager installeren (eenmalig per cluster)
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --set crds.enabled=true

# 2. Een ClusterIssuer: "vraag certificaten aan bij Let's Encrypt, via Traefik"
kubectl apply -f ingress-examples/cluster-issuer.yaml
kubectl get clusterissuer           # letsencrypt   READY True
```

Daarna zet je in je Ingress één annotation bij en vul je je echte domein in
([`ingress-examples/05-letsencrypt.yaml`](ingress-examples/05-letsencrypt.yaml)):

```yaml
metadata:
  name: petshelter
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        - petshelter.jouwdomein.be
      secretName: petshelter-tls      # cert-manager maakt deze Secret zelf aan
  rules:
    - host: petshelter.jouwdomein.be
      ...
```

```bash
kubectl get certificate             # petshelter-tls   READY True   (na 1 à 2 minuten)
```

Werkt dit niet op Minikube? Klopt: Let's Encrypt moet je domein **vanaf het internet** kunnen bereiken. Dat kan pas
in de cloud. Meer, en hoe je fouten zoekt: [Ingress Advanced – cert-manager](ingress-advanced.md#4-cert-manager-en-lets-encrypt-in-detail).

---

## 7. Fouten zoeken

Werk altijd van buiten naar binnen: controller → Ingress → Service → pods.

```bash
kubectl get pods,svc -n traefik     # 1. draait de controller, en heeft hij een EXTERNAL-IP?
kubectl get ingress                 # 2. bestaat je Ingress, met de juiste CLASS en HOSTS?
kubectl describe ingress petshelter #    staan de backends (Service:poort) juist?
kubectl describe svc frontend-service    # 3. staan er pod-IP's bij "Endpoints"? Leeg = geen werkende pods
kubectl get pods                    # 4. draaien en zijn de pods Ready?
kubectl logs -n traefik deploy/traefik   # de logs van de controller
```

| Wat je ziet | Wat er meestal mis is |
|---|---|
| geen verbinding (connection refused / timeout) | de controller is niet bereikbaar: `EXTERNAL-IP <pending>` (start `minikube tunnel`), of je gebruikt de verkeerde poort |
| `404 page not found` (platte tekst) | Traefik antwoordt, maar **geen regel past**: verkeerde `host` of pad, een tikfout in `ingressClassName`, of Traefik negeert je Ingress omdat de **Service-naam of -poort niet bestaat**. Dat laatste staat in de logs van Traefik (`service port not found`) |
| `503 no available server` | de regel en de Service kloppen, maar er zijn geen werkende pods: labels die niet overeenkomen, pods niet Ready, of 0 replicas |
| de 404-pagina **van je eigen app** | de request komt aan bij je app, maar met een pad dat je app niet kent |
| certificaat `TRAEFIK DEFAULT CERT` | Traefik vindt je TLS-Secret niet: verkeerde `secretName`, Secret in een andere namespace, of cert-manager is nog bezig |
| Ingress werkt niet in een andere namespace | een Ingress kan enkel naar Services **in zijn eigen namespace** verwijzen: zet hem in dezelfde namespace als je app |

---

## 8. Commando's

| Commando | Wat |
|---|---|
| `kubectl apply -f ingress.yaml` | Ingress aanmaken of bijwerken |
| `kubectl get ingress` (kort: `ing`) | alle Ingresses met class, hosts en adres |
| `kubectl describe ingress <naam>` | regels en backends in detail |
| `kubectl delete ingress <naam>` | Ingress verwijderen |
| `kubectl get ingressclass` | welke controllers er zijn |
| `kubectl get svc -n traefik` | het externe IP-adres van de controller |
| `kubectl logs -n traefik deploy/traefik` | logs van Traefik |
| `kubectl create secret tls <naam> --cert=... --key=...` | TLS-Secret aanmaken |
| `kubectl get certificate` | status van certificaten (cert-manager) |
| `minikube tunnel` | LoadBalancer-IP op Minikube (venster open laten) |

---

## 9. Oefeningen

1. **Eerste Ingress.** Installeer Traefik, deploy PetShelter en open de app op http://localhost (zonder poortnummer).
   Zet daarna in `../06-Kubernetes/6c-minikube-demo/k8s/frontend-deployment.yaml` de frontend-Service terug naar
   `ClusterIP` (haal `type: NodePort` en `nodePort` weg): werkt de app via de Ingress nog?
2. **Paden.** Pas `02-paths.yaml` toe. Wat krijg je op `/api/pets`, `/whoami/test` en `/bestaat-niet`? Wie beantwoordt
   elke request: Traefik, de frontend, de backend of whoami?
3. **Load balancing.** Schaal whoami naar 5 replicas (`kubectl scale deploy whoami --replicas=5`) en tel hoeveel
   verschillende `Hostname`s je ziet bij 20 requests.
4. **Hosts.** Voeg aan `03-hosts.yaml` een derde host `api.localhost` toe die naar `backend-service` gaat. Test met
   `curl http://api.localhost/api/pets`.
5. **Fouten maken.** Verander in je Ingress de Service-poort in `3001`. Welke foutcode krijg je, en wat staat er in
   de logs van Traefik? Zet de poort terug en verander `ingressClassName` in `traefk`. Schaal daarna de frontend naar
   0 replicas. Welke foutcode krijg je telkens? Zoek de fouten met de commando's uit sectie 7.
6. **HTTPS.** Maak het self-signed certificaat, pas `04-tls.yaml` toe en open https://petshelter.localhost. Bekijk in
   je browser wie het certificaat heeft uitgegeven.

**Volgende stap:** in de [Final](../00-Assessment/Devops/3-Final-Assessment.md) doe je dit in een echte cluster, met
je eigen domein, Let's Encrypt en de route `/nodeinfo`. Zet je Ingress dan in je Helm chart
([voorbeeld](../07-Helm/helm-petshelter.md)).
