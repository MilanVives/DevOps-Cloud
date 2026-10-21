# PetShelter naar Helm, stap voor stap

<!-- {% raw %} -->

In [les 6](../06-Kubernetes/6c-minikube-demo/) deployde je PetShelter met vijf YAML-bestanden en `kubectl apply`.
Hier zet je die om naar **één Helm chart** die je naar een test- en een productieomgeving deployt. Dat is precies wat
je in de Final doet.

Lees eerst de [Helm-les](helm.md) (begrippen, templates, values).

Je vertrekt van een lege chart (`helm create`), kopieert de YAML uit les 6 en haalt er stap voor stap variabelen
uit. Het eindresultaat staat in [petshelter-chart/](petshelter-chart/). Probeer het eerst zelf en vergelijk daarna.

```
petshelter-chart/
├── Chart.yaml
├── values.yaml            standaardwaarden
├── values-test.yaml       enkel wat anders is in test
├── values-prod.yaml       enkel wat anders is in productie
└── templates/
    ├── database.yaml      MongoDB: PersistentVolumeClaim + Deployment + Service
    ├── backend.yaml       Deployment + Service
    ├── frontend.yaml      Deployment + Service
    ├── ingress.yaml       enkel als ingress.enabled
    └── NOTES.txt          de tekst die je na het installeren ziet
```

