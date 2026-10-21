# 8 - Ingress Advanced

Verdieping bij de [Ingress-les](ingress.md). Lees die eerst: hier gaan we ervan uit dat je een Ingress met paden,
hosts en TLS kan schrijven.

**Inhoud**

1. [Hoe een Ingress controller werkt](#1-hoe-een-ingress-controller-werkt)
2. [IngressClass en meerdere controllers](#2-ingressclass-en-meerdere-controllers)
3. [Welke controller kies je?](#3-welke-controller-kies-je)
4. [cert-manager en Let's Encrypt in detail](#4-cert-manager-en-lets-encrypt-in-detail)
5. [Traefik in productie](#5-traefik-in-productie)
6. [Traefik-middlewares: login, rate limiting, paden herschrijven](#6-traefik-middlewares)
7. [Traefik IngressRoute](#7-traefik-ingressroute)
8. [Annotations en de valkuil `rewrite-target`](#8-annotations-en-de-valkuil-rewrite-target)
9. [Gateway API: de opvolger van Ingress](#9-gateway-api-de-opvolger-van-ingress)
10. [Extra's: external-dns, Cloudflare tunnel](#10-extras)
11. [Productie-checklist](#11-productie-checklist)

---

## 1. Hoe een Ingress controller werkt

Een Ingress controller is gewoon een **reverse proxy** (Traefik, nginx, HAProxy, …) die als Deployment in je cluster
draait, met één extra taak: hij **volgt de Kubernetes API**. Zodra je een Ingress aanmaakt, wijzigt of verwijdert,
krijgt de controller dat te horen en past hij zijn eigen configuratie aan, zonder herstart.

```
kubectl apply -f ingress.yaml
        │
        ▼
Kubernetes API (opgeslagen in etcd)
        │  "watch": er is een nieuwe Ingress
        ▼
Ingress controller  ──►  past zijn routingtabel aan
        │
        ▼  verkeer van buiten (via de LoadBalancer-Service van de controller)
Service ──► pods
```

Belangrijk: **verkeer gaat nooit via de Kubernetes API.** De API levert enkel de regels; het verkeer zelf komt binnen
op de Service van de controller.

Een controller stuurt het verkeer meestal **rechtstreeks naar de pod-IP's** (hij leest de endpoints van je Service),
niet via het ClusterIP van de Service. Daardoor kan hij zelf de load balancing en health checks doen.

**ingress-nginx** maakt van je Ingress-regels letterlijk een `nginx.conf`. Je kan dat zelf bekijken met
`kubectl exec -n ingress-nginx deploy/ingress-nginx-controller -- cat /etc/nginx/nginx.conf`.

![Werking van de nginx Ingress controller](../images/ingress/nginx-controller-workflow.png)

**Traefik** houdt de configuratie in het geheugen. Je ziet ze in het dashboard (sectie 5).

### Het volledige plaatje in de cloud

![Ingress-architectuur in de cloud](../images/ingress/ingress-architecture.png)

1. **DNS**: `*.example.com` wijst naar het IP van de cloud load balancer.
2. **Cloud load balancer**: aangemaakt door Kubernetes omdat de Service van de controller `type: LoadBalancer` is.
3. **Ingress controller** (hier nginx, bij ons Traefik): in een eigen namespace, met meerdere replicas.
4. **Ingress-regels** in de namespace van de app: `/payment` → payment-service, `/auth` → auth-service.
5. **Services en pods** van de applicatie.

---

## 2. IngressClass en meerdere controllers

Je kan meerdere controllers in één cluster hebben, bijvoorbeeld een publieke en een interne. Elke controller hoort bij
een **IngressClass**; met `ingressClassName` kies je welke controller je Ingress uitvoert.

```bash
kubectl get ingressclass
# NAME      CONTROLLER                      PARAMETERS   AGE
# traefik   traefik.io/ingress-controller   <none>       5m
```

- De Traefik Helm chart maakt de class `traefik` aan en markeert ze als **default**
  (annotation `ingressclass.kubernetes.io/is-default-class: "true"`). Een Ingress zonder `ingressClassName` gaat dan
  naar Traefik. Schrijf de class toch altijd expliciet: duidelijker, en het werkt ook in een cluster met een andere
  default.
- Oude voorbeelden gebruiken de annotation `kubernetes.io/ingress.class: nginx`. Die is vervangen door
  `spec.ingressClassName`.
- **k3s** installeert standaard Traefik. In een k3s-cluster hoef je hem dus niet zelf te installeren (installeer je
  hem toch met Helm, schakel dan de ingebouwde uit met `--disable traefik`).

---

## 3. Welke controller kies je?

| Controller | Kenmerken |
|---|---|
| **Traefik** | eenvoudig, dashboard, middlewares (auth, rate limiting), standaard in k3s. **Onze keuze.** |
| **ingress-nginx** | jarenlang de meest gebruikte, veel voorbeelden online. Wordt sinds maart 2026 **niet meer onderhouden**: niet meer gebruiken voor nieuwe projecten. Pas op met de verwarrende naam: **NGINX Ingress Controller** van F5/NGINX Inc. is een ander, wel onderhouden project. |
| **HAProxy Ingress** | zeer performant |
| **Cloud controllers** | AWS Load Balancer Controller, GKE Ingress, Azure Application Gateway: gebruiken de load balancer van de cloud zelf |
| **Gateway API-implementaties** | Envoy Gateway, Cilium, Istio, Traefik, NGINX Gateway Fabric (zie sectie 9) |

Een vergelijking van alle controllers maakte [learnk8s](https://docs.google.com/spreadsheets/d/191WWNpjJ2za6-nbG4ZoUMXMpUK8KlCIosvQB0f-oq3k/).

**Ingress of Cloudflare tunnel?** In de Final mag je ook een [Cloudflare tunnel](#10-extras) gebruiken. Een tunnel
heeft geen publiek IP en geen open poorten nodig, maar je verkeer loopt dan via Cloudflare.

---

## 4. cert-manager en Let's Encrypt in detail

### Wat er gebeurt

```
Ingress met annotation cert-manager.io/cluster-issuer: letsencrypt
   │
   ▼
cert-manager maakt een Certificate-object  ─►  Order bij Let's Encrypt  ─►  Challenge
   │
   ▼  HTTP-01: cert-manager zet een tijdelijke pod + Ingress klaar voor
   │  http://jouwdomein/.well-known/acme-challenge/<token>
   ▼
Let's Encrypt haalt die URL op via het internet  ─►  "je beheert dit domein"  ─►  certificaat
   │
   ▼
cert-manager schrijft tls.crt en tls.key in de Secret uit je Ingress (secretName) en vernieuwt automatisch
```

### Eerst testen met de staging-server

Let's Encrypt heeft **limieten** (o.a. 5 identieke certificaten per week). Probeer je tien keer met een fout in je
configuratie, dan zit je een week vast. Test daarom eerst met de **staging**-server: die heeft ruime limieten, maar
browsers vertrouwen zijn certificaten niet.

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: jouw.naam@student.vives.be
    privateKeySecretRef:
      name: letsencrypt-staging-account-key
    solvers:
      - http01:
          ingress:
            ingressClassName: traefik
```

Werkt staging (`kubectl get certificate` → `READY True`), zet dan de annotation op `letsencrypt` (de productie-issuer
uit [cluster-issuer.yaml](ingress-examples/cluster-issuer.yaml)) en verwijder de oude Secret, zodat er een nieuw
certificaat aangevraagd wordt.

`ClusterIssuer` geldt voor de hele cluster. Een `Issuer` doet hetzelfde voor één namespace.

### Fouten zoeken

Volg de keten Certificate → CertificateRequest → Order → Challenge:

```bash
kubectl get certificate,certificaterequest,order,challenge -A
kubectl describe certificate petshelter-tls      # Events onderaan
kubectl describe challenge -A                    # de reden waarom de challenge faalt
kubectl logs -n cert-manager deploy/cert-manager
```

| Probleem | Oorzaak |
|---|---|
| challenge blijft `pending` | het domein wijst (nog) niet naar het IP van Traefik (`dig +short jouwdomein.be`), of poort 80 is dicht in een firewall of security group |
| `404` op de challenge-URL | `ingressClassName` in de ClusterIssuer klopt niet met je controller |
| `too many certificates already issued` | rate limit: wacht, en test voortaan met staging |
| certificaat `READY True` maar browser toont `TRAEFIK DEFAULT CERT` | `secretName` in de Ingress verschilt van de Secret, of de Ingress staat in een andere namespace |

### Wildcard-certificaten (DNS-01)

Voor `*.jouwdomein.be` is HTTP-01 niet genoeg: dan bewijs je eigenaarschap met een TXT-record in je DNS (*DNS-01
challenge*). cert-manager doet dat automatisch via de API van je DNS-provider (Cloudflare, Route53, …), met een
API-token in een Secret. Zie de [cert-manager-documentatie over DNS-01](https://cert-manager.io/docs/configuration/acme/dns01/).

---

## 5. Traefik in productie

Instellingen geef je mee in een values-bestand voor de Helm chart (`helm show values traefik/traefik` toont alle
opties). Een goed vertrekpunt:

```yaml
# traefik-values.yaml
deployment:
  replicas: 2

ports:
  web:
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true

ingressRoute:
  dashboard:
    enabled: true
```

```bash
helm upgrade --install traefik traefik/traefik -n traefik --create-namespace -f traefik-values.yaml
```

- **`redirections`**: elke `http://`-request krijgt een `301` naar `https://`. De HTTP-01-challenge van cert-manager
  werkt meestal nog, want Let's Encrypt volgt die redirect. Lukt de eerste aanvraag niet, zet de redirect dan
  tijdelijk uit tot je certificaat er is.
- **`replicas: 2`**: valt een node uit, dan blijft je site bereikbaar. Gebruik hiervoor cert-manager en niet de
  ingebouwde Let's Encrypt-functie van Traefik: die bewaart certificaten in een bestand in één pod en werkt niet goed
  met meerdere replicas.
- **Het dashboard** is enkel bereikbaar via port-forward. Zet het nooit zonder login op het internet:

```bash
kubectl port-forward -n traefik deploy/traefik 8080:8080
# open http://localhost:8080/dashboard/
```

In het dashboard zie je alle routers (je Ingress-regels), services en middlewares, en welke regels fouten bevatten.

---

## 6. Traefik-middlewares

Een **middleware** bewerkt een request voor het bij je app aankomt: login vragen, limieten opleggen, het pad
aanpassen, headers toevoegen. Je maakt een `Middleware`-object (een *Custom Resource* van Traefik) en koppelt het met
een annotation aan je Ingress.

```yaml
# Login met gebruikersnaam en wachtwoord
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: basic-auth
spec:
  basicAuth:
    secret: whoami-auth       # Secret met een sleutel "users" in htpasswd-formaat
---
# Max. gemiddeld 5 requests per seconde, pieken tot 10
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: rate-limit
spec:
  rateLimit:
    average: 5
    burst: 10
---
# /whoami/x  →  de app krijgt /x
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: strip-whoami
spec:
  stripPrefix:
    prefixes:
      - /whoami
```

```bash
htpasswd -nbB admin geheim > users          # htpasswd: pakket apache2-utils, of: brew install httpd
kubectl create secret generic whoami-auth --from-file=users
```

De annotation op je Ingress heeft het formaat `<namespace>-<naam>@kubernetescrd`, gescheiden door komma's:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: whoami
  annotations:
    traefik.ingress.kubernetes.io/router.middlewares: default-basic-auth@kubernetescrd,default-strip-whoami@kubernetescrd,default-rate-limit@kubernetescrd
spec:
  ingressClassName: traefik
  rules:
    - http:
        paths:
          - path: /whoami
            pathType: Prefix
            backend:
              service:
                name: whoami
                port:
                  number: 80
```

Resultaat: zonder login `401`, met `curl -u admin:geheim` krijgt whoami `/x` binnen, en wie te snel gaat krijgt
`429 Too Many Requests`.

> Oude voorbeelden gebruiken `apiVersion: traefik.containo.us/v1alpha1`. Die werkt niet meer in Traefik v3: gebruik
> `traefik.io/v1alpha1`.

---

## 7. Traefik IngressRoute

Naast de standaard `Ingress` heeft Traefik een eigen resource, **IngressRoute**, met meer mogelijkheden in één object
(regels met `Host()`, `PathPrefix()`, `Headers()`, gewichten tussen services, middlewares zonder annotations):

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: whoami
spec:
  entryPoints: [websecure]
  routes:
    - match: Host(`whoami.localhost`) && PathPrefix(`/`)
      kind: Rule
      middlewares:
        - name: rate-limit
      services:
        - name: whoami
          port: 80
```

Nadeel: het werkt **enkel met Traefik**. Een standaard `Ingress` werkt met elke controller. Gebruik IngressRoute
alleen als je iets nodig hebt dat met een gewone Ingress niet kan.

---

## 8. Annotations en de valkuil `rewrite-target`

Extra instellingen per Ingress geef je via **annotations**, en die zijn **per controller verschillend**:

| Doel | Traefik | ingress-nginx |
|---|---|---|
| middlewares koppelen | `traefik.ingress.kubernetes.io/router.middlewares` | n.v.t. |
| enkel HTTPS | `traefik.ingress.kubernetes.io/router.entrypoints: websecure` | `nginx.ingress.kubernetes.io/ssl-redirect: "true"` |
| pad herschrijven | middleware `stripPrefix` / `replacePath` | `nginx.ingress.kubernetes.io/rewrite-target` |

Een annotation van een andere controller wordt **stil genegeerd**: geen fout, maar ook geen effect.

**Valkuil:** veel voorbeelden online zetten `nginx.ingress.kubernetes.io/rewrite-target: /` op elke Ingress. Dat
herschrijft **elk** pad naar `/`: `/api/pets` komt dan als `/` bij je backend aan, en je API werkt niet meer. Gebruik
een rewrite enkel als je app een ander pad verwacht dan de URL, en dan alleen op die ene regel.

---

## 9. Gateway API: de opvolger van Ingress

De **Gateway API** is de nieuwere standaard van Kubernetes voor binnenkomend verkeer. Ingress blijft bestaan en wordt
nog lang ondersteund, maar nieuwe functies komen in de Gateway API.

Het grote verschil: de taken zijn opgesplitst in aparte objecten.

| Object | Wie beheert het | Wat |
|---|---|---|
| `GatewayClass` | de clusterbeheerder | welke controller (zoals IngressClass) |
| `Gateway` | de clusterbeheerder | de ingang: poorten, certificaten, welke namespaces mogen aansluiten |
| `HTTPRoute` | het team van de app | de routingregels van één app |

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: petshelter
spec:
  parentRefs:
    - name: traefik-gateway
      namespace: traefik
  hostnames:
    - petshelter.jouwdomein.be
  rules:
    - matches:
        - path: { type: PathPrefix, value: /api }
      backendRefs:
        - name: backend-service
          port: 5000
    - backendRefs:
        - name: frontend-service
          port: 3000
```

Daarnaast kan Gateway API standaard wat bij Ingress enkel via annotations kon: verkeer verdelen met gewichten (canary
releases), routeren op headers, redirects. Traefik ondersteunt Gateway API ook. Zie
[gateway-api.sigs.k8s.io](https://gateway-api.sigs.k8s.io/).

Voor de Final volstaat een gewone **Ingress**.

---

## 10. Extra's

- **external-dns** maakt automatisch DNS-records aan bij je DNS-provider (Cloudflare, Route53, …) voor elke `host` in
  je Ingresses. Handig met veel domeinen; voor één domein zet je het record gewoon zelf.
- **Cloudflare tunnel** (`cloudflared`): een pod in je cluster bouwt een uitgaande verbinding op naar Cloudflare.
  Cloudflare ontvangt het verkeer voor je domein en stuurt het door de tunnel naar je Services. Geen publiek IP, geen
  open poorten, HTTPS via Cloudflare. In de Final een toegelaten alternatief voor Traefik + Let's Encrypt. Zie
  [Cloudflare: Kubernetes](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/deployment-guides/kubernetes/).
- **Reverse proxies zonder Kubernetes**: [Traefik met Docker](Traefik.md) en [Nginx](Nginx.md).

---

## 11. Productie-checklist

- [ ] Eén controller (Traefik) met **minstens 2 replicas**, verspreid over verschillende nodes
- [ ] HTTP wordt doorgestuurd naar HTTPS
- [ ] Certificaten via **cert-manager** en Let's Encrypt, eerst getest met staging
- [ ] Apps zijn `ClusterIP`-Services: geen opengezette NodePorts
- [ ] Elke Ingress heeft een expliciete `ingressClassName`
- [ ] Het dashboard van Traefik is niet publiek bereikbaar
- [ ] Gevoelige delen (admin, monitoring) achter login (`basicAuth`-middleware) of enkel intern
- [ ] Rate limiting op publieke API's
- [ ] Je Ingress zit in je **Helm chart**, met de hostnaam per omgeving in `values-test.yaml` / `values-prod.yaml`
  ([voorbeeld](../07-Helm/helm-petshelter.md))
- [ ] Readiness probes op je pods, zodat de controller geen verkeer stuurt naar pods die nog niet klaar zijn
