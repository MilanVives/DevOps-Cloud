# Les 6c – Kubernetes met Minikube: 3-tier Pet Shelter

> In [Les 6a](kubernetes-cloud-start.md) zette je één website op een cloud cluster. In [Les 6b](kubernetes-fundamentals.md) zag je de bouwstenen. Nu combineer je alles: een applicatie met **drie samenwerkende services**, lokaal op je eigen laptop met **Minikube**.

**Repository voor deze les:** [MilanVives/PetShelter-minimal](https://github.com/MilanVives/PetShelter-minimal) (kopie in [minikube-demo/](minikube-demo/))

```bash
git clone https://github.com/MilanVives/PetShelter-minimal.git
cd PetShelter-minimal
```

## 📋 Inhoud

1. [Wat is Minikube?](#1-wat-is-minikube)
2. [Installatie en starten](#2-installatie-en-starten)
3. [De applicatie](#3-de-applicatie)
4. [De manifests één voor één](#4-de-manifests-één-voor-één)
5. [Images bouwen in Minikube](#5-images-bouwen-in-minikube)
6. [Deployen](#6-deployen)
7. [De applicatie openen](#7-de-applicatie-openen)
8. [Kijken wat er gebeurt](#8-kijken-wat-er-gebeurt)
9. [Troubleshooting](#9-troubleshooting)
10. [Schalen, updaten, data bewaren](#10-schalen-updaten-data-bewaren)
11. [Opruimen](#11-opruimen)
12. [Samenvatting & cheatsheet](#12-samenvatting--cheatsheet)

---

## 1. Wat is Minikube?

**Minikube** draait een volledige Kubernetes cluster met **één node** op je laptop. Control plane en worker zitten samen in één container (of VM).

```mermaid
graph TB
    subgraph Laptop["💻 Jouw laptop"]
        kubectl[kubectl] -->|~/.kube/config| API
        subgraph MK["Minikube (Docker container of VM)"]
            API[API server + control plane]
            subgraph Node["Eén node"]
                P1[frontend pod]
                P2[backend pod]
                P3[mongodb pod]
            end
            API --> Node
        end
    end
```

| | Minikube (deze les) | Cloud cluster (Les 6a) |
|---|---|---|
| Nodes | 1 | 3 of meer |
| Kost | Gratis | Per uur |
| Bereikbaar van | Enkel je laptop | Internet |
| Externe toegang | `NodePort`, `minikube service` | `LoadBalancer` → echte load balancer |
| Geschikt voor | Leren, testen, ontwikkelen | Productie |

> [!NOTE]
> De **manifests** zijn bijna identiek. Wat op Minikube werkt, werkt in de cloud. Enkel de manier waarop je de app van buitenaf bereikt verschilt.

---

## 2. Installatie en starten

Je hebt **Docker Desktop** (of Docker Engine op Linux) nodig: Minikube draait zelf als container.

| OS | Minikube | kubectl |
|---|---|---|
| macOS | `brew install minikube` | `brew install kubectl` |
| Windows | `winget install Kubernetes.minikube` | `winget install -e --id Kubernetes.kubectl` |
| Linux | zie [minikube start](https://minikube.sigs.k8s.io/docs/start/) | zie [kubectl install](https://kubernetes.io/docs/tasks/tools/) |

> [!TIP]
> Geen kubectl apart geïnstalleerd? `minikube kubectl -- get pods` werkt ook: Minikube downloadt dan de juiste versie.

```bash
minikube start --driver=docker --cpus=2 --memory=4096
```

```
😄  minikube v1.3x on Darwin
✨  Using the docker driver based on user configuration
👍  Starting "minikube" primary control-plane node in "minikube" cluster
🔥  Creating docker container (CPUs=2, Memory=4096MB) ...
🐳  Preparing Kubernetes v1.3x on Docker ...
🏄  Done! kubectl is now configured to use "minikube" cluster
```

Controleren:

```bash
minikube status
kubectl get nodes
```

```
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   1m    v1.3x
```

> [!WARNING]
> **Kwam je uit Les 6a?** Staat `KUBECONFIG` nog op je Linode-bestand, dan praat `kubectl` met de cloud en niet met Minikube. Check met `kubectl config current-context` (moet `minikube` zijn) of doe `unset KUBECONFIG`. Zie [Minikube én cloud cluster tegelijk](kubernetes-cloud-start.md#minikube-én-cloud-cluster-tegelijk).

---

## 3. De applicatie

Een eenvoudige asiel-app: je ziet een lijst dieren en kan er een toevoegen.

| Service | Technologie | Poort | Image |
|---|---|---|---|
| **frontend** | Express + HTML/JS | 3000 | `dimilan/pet-shelter-frontend` (zelf bouwen) |
| **backend** | Node.js REST API (`GET`/`POST /api/pets`) | 5000 | `dimilan/pet-shelter-backend` (zelf bouwen) |
| **mongodb** | MongoDB | 27017 | `mongo:7` (officieel) |

### Hoe het verkeer loopt

```mermaid
graph LR
    B[🌐 Browser] -->|NodePort 32500| FS[frontend-service<br/>NodePort]
    FS --> F[frontend pod<br/>:3000]
    F -->|BACKEND_URL<br/>http://backend-service:5000| BS[backend-service<br/>ClusterIP]
    BS --> BE[backend pod<br/>:5000]
    BE -->|MONGO_HOST<br/>mongodb-service:27017| MS[mongodb-service<br/>ClusterIP]
    MS --> M[(mongodb pod<br/>:27017)]
```

> [!IMPORTANT]
> **De browser praat enkel met de frontend.** De pagina vraagt `/api/pets` op aan de frontend-server, en die stuurt het verzoek door naar de backend. Daarom mag de backend een `ClusterIP`-service hebben: hij hoeft niet van buitenaf bereikbaar te zijn. Dat is veiliger: enkel de frontend staat open.

### Waar komt de configuratie vandaan?

```mermaid
graph LR
    S[🔐 Secret<br/>mongodb-secret<br/>username, password] --> M[mongodb]
    S --> BE[backend]
    C[⚙️ ConfigMap<br/>mongodb-config<br/>database-url, -port, -name] --> BE
    BE -->|bouwt| URL["mongodb://admin:password@<br/>mongodb-service:27017/petshelter<br/>?authSource=admin"]
```

- MongoDB maakt bij de eerste start een root-gebruiker aan met de gegevens uit de **Secret**.
- De backend gebruikt **dezelfde Secret** om in te loggen, en de **ConfigMap** om te weten wáár de database staat.
- Bij de eerste verbinding vult de backend de database met 4 voorbeelddieren (*seeding*).

### Projectstructuur

```
PetShelter-minimal/
├── frontend/              Express server + public/index.html + Dockerfile
├── backend/               REST API (mongoose) + Dockerfile
├── k8s/
│   ├── mongodb-secret.yaml
│   ├── mongodb-configmap.yaml
│   ├── mongodb-deployment.yaml     (Deployment + Service)
│   ├── backend-deployment.yaml     (Deployment + Service)
│   └── frontend-deployment.yaml    (Deployment + Service)
└── docker-compose.yml     dezelfde app met Docker Compose
```

> [!TIP]
> Vergelijk `docker-compose.yml` met de map `k8s/`. Elke Compose-`service` wordt hier een **Deployment** (draai de container) plus een **Service** (maak hem bereikbaar). De `environment:`-regels worden een **Secret** en een **ConfigMap**.

---

## 4. De manifests één voor één

### 4.1 Secret – de wachtwoorden

**k8s/mongodb-secret.yaml**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mongodb-secret
type: Opaque
data:
  username: YWRtaW4=        # "admin" in base64
  password: cGFzc3dvcmQ=    # "password" in base64
```

```bash
echo -n 'admin' | base64              # YWRtaW4=
echo 'cGFzc3dvcmQ=' | base64 --decode  # password
```

> [!CAUTION]
> **base64 is geen encryptie!** Iedereen die het bestand ziet, kan het decoderen. Een Secret zorgt er wel voor dat Kubernetes de waarde apart bewaart en enkel aan pods geeft die erom vragen. Echte wachtwoorden horen **niet in Git**: maak ze dan rechtstreeks aan:
>
> ```bash
> kubectl create secret generic mongodb-secret \
>   --from-literal=username=admin --from-literal=password='iets-sterks'
> ```

### 4.2 ConfigMap – de niet-geheime instellingen

**k8s/mongodb-configmap.yaml**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mongodb-config
data:
  database-url: mongodb-service   # = naam van de MongoDB Service
  database-port: "27017"          # waarden zijn altijd strings
  database-name: petshelter
```

`database-url` is gewoon de **naam van een Service**. Kubernetes heeft een ingebouwde DNS: elke Service is bereikbaar via haar naam (voluit `mongodb-service.default.svc.cluster.local`). Geen IP-adressen nodig.

### 4.3 MongoDB – Deployment + Service

**k8s/mongodb-deployment.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongodb
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
      - name: mongodb
        image: mongo:7
        ports:
        - containerPort: 27017
        env:
        - name: MONGO_INITDB_ROOT_USERNAME
          valueFrom:
            secretKeyRef:            # waarde uit de Secret halen
              name: mongodb-secret
              key: username
        - name: MONGO_INITDB_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mongodb-secret
              key: password
---
apiVersion: v1
kind: Service
metadata:
  name: mongodb-service
spec:
  selector:
    app: mongodb
  ports:
  - port: 27017
    targetPort: 27017
```

- `---` scheidt twee objecten in één bestand.
- Geen `type:` bij de Service → standaard **ClusterIP**: enkel bereikbaar binnen de cluster. Precies wat je wil voor een database.

### 4.4 Backend – Deployment + Service

**k8s/backend-deployment.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 1
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
        image: dimilan/pet-shelter-backend:latest
        imagePullPolicy: Never        # gebruik het image dat je in Minikube bouwde
        ports:
        - containerPort: 5000
        env:
        - name: MONGO_USERNAME
          valueFrom:
            secretKeyRef:
              name: mongodb-secret
              key: username
        - name: MONGO_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mongodb-secret
              key: password
        - name: MONGO_HOST
          valueFrom:
            configMapKeyRef:          # waarde uit de ConfigMap halen
              name: mongodb-config
              key: database-url
        - name: MONGO_PORT
          valueFrom:
            configMapKeyRef:
              name: mongodb-config
              key: database-port
        - name: MONGO_DATABASE
          valueFrom:
            configMapKeyRef:
              name: mongodb-config
              key: database-name
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  selector:
    app: backend
  ports:
  - port: 5000
    targetPort: 5000
```

De backend zet die vijf variabelen samen tot de connection string:

```javascript
// backend/server.js
MONGO_URL = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}?authSource=admin`;
// → mongodb://admin:password@mongodb-service:27017/petshelter?authSource=admin
```

> [!NOTE]
> **Waarom `imagePullPolicy: Never`?** Bij tag `:latest` probeert Kubernetes standaard altijd te downloaden van Docker Hub. Met `Never` gebruikt Minikube het image dat je zelf in Minikube hebt gebouwd ([stap 5](#5-images-bouwen-in-minikube)). Dat werkt op elke laptop, ook als het image op Docker Hub voor een andere processorarchitectuur gebouwd is.

### 4.5 Frontend – Deployment + Service

**k8s/frontend-deployment.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: 1
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
        image: dimilan/pet-shelter-frontend:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 3000
        env:
        - name: BACKEND_URL
          value: http://backend-service:5000   # Service naam = DNS naam
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
spec:
  type: NodePort
  selector:
    app: frontend
  ports:
  - port: 3000
    targetPort: 3000
    nodePort: 32500
```

> [!IMPORTANT]
> Zonder `BACKEND_URL` gebruikt de frontend `http://localhost:5000`. In een pod is `localhost` de pod **zelf**: de frontend vindt de backend niet en toont geen dieren.

### De drie poorten van een NodePort-service

```mermaid
graph LR
    B[🌐 Browser<br/>buiten de cluster] -->|nodePort 32500| S[frontend-service]
    O[andere pods<br/>binnen de cluster] -->|port 3000<br/>frontend-service:3000| S
    S -->|targetPort 3000| P[frontend container]
```

| Veld | Waar | Wie gebruikt het |
|---|---|---|
| `nodePort` (30000–32767) | Op elke node | Verkeer van **buiten** de cluster |
| `port` | Op de Service | Andere pods: `http://frontend-service:3000` |
| `targetPort` | In de container | Waar de app echt luistert |

---

## 5. Images bouwen in Minikube

Minikube heeft een **eigen Docker daemon**, los van die op je laptop. Images die je gewoon met `docker build` maakt, ziet Minikube niet. Bouw ze dus **in** Minikube:

```bash
# Laat je docker-commando's naar Minikube wijzen (enkel voor deze terminal)
eval $(minikube docker-env)                                          # macOS / Linux
# & minikube -p minikube docker-env --shell powershell | Invoke-Expression   # Windows PowerShell

docker build -t dimilan/pet-shelter-backend:latest backend/
docker build -t dimilan/pet-shelter-frontend:latest frontend/

docker images | grep pet-shelter     # staan ze er?
```

```mermaid
graph LR
    subgraph Laptop
        CLI[docker CLI]
        D1[Docker Desktop daemon]
    end
    subgraph Minikube
        D2[Minikube daemon<br/>images hier gebouwd ✅]
        K[kubelet]
    end
    CLI -.->|zonder docker-env| D1
    CLI ==>|na eval minikube docker-env| D2
    K -->|imagePullPolicy: Never| D2
```

> [!TIP]
> **Alternatief zonder `docker-env`**, werkt in elke shell:
>
> ```bash
> minikube image build -t dimilan/pet-shelter-backend:latest backend/
> minikube image build -t dimilan/pet-shelter-frontend:latest frontend/
> minikube image ls | grep pet-shelter
> ```

---

## 6. Deployen

De volgorde is belangrijk: een pod die een Secret of ConfigMap gebruikt, start niet zolang die niet bestaat.

```mermaid
graph LR
    A[1. Secret] --> B[2. ConfigMap] --> C[3. MongoDB] --> D[4. Backend] --> E[5. Frontend]
```

```bash
kubectl apply -f k8s/mongodb-secret.yaml
kubectl apply -f k8s/mongodb-configmap.yaml
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

kubectl get pods --watch      # Ctrl+C als alles Running en 1/1 is
```

Of alles in één keer: `kubectl apply -f k8s/`. Kubernetes lost de volgorde dan vanzelf op: pods die nog moeten wachten, proberen het gewoon opnieuw.

> [!NOTE]
> Het kan gebeuren dat de **backend één of twee keer herstart** (`RESTARTS 1`). Hij startte toen MongoDB nog niet klaar was, crashte, en Kubernetes herstartte hem. Dat is *self-healing* in actie, geen fout.

### Controleren

```bash
kubectl get all
```

```
NAME                            READY   STATUS    RESTARTS   AGE
pod/backend-6c9d8e7f5-abc34     1/1     Running   0          4m
pod/frontend-8a1b2c3d4-def56    1/1     Running   0          2m
pod/mongodb-7d8f9b6c5-xyz12     1/1     Running   0          7m

NAME                       TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)          AGE
service/backend-service    ClusterIP   10.96.100.30   <none>        5000/TCP         4m
service/frontend-service   NodePort    10.96.100.40   <none>        3000:32500/TCP   2m
service/kubernetes         ClusterIP   10.96.0.1      <none>        443/TCP          30m
service/mongodb-service    ClusterIP   10.96.100.20   <none>        27017/TCP        7m

NAME                       READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/backend    1/1     1            1           4m
deployment.apps/frontend   1/1     1            1           2m
deployment.apps/mongodb    1/1     1            1           7m
```

```bash
kubectl logs -l app=backend
```

```
Connecting to MongoDB...
Server running on port 5000
Connected to MongoDB
Database seeded with initial pets
```

---

## 7. De applicatie openen

| Methode | Commando | Wanneer |
|---|---|---|
| **minikube service** (aanbevolen) | `minikube service frontend-service` | Werkt overal, opent je browser |
| **port-forward** | `kubectl port-forward service/frontend-service 8080:3000` → http://localhost:8080 | Werkt overal, ook voor één specifieke pod |
| **Minikube IP + NodePort** | `http://$(minikube ip):32500` | Enkel **Linux**, of een VM-driver |

> [!WARNING]
> Op **macOS en Windows met de Docker-driver** kan je het Minikube-IP niet rechtstreeks bereiken: `http://192.168.49.2:32500` laadt niet. Gebruik `minikube service`. Dat opent een tunnel; laat die terminal open zolang je de app gebruikt.

```bash
minikube service frontend-service --url     # enkel de URL tonen
```

### Uitproberen

1. Je ziet 4 dieren (Max, Bella, Charlie, Luna): die zijn door de backend gezaaid.
2. Voeg een dier toe via het formulier en ververs de pagina.
3. Test de API rechtstreeks:

```bash
kubectl port-forward service/backend-service 5000:5000
# andere terminal:
curl http://localhost:5000/api/pets
```

> [!TIP]
> Op een Mac is poort 5000 vaak bezet door AirPlay. Gebruik dan bv. `5100:5000` en `curl http://localhost:5100/api/pets`.

---

## 8. Kijken wat er gebeurt

### De basiscommando's

| Vraag | Commando |
|---|---|
| Wat draait er? | `kubectl get all` · `kubectl get pods -o wide` |
| Waarom start deze pod niet? | `kubectl describe pod <pod>` → **Events** onderaan |
| Wat zegt de app? | `kubectl logs <pod>` · `kubectl logs -l app=backend` · `-f` om te volgen |
| Waarom crashte hij net? | `kubectl logs <pod> --previous` |
| Wat gebeurt er in de cluster? | `kubectl get events --sort-by=.lastTimestamp` |
| Naar welke pods stuurt een Service? | `kubectl get endpoints` |
| Wat staat er in mijn config? | `kubectl get configmap mongodb-config -o yaml` |

> [!TIP]
> Je hoeft geen podnamen over te typen: `kubectl logs deploy/backend` en `kubectl exec -it deploy/backend -- sh` kiezen zelf een pod van die Deployment.

### In een pod kijken

```bash
# Welke variabelen kreeg de backend mee?
kubectl exec deploy/backend -- env | grep MONGO

# Vindt de backend de database via DNS?
kubectl exec deploy/backend -- nslookup mongodb-service

# Kan de frontend de backend bereiken?
kubectl exec deploy/frontend -- wget -qO- http://backend-service:5000/api/pets

# Rechtstreeks in de database kijken
kubectl exec -it deploy/mongodb -- mongosh -u admin -p password
#   use petshelter
#   db.pets.find()
#   exit
```

### Dashboard en resource-gebruik

```bash
minikube dashboard                       # grafisch overzicht in je browser

minikube addons enable metrics-server    # eenmalig, daarna ±1 minuut wachten
kubectl top pods
kubectl top nodes
```

---

## 9. Troubleshooting

Begin altijd met `kubectl get pods`: de **STATUS** vertelt je waar je moet zoeken.

```mermaid
graph TD
    A[kubectl get pods] --> B{STATUS?}
    B -->|Pending| P[kubectl describe pod<br/>→ Events]
    B -->|ErrImageNeverPull<br/>ErrImagePull<br/>ImagePullBackOff| I[Image probleem]
    B -->|CreateContainerConfigError| C[Secret of ConfigMap<br/>ontbreekt of verkeerde key]
    B -->|CrashLoopBackOff| L[kubectl logs --previous]
    B -->|Running 1/1| R{Werkt de app?}
    R -->|Nee| E[kubectl get endpoints<br/>+ testen vanuit pod]
    R -->|Ja| OK[✅]
```

| STATUS | Oorzaak | Oplossing |
|---|---|---|
| `ErrImageNeverPull` | Image niet in Minikube gebouwd (of in een andere terminal zonder `docker-env`) | [Stap 5](#5-images-bouwen-in-minikube) opnieuw, daarna `kubectl rollout restart deployment/<naam>` |
| `ErrImagePull` / `ImagePullBackOff` | Typfout in imagenaam, of image bestaat niet op Docker Hub | `kubectl describe pod` → Events, imagenaam nakijken |
| `CreateContainerConfigError` | Secret/ConfigMap bestaat niet, of de `key` klopt niet | `kubectl get secret,configmap`; namen vergelijken met het manifest; daarna opnieuw `apply` |
| `Pending` | Te weinig CPU/geheugen in Minikube | `kubectl describe pod` → *Insufficient memory*; zie hieronder |
| `CrashLoopBackOff` | De app zelf crasht | `kubectl logs <pod> --previous` |
| `Running`, maar geen dieren | Frontend vindt de backend niet | `BACKEND_URL` nakijken; `kubectl logs -l app=frontend` |

### De backend crasht (`CrashLoopBackOff`)

```bash
kubectl logs deploy/backend --previous
```

| In de logs | Betekenis |
|---|---|
| `MongooseServerSelectionError ... ENOTFOUND mongodb-service` | MongoDB Service bestaat niet of heeft een andere naam → `kubectl get svc` |
| `MongooseServerSelectionError ... ECONNREFUSED` | MongoDB draait (nog) niet → `kubectl get pods -l app=mongodb` |
| `Authentication failed` | Gebruiker/wachtwoord van backend en MongoDB verschillen → zie hieronder |

### Wachtwoord gewijzigd, nu `Authentication failed`?

MongoDB maakt de root-gebruiker enkel aan bij een **lege** database. Pas je de Secret aan, dan moeten beide pods opnieuw starten om de nieuwe waarden te lezen:

```bash
kubectl apply -f k8s/mongodb-secret.yaml
kubectl rollout restart deployment/mongodb deployment/backend
```

Zonder volume (zie [10.3](#103-data-bewaren-met-een-persistentvolumeclaim)) begint MongoDB bij een herstart met een lege database, dus dat werkt. **Mét volume** blijft de oude gebruiker bestaan: verwijder dan ook de PVC of pas het wachtwoord in MongoDB zelf aan.

### Pods blijven `Pending`

Een bestaande Minikube cluster krijgt niet meer geheugen door enkel te herstarten. Je moet hem opnieuw aanmaken:

```bash
minikube delete
minikube start --driver=docker --cpus=4 --memory=6144
```

Daarna images opnieuw bouwen (stap 5) en deployen (stap 6).

### Service bereikbaar maar geen antwoord

```bash
kubectl get endpoints frontend-service backend-service mongodb-service
```

Een lege `ENDPOINTS`-kolom betekent: de **selector** van de Service vindt geen pods met dat label. Vergelijk `spec.selector` van de Service met `template.metadata.labels` van de Deployment: `kubectl get pods --show-labels`.

---

## 10. Schalen, updaten, data bewaren

### 10.1 Schalen

```bash
kubectl scale deployment frontend --replicas=3
kubectl get pods -l app=frontend
```

De `frontend-service` verdeelt het verkeer nu over 3 pods. Probeer: `kubectl delete pod <een-frontend-pod>` en kijk hoe er meteen een nieuwe komt.

> [!WARNING]
> Schaal **MongoDB niet** zomaar op. Drie losse database-pods zijn drie aparte databases met elk hun eigen data. Een gerepliceerde database vraagt een **StatefulSet** en database-replicatie. Dat valt buiten deze les.

### 10.2 Een nieuwe versie uitrollen

Pas bv. de titel aan in `frontend/public/index.html` en bouw met een **nieuwe tag**:

```bash
eval $(minikube docker-env)
docker build -t dimilan/pet-shelter-frontend:v2 frontend/

kubectl set image deployment/frontend frontend=dimilan/pet-shelter-frontend:v2
kubectl rollout status deployment/frontend
```

Niet goed? Terug:

```bash
kubectl rollout history deployment/frontend
kubectl rollout undo deployment/frontend
```

> [!NOTE]
> `frontend=...` in `set image` is de naam van de **container** (`containers[].name`), niet die van de Deployment. Hier zijn ze toevallig gelijk.

### 10.3 Data bewaren met een PersistentVolumeClaim

Verwijder de MongoDB-pod en kijk wat er gebeurt:

```bash
kubectl delete pod -l app=mongodb
```

De nieuwe pod start met een **lege** database: alle dieren zijn weg, ook de 4 voorbeelden (de backend zaait enkel als hij zelf opstart: `kubectl rollout restart deployment/backend`). De bestanden van een container verdwijnen samen met de container, net als in Docker.

```mermaid
graph LR
    P[mongodb pod] -->|volumeMount<br/>/data/db| V[volume]
    V -->|claimName| PVC[PersistentVolumeClaim<br/>mongodb-pvc 1Gi]
    PVC -->|automatisch aangemaakt| PV[(PersistentVolume<br/>schijf in Minikube)]
```

Vraag opslag aan met een **PersistentVolumeClaim** (PVC) en koppel ze aan `/data/db`. Voeg dit toe aan `k8s/mongodb-deployment.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-pvc
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
# in de Deployment, onder spec.template.spec:
      containers:
      - name: mongodb
        # ... zoals voorheen ...
        volumeMounts:
        - name: mongodb-data
          mountPath: /data/db
      volumes:
      - name: mongodb-data
        persistentVolumeClaim:
          claimName: mongodb-pvc
```

```bash
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl get pvc          # STATUS Bound
```

Minikube maakt de opslag automatisch aan. In de cloud doet de cloudprovider dat (bij Linode: een **Volume**, dat apart betaald wordt).

---

## 11. Opruimen

```bash
kubectl delete -f k8s/      # alle objecten van de app
minikube stop               # cluster pauzeren, alles blijft bewaard
minikube delete             # cluster volledig verwijderen
```

---

## 12. Samenvatting & cheatsheet

```mermaid
graph TB
    subgraph Config
        S[Secret]
        C[ConfigMap]
    end
    subgraph App
        FD[Deployment frontend] --> FP[Pod]
        BD[Deployment backend] --> BP[Pod]
        MD[Deployment mongodb] --> MP[Pod]
    end
    FS[Service NodePort<br/>frontend-service] --> FP
    BS[Service ClusterIP<br/>backend-service] --> BP
    MS[Service ClusterIP<br/>mongodb-service] --> MP
    S -.-> BP
    S -.-> MP
    C -.-> BP
    FP -->|http://backend-service:5000| BS
    BP -->|mongodb-service:27017| MS
```

| Docker Compose | Kubernetes |
|---|---|
| `services: backend:` | **Deployment** `backend` + **Service** `backend-service` |
| `image:` / `build:` | `image:` (vooraf gebouwd en beschikbaar voor de cluster) |
| `environment:` met wachtwoorden | **Secret** + `secretKeyRef` |
| `environment:` met instellingen | **ConfigMap** + `configMapKeyRef` |
| `ports: "3000:3000"` | Service `type: NodePort` / `LoadBalancer` |
| Servicenaam als hostnaam | Servicenaam als DNS-naam |
| `volumes:` | **PersistentVolumeClaim** |
| `depends_on:` | Bestaat niet: pods herstarten tot hun afhankelijkheden er zijn |

| Minikube | |
|---|---|
| `minikube start` / `stop` / `delete` | Cluster beheren |
| `eval $(minikube docker-env)` | Docker CLI naar Minikube laten wijzen |
| `minikube image build -t <img> <map>` | Image bouwen in Minikube |
| `minikube service <svc>` | NodePort-service openen in de browser |
| `minikube dashboard` | Grafisch dashboard |

| kubectl | |
|---|---|
| `kubectl apply -f k8s/` | Alles aanmaken of bijwerken |
| `kubectl get all` / `get pods -w` | Overzicht / live volgen |
| `kubectl describe pod <pod>` | Details + Events |
| `kubectl logs deploy/<naam> [--previous]` | Logs |
| `kubectl exec -it deploy/<naam> -- sh` | Shell in een pod |
| `kubectl port-forward svc/<svc> <lokaal>:<poort>` | Tijdelijk bereikbaar maken |
| `kubectl scale deployment <naam> --replicas=N` | Schalen |
| `kubectl set image` / `rollout status` / `rollout undo` | Updaten en terugdraaien |
| `kubectl rollout restart deployment/<naam>` | Pods opnieuw starten (bv. na een gewijzigde Secret) |

### Volgende stappen

- **Naar de cloud:** dezelfde manifests op een cloud cluster ([Les 6a](kubernetes-cloud-start.md)). Verander `frontend-service` naar `type: LoadBalancer`, haal `imagePullPolicy: Never` weg en push je images **multi-platform** naar Docker Hub.
- **Helm:** deze manifests ombouwen tot een herbruikbare chart: [Les 7 – Helm PetShelter migratie](../07-Helm/helm-petshelter.md).
- **Ingress:** meerdere services achter één ingang, met HTTPS: [Les 8](../08-Ingress-and-Reverse-Proxies/).

### Bronnen

- [Minikube documentatie](https://minikube.sigs.k8s.io/docs/)
- [kubectl cheat sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Pet Shelter Backend](https://hub.docker.com/r/dimilan/pet-shelter-backend) · [Frontend](https://hub.docker.com/r/dimilan/pet-shelter-frontend) op Docker Hub