**Nodig:** Minikube, `kubectl` en `helm`. Voor de Ingress ook Traefik ([les 8, sectie 2](../08-Ingress-and-Reverse-Proxies/ingress.md#2-traefik-installeren-op-minikube));
zonder Traefik werkt alles ook, via `kubectl port-forward`.

Voer de commando's uit in de map `07-Helm` van de cursusrepository. Heb je de app uit les 6 nog draaien? Ruim ze eerst op: `kubectl delete -f ../06-Kubernetes/6c-minikube-demo/k8s/`.

---

## De aanpak

1. Een lege chart maken met `helm create`.
2. De YAML-bestanden uit les 6 **ongewijzigd** in `templates/` kopiëren: dat werkt meteen.
3. Stap voor stap vaste waarden vervangen door `{{ .Values... }}` en ze in `values.yaml` zetten.
4. Na elke stap controleren met `helm template` en `helm upgrade`.

Zo heb je na elke stap een werkende chart, en zie je precies wat elke wijziging doet.

---

## Stap 1: een lege chart met `helm create`

```bash
helm create petshelter-chart
```

> In oude tutorials staat `helm init`: dat was Helm 2 (met Tiller) en bestaat niet meer. In Helm 3 en 4 maak je een
> nieuwe chart met `helm create`.

`helm create` maakt een volledige voorbeeldchart voor een nginx-webserver:

```
petshelter-chart/
├── .helmignore              bestanden die niet in het pakket komen
├── Chart.yaml
├── values.yaml              98 regels voorbeeldinstellingen
├── charts/
└── templates/
    ├── NOTES.txt
    ├── _helpers.tpl
    ├── deployment.yaml
    ├── hpa.yaml
    ├── ingress.yaml
    ├── service.yaml
    ├── serviceaccount.yaml
    └── tests/test-connection.yaml
```

Die voorbeelden passen niet bij PetShelter. Bekijk ze gerust (vooral `_helpers.tpl` en `ingress.yaml` zijn leerrijk),
maar maak de chart daarna leeg:

```bash
rm -rf petshelter-chart/templates/*
: > petshelter-chart/values.yaml          # lege values.yaml (Windows: maak het bestand leeg in je editor)
```

Pas `petshelter-chart/Chart.yaml` aan (de commentaarregels mag je weglaten):

```yaml
apiVersion: v2
name: petshelter
description: PetShelter (MongoDB, backend en frontend) als Helm chart
type: application
version: 0.1.0
appVersion: "1.0.0"
```

---

## Stap 2: de YAML uit les 6 kopiëren

```bash
cp ../06-Kubernetes/6c-minikube-demo/k8s/*.yaml petshelter-chart/templates/
ls petshelter-chart/templates/
# backend-deployment.yaml  frontend-deployment.yaml  mongodb-configmap.yaml
# mongodb-deployment.yaml  mongodb-secret.yaml
```

Gewone Kubernetes-YAML **is** al een geldige template: er staat gewoon nog niets variabel in. Dit werkt dus meteen:

```bash
helm lint ./petshelter-chart
helm template petshelter ./petshelter-chart          # exact de YAML uit les 6
helm install petshelter ./petshelter-chart -n test --create-namespace
kubectl get pods -n test                             # mongodb, backend, frontend: Running
helm list -n test
```

Je app draait nu als Helm-release. Je hoeft je ook geen zorgen meer te maken over de volgorde: Helm installeert
Secrets en ConfigMaps vóór de Deployments.

---

## Stap 3: de eerste variabelen: images en replicas

Kijk in de bestanden welke waarden je per omgeving wil kunnen aanpassen. Begin met de images en het aantal replicas.

In `templates/backend-deployment.yaml`:

```yaml
spec:
  replicas: 1                                            # voor
  replicas: {{ .Values.replicas.backend }}               # na
...
        image: docker.io/dimilan/pet-shelter-backend:latest   # voor
        image: {{ .Values.images.backend }}                   # na
```

Doe hetzelfde in `frontend-deployment.yaml` (`.Values.replicas.frontend`, `.Values.images.frontend`) en voor de image
in `mongodb-deployment.yaml` (`.Values.images.database`). De waarden komen in `values.yaml`:

```yaml
images:
  frontend: dimilan/pet-shelter-frontend:latest
  backend: dimilan/pet-shelter-backend:latest
  database: mongo:7

replicas:
  frontend: 1
  backend: 1
```

Controleren en uitrollen:

```bash
helm template petshelter ./petshelter-chart | grep -E "replicas|image:"
helm upgrade petshelter ./petshelter-chart -n test --set replicas.frontend=3
kubectl get deploy -n test           # frontend 3/3
helm history petshelter -n test      # revision 1 en 2
```

Zo werk je verder: **één waarde tegelijk** naar `values.yaml`, telkens `helm template` om te controleren. Welke
waarden? Alles wat per omgeving verschilt: images, replicas, opslag, hostnaam. Poorten en namen mogen vast in de
templates blijven staan.

> Gebruik je je eigen images (zoals in de PE's en de Final), vervang dan `dimilan/...` door je eigen Docker
> Hub-images, met een vaste tag in plaats van `latest`.

---

## Stap 4: de Secret buiten de chart

`mongodb-secret.yaml` bevat het wachtwoord van de database, en zou zo in git belanden. Haal het uit de chart: de Secret
maak je **per omgeving** zelf aan, en de chart **verwijst** er enkel naar.

```bash
rm petshelter-chart/templates/mongodb-secret.yaml
kubectl create secret generic db-credentials -n test \
  --from-literal=DB_USER=admin \
  --from-literal=DB_PASSWORD='kies-een-wachtwoord'
```

In de Deployments van MongoDB en de backend verwijs je naar die Secret, met de naam uit `values.yaml`:

```yaml
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.dbSecret }}      # was: mongodb-secret
                  key: DB_PASSWORD                  # was: password
```

```yaml
# values.yaml
dbSecret: db-credentials
```

In de Final doe je hetzelfde, of laat je je CI/CD-pipeline de Secret aanmaken vanuit GitHub Secrets.

```bash
helm upgrade petshelter ./petshelter-chart -n test
kubectl get secret -n test       # db-credentials staat er; mongodb-secret heeft Helm zelf verwijderd
```

> MongoDB gebruikt het wachtwoord enkel bij de **eerste** start met een lege database. Zonder opslag (zoals in les 6)
> start elke nieuwe MongoDB-pod leeg, dus het nieuwe wachtwoord werkt meteen. Zodra je opslag toevoegt (stap 5) en
> later het wachtwoord wijzigt, moet je de PVC verwijderen (je verliest dan de data).

---

## Stap 5: opruimen en verbeteren

Nu alles werkt, maak je de chart netter en klaar voor productie:

| Les 6 | Chart | Waarom |
|---|---|---|
| 5 bestanden | 1 bestand per onderdeel (Deployment + Service samen, gescheiden door `---`) | overzichtelijker |
| Services `mongodb-service`, `backend-service`, `frontend-service` | `database`, `backend`, `frontend` | korter; zo heten ze ook in de Final-template |
| ConfigMap `mongodb-config` | weg: `MONGO_HOST: database` staat rechtstreeks in de backend | één waarde hoeft geen ConfigMap |
| `mongodb-secret.yaml` met `username`/`password` | Secret `db-credentials` met `DB_USER`/`DB_PASSWORD`, buiten de chart (stap 4) | geen wachtwoorden in git |
| frontend als `NodePort` 32500 | `ClusterIP` (standaard) + Ingress | geen opengezette poorten |
| geen opslag voor MongoDB | PersistentVolumeClaim | data overleeft een herstart van de pod |

De namen van de objecten staan vast (`backend`, niet `{{ .Release.Name }}-backend`). Dat is eenvoudiger, en
geen probleem zolang je **elke omgeving in een eigen namespace** zet. Twee releases van deze chart in dezelfde
namespace kan wel niet.

Hieronder staan de templates zoals ze er op het einde uitzien (ook in [petshelter-chart/templates/](petshelter-chart/templates/)).
Bij `helm upgrade` verwijdert Helm zelf de objecten die niet meer in de chart staan, zoals de oude ConfigMap en Services.

### templates/backend.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: {{ .Values.replicas.backend }}
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: {{ .Values.images.backend }}
          ports:
            - containerPort: 5000
          env:
            - name: MONGO_HOST
              value: database
            - name: MONGO_USERNAME
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.dbSecret }}
                  key: DB_USER
            - name: MONGO_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.dbSecret }}
                  key: DB_PASSWORD
          readinessProbe:
            httpGet:
              path: /health
              port: 5000
---
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  selector:
    app: backend
  ports:
    - port: 5000
```

- `MONGO_HOST: database` is de naam van de Service van MongoDB: Kubernetes-DNS maakt daar het juiste IP-adres van.
- De **readinessProbe** zorgt ervoor dat een pod pas verkeer krijgt als `/health` antwoordt, ook via de Ingress.

### templates/frontend.yaml

Hetzelfde patroon. De frontend vindt de backend via `BACKEND_URL`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: {{ .Values.replicas.frontend }}
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: {{ .Values.images.frontend }}
          ports:
            - containerPort: 3000
          env:
            - name: BACKEND_URL
              value: http://backend:5000
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
spec:
  selector:
    app: frontend
  ports:
    - port: 3000
```

### templates/database.yaml

MongoDB met opslag. Een database schaal je **niet** met replicas: altijd 1 pod, en `strategy: Recreate` zodat er
bij een update nooit twee pods tegelijk dezelfde opslag gebruiken.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: database-data
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: {{ .Values.database.storage }}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: database
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: database
  template:
    metadata:
      labels:
        app: database
    spec:
      containers:
        - name: mongodb
          image: {{ .Values.images.database }}
          ports:
            - containerPort: 27017
          env:
            - name: MONGO_INITDB_ROOT_USERNAME
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.dbSecret }}
                  key: DB_USER
            - name: MONGO_INITDB_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.dbSecret }}
                  key: DB_PASSWORD
          volumeMounts:
            - name: data
              mountPath: /data/db
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: database-data
---
apiVersion: v1
kind: Service
metadata:
  name: database
spec:
  selector:
    app: database
  ports:
    - port: 27017
```

### templates/ingress.yaml

Enkel aangemaakt als `ingress.enabled` op `true` staat. `/api` gaat rechtstreeks naar de backend, de rest naar de
frontend. Uitleg over Ingress: [les 8](../08-Ingress-and-Reverse-Proxies/ingress.md).

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: petshelter
  {{- if .Values.ingress.tls.clusterIssuer }}
  annotations:
    cert-manager.io/cluster-issuer: {{ .Values.ingress.tls.clusterIssuer }}
  {{- end }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  {{- if .Values.ingress.tls.enabled }}
  tls:
    - hosts:
        - {{ .Values.ingress.host | quote }}
      secretName: petshelter-tls
  {{- end }}
  rules:
    - http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 5000
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 3000
      {{- with .Values.ingress.host }}
      host: {{ . | quote }}
      {{- end }}
{{- end }}
```

- `{{- with .Values.ingress.host }}` voegt `host:` enkel toe als er een hostnaam is ingevuld. Binnen `with` verwijst
  `.` naar die waarde.
- De annotation voor cert-manager komt er enkel bij als je een `clusterIssuer` invult.

### templates/NOTES.txt

Deze tekst toont Helm na `install` en `upgrade`, en met `helm status`. Ook hier kan je templates gebruiken:

```
PetShelter is geïnstalleerd als release "{{ .Release.Name }}" in namespace "{{ .Release.Namespace }}".

Status bekijken:
  kubectl get pods -n {{ .Release.Namespace }}
{{- if .Values.ingress.enabled }}

Openen:
  http{{ if .Values.ingress.tls.enabled }}s{{ end }}://{{ .Values.ingress.host | default "localhost" }}/
{{- else }}

Openen (geen ingress):
  kubectl port-forward -n {{ .Release.Namespace }} svc/frontend 3000:3000
  en surf naar http://localhost:3000
{{- end }}
```

### values.yaml

Alle variabelen samen:

```yaml
# Standaardwaarden. Per omgeving overschrijf je enkel wat verschilt (values-test.yaml, values-prod.yaml).

images:
  frontend: dimilan/pet-shelter-frontend:latest
  backend: dimilan/pet-shelter-backend:latest
  database: mongo:7

replicas:
  frontend: 1
  backend: 1

# Naam van de Secret met DB_USER en DB_PASSWORD. Die maak je zelf aan met kubectl:
# wachtwoorden horen niet in een values-bestand in git.
dbSecret: db-credentials

database:
  storage: 1Gi

ingress:
  enabled: false
  className: traefik
  # Leeg = elke hostnaam (handig op Minikube).
  host: ""
  tls:
    enabled: false
    # Naam van een cert-manager ClusterIssuer, bv. "letsencrypt". Leeg = zelf een TLS-Secret aanmaken.
    clusterIssuer: ""
```

---

## Stap 6: controleren

```bash
helm lint ./petshelter-chart
helm template petshelter ./petshelter-chart | less                       # standaardwaarden
helm template petshelter ./petshelter-chart -f petshelter-chart/values-prod.yaml -s templates/ingress.yaml
```

Kijk in de uitvoer: staan de juiste images en replicas erin? Zit er enkel een Ingress in als `ingress.enabled` aan
staat?

---

## Stap 7: de testomgeving

`petshelter-chart/values-test.yaml`: enkel wat anders is dan de standaard.

```yaml
# Testomgeving: klein, zonder HTTPS.
ingress:
  enabled: true
  host: petshelter-test.localhost
```

```bash
helm upgrade --install petshelter ./petshelter-chart -n test -f petshelter-chart/values-test.yaml
kubectl get pods -n test          # database, backend, frontend: Running en 1/1 Ready
```

Openen:

- **met Traefik en `minikube tunnel`:** http://petshelter-test.localhost
- **zonder Traefik:** `kubectl port-forward -n test svc/frontend 3000:3000` en http://localhost:3000

```bash
curl http://petshelter-test.localhost/api/pets     # JSON met de dieren
```

> De backend start soms één keer opnieuw (`RESTARTS 1`) omdat MongoDB nog niet klaar was. Dat lost zichzelf op.

---

## Stap 8: de productieomgeving

`petshelter-chart/values-prod.yaml`:

```yaml
# Productie: meer replicas, meer opslag, HTTPS met Let's Encrypt.
replicas:
  frontend: 3
  backend: 3

database:
  storage: 5Gi

ingress:
  enabled: true
  host: petshelter.jouwdomein.be
  tls:
    enabled: true
    clusterIssuer: letsencrypt
```

Op een echte cluster met jouw domein en cert-manager is dit genoeg:

```bash
kubectl create namespace prod
kubectl create secret generic db-credentials -n prod --from-literal=DB_USER=admin --from-literal=DB_PASSWORD='een-ander-wachtwoord'
helm upgrade --install petshelter ./petshelter-chart -n prod -f petshelter-chart/values-prod.yaml
```

**Op Minikube** heb je geen echt domein en geen Let's Encrypt. Overschrijf daarom die twee waarden met `--set`, en
maak zelf een certificaat zoals in [les 8, sectie 6](../08-Ingress-and-Reverse-Proxies/ingress.md#6-https):

```bash
helm upgrade --install petshelter ./petshelter-chart -n prod -f petshelter-chart/values-prod.yaml \
  --set ingress.host=petshelter.localhost --set ingress.tls.clusterIssuer=
kubectl create secret tls petshelter-tls -n prod --cert=tls.crt --key=tls.key

kubectl get pods -n prod          # 3 frontends, 3 backends, 1 database
curl -k https://petshelter.localhost/
helm list -A                      # petshelter in test én in prod
```

Dezelfde chart, twee omgevingen, en de verschillen staan in twee kleine bestanden.

---

## Stap 9: updaten en terugdraaien

Een nieuwe versie van de backend uitrollen in test:

```bash
helm upgrade petshelter ./petshelter-chart -n test -f petshelter-chart/values-test.yaml \
  --set images.backend=dimilan/pet-shelter-backend:v2
helm history petshelter -n test
```

Bestaat die tag niet, dan zie je `ImagePullBackOff` in `kubectl get pods -n test`. Je app blijft wel werken: Kubernetes
laat de oude backend-pod draaien tot de nieuwe Ready is. Terug naar de vorige versie:

```bash
helm rollback petshelter 1 -n test
```

> Geef bij elke upgrade je values-bestand opnieuw mee (`-f values-test.yaml` of `-f values-prod.yaml`). Geef je enkel
> `--set` mee, dan begint Helm opnieuw van `values.yaml` en verdwijnt bijvoorbeeld je Ingress.

Zo werkt ook je CI/CD-pipeline in de Final: een nieuwe image bouwen en pushen, en daarna
`helm upgrade --install ... --set images.backend=<nieuwe tag>`.

Opruimen:

```bash
helm uninstall petshelter -n test
helm uninstall petshelter -n prod
kubectl delete namespace test prod      # ook de Secrets en de opslag (PVC) weg
```

`helm uninstall` laat objecten staan die niet uit de chart komen, zoals je Secret `db-credentials`.

---

## Problemen oplossen

| Probleem | Oplossing |
|---|---|
| `Error: INSTALLATION FAILED: cannot re-use a name that is still in use` | de release bestaat al: gebruik `helm upgrade --install` |
| pod `CreateContainerConfigError` | de Secret `db-credentials` ontbreekt in die namespace, of de sleutels heten niet `DB_USER`/`DB_PASSWORD`: `kubectl describe pod <naam> -n test` |
| pod `ImagePullBackOff` | verkeerde image of tag, of de image bestaat niet voor jouw processor (amd64/arm64, zie [les 2](../02-Dockerfile/Dockerfile-Intro.md#let-op-apple-silicon-vs-intelamd)) |
| backend `CrashLoopBackOff` | `kubectl logs deploy/backend -n test`: meestal kan hij MongoDB niet bereiken of klopt het wachtwoord niet |
| database blijft `Pending` | de PVC krijgt geen opslag: `kubectl get pvc -n test` (Minikube heeft standaard een StorageClass) |
| wachtwoord veranderd, maar MongoDB weigert | MongoDB gebruikt het wachtwoord enkel bij de **eerste** start met lege opslag. Verwijder de PVC (je verliest de data) |
| template-fout bij `install` | `helm template` toont dezelfde fout met regelnummer; `helm lint` helpt ook |
| wijziging in values zie je niet | `helm get values petshelter -n test`: werd je values-bestand meegegeven? |

```bash
helm get manifest petshelter -n test    # de YAML die Helm echt geïnstalleerd heeft
helm status petshelter -n test
```

---

## Van hier naar de Final

De [Final-template](../00-Assessment/Devops/3-Final-Assessment.md) heeft dezelfde opbouw (`helm/app/` met
`values.yaml`, `values-test.yaml`, `values-prod.yaml`). Wat je daar nog toevoegt:

- de template **`nodeinfo.yaml`** die al klaarstaat (niet verwijderen), en de route `/nodeinfo` in je Ingress;
- een **HorizontalPodAutoscaler** voor je backend en/of frontend (enkel aan in productie, via values);
- **resources** (`requests`/`limits`) op elke container: nodig voor de HPA;
- een vaste image-tag per versie, die je CI/CD-pipeline invult.

Wil je je chart verder verfijnen (gedeelde labels via `_helpers.tpl`, hooks, tests, de chart publiceren)? Zie
[Helm Advanced](helm-advanced.md).

<!-- {% endraw %} -->
