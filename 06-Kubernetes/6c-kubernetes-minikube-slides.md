---
marp: true
theme: gaia
paginate: true
header: 'Les 6c – Kubernetes met Minikube'
footer: 'DevOps & Cloud Infrastructure'
---

<!-- _class: lead -->

# ☸️ Les 6c — Kubernetes met Minikube

3-tier Pet Shelter op je eigen laptop

Volledige uitgewerkte notities: [6c-kubernetes-minikube.md](6c-kubernetes-minikube.md)

---

## Les 6 in drie delen

<style scoped>table { font-size: 26px; }</style>

| | Bestand | Wat |
|---|---|---|
| **6a** | `6a-kubernetes-cloud.md` | Website op een **cloud cluster** (Linode) |
| **6b** | `6b-kubernetes-fundamentals.md` | De **bouwstenen**: pods, services, config, opslag |
| **6c** ← vandaag | `6c-kubernetes-minikube.md` | **3-tier app** lokaal op Minikube |

```bash
git clone https://github.com/MilanVives/PetShelter-minimal.git
```

---

## Agenda

1. Minikube
2. De applicatie
3. Manifests
4. Images bouwen in Minikube
5. Deployen en openen
6. Debuggen & troubleshooting
7. Schalen, updaten, data bewaren

---

<!-- _class: lead -->

## 1. Minikube

---

## Een cluster op je laptop

<style scoped>section { font-size: 26px; }</style>

![bg right:50% contain](images/6c-minikube.png)

- **Eén node**: control plane + worker samen
- Draait als Docker-container
- Gratis, enkel lokaal bereikbaar

```bash
minikube start --driver=docker \
  --cpus=2 --memory=4096
kubectl get nodes
```

---

## Minikube vs cloud (6a)

| | Minikube | Cloud |
|---|---|---|
| Nodes | 1 | 3+ |
| Kost | Gratis | Per uur |
| Bereikbaar | Je laptop | Internet |
| Van buiten | `NodePort`, `minikube service` | `LoadBalancer` |

Manifests zijn **bijna identiek**

⚠️ `KUBECONFIG` nog op Linode? → `unset KUBECONFIG`

---

<!-- _class: lead -->

## 2. De applicatie

---

## Pet Shelter: drie services

| Service | Wat | Poort |
|---|---|---|
| **frontend** | Express + HTML/JS | 3000 |
| **backend** | REST API `/api/pets` | 5000 |
| **mongodb** | Database (`mongo:7`) | 27017 |

Zelfde app als in `docker-compose.yml`

---

## Hoe het verkeer loopt

![w:1100](images/6c-verkeer-slide.png)

**De browser praat enkel met de frontend.**
De frontend-server stuurt `/api/pets` door naar de backend.

→ backend en database blijven `ClusterIP`: niet van buiten bereikbaar

---

## Waar komt de configuratie vandaan?

![h:300](images/6c-configuratie.png)

Zelfde **Secret** voor MongoDB en backend · **ConfigMap** = waar staat de database

---

## Van Compose naar Kubernetes

<style scoped>table { font-size: 24px; }</style>

| Docker Compose | Kubernetes |
|---|---|
| `services: backend:` | **Deployment** + **Service** |
| `environment:` (wachtwoorden) | **Secret** |
| `environment:` (instellingen) | **ConfigMap** |
| `ports: "3000:3000"` | Service `NodePort` / `LoadBalancer` |
| Servicenaam als hostnaam | Servicenaam als **DNS-naam** |
| `volumes:` | **PersistentVolumeClaim** |
| `depends_on:` | Bestaat niet: pods herstarten tot het lukt |

---

<!-- _class: lead -->

## 3. Manifests

---

## Secret en ConfigMap

<style scoped>pre { font-size: 0.75em; }</style>

```yaml
kind: Secret
metadata: { name: mongodb-secret }
data:
  username: YWRtaW4=        # "admin" in base64
  password: cGFzc3dvcmQ=    # "password"
---
kind: ConfigMap
metadata: { name: mongodb-config }
data:
  database-url: mongodb-service   # = naam van een Service!
  database-port: "27017"
  database-name: petshelter
```

⚠️ base64 ≠ encryptie

---

## Backend: waarden ophalen

<style scoped>pre { font-size: 0.8em; }</style>

```yaml
containers:
- name: backend
  image: dimilan/pet-shelter-backend:latest
  imagePullPolicy: Never              # zelf gebouwd in Minikube
  env:
  - name: MONGO_PASSWORD
    valueFrom:
      secretKeyRef:    { name: mongodb-secret, key: password }
  - name: MONGO_HOST
    valueFrom:
      configMapKeyRef: { name: mongodb-config, key: database-url }
```

→ `mongodb://admin:password@mongodb-service:27017/petshelter`

---

## Frontend: vergeet `BACKEND_URL` niet

```yaml
env:
- name: BACKEND_URL
  value: http://backend-service:5000
```

Zonder: frontend zoekt `localhost:5000`
In een pod = **de pod zelf** → geen dieren 🐾

---

## De drie poorten van een NodePort

<style scoped>table { font-size: 24px; }</style>

![h:210](images/6c-nodeport-poorten.png)

| Veld | Wie gebruikt het |
|---|---|
| `nodePort: 32500` | Verkeer van **buiten** |
| `port: 3000` | Andere pods |
| `targetPort: 3000` | Waar de app luistert |

---

<!-- _class: lead -->

## 4. Images bouwen in Minikube

---

## Minikube heeft een eigen Docker

![h:190](images/6c-docker-env-slide.png)

```bash
eval $(minikube docker-env)       # PowerShell: zie notities
docker build -t dimilan/pet-shelter-backend:latest backend/
docker build -t dimilan/pet-shelter-frontend:latest frontend/
```

Of: `minikube image build -t <image> <map>`

---

## Waarom `imagePullPolicy: Never`?

- Tag `:latest` → standaard **altijd** pullen van Docker Hub
- `Never` → gebruik het image **in Minikube**
- Werkt op elke laptop (arm64 én amd64)

Build vergeten? → `ErrImageNeverPull`

---

<!-- _class: lead -->

## 5. Deployen en openen

---

## De volgorde

![w:1150](images/6c-volgorde.png)

```bash
kubectl apply -f k8s/mongodb-secret.yaml
kubectl apply -f k8s/mongodb-configmap.yaml
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl get pods --watch
```

Backend 1× herstart? MongoDB was nog niet klaar → **self-healing**

---

## Controleren

```bash
kubectl get all
kubectl logs -l app=backend
```

```
Connecting to MongoDB...
Server running on port 5000
Connected to MongoDB
Database seeded with initial pets
```

---

## De app openen

| Methode | Werkt op |
|---|---|
| `minikube service frontend-service` | Overal ✅ |
| `kubectl port-forward svc/frontend-service 8080:3000` | Overal ✅ |
| `http://$(minikube ip):32500` | Enkel Linux |

⚠️ macOS/Windows + Docker-driver: Minikube-IP is **niet** bereikbaar.
Terminal van `minikube service` open laten!

---

<!-- _class: lead -->

## 6. Debuggen & troubleshooting

---

## Kijken wat er gebeurt

<style scoped>table { font-size: 24px; }</style>

| Vraag | Commando |
|---|---|
| Wat draait er? | `kubectl get all` |
| Waarom start hij niet? | `kubectl describe pod <pod>` → **Events** |
| Wat zegt de app? | `kubectl logs deploy/backend` |
| Waarom crashte hij? | `kubectl logs <pod> --previous` |
| Welke pods achter een Service? | `kubectl get endpoints` |
| Shell in een pod | `kubectl exec -it deploy/backend -- sh` |

---

## Vanuit een pod testen

```bash
kubectl exec deploy/backend  -- env | grep MONGO
kubectl exec deploy/backend  -- nslookup mongodb-service
kubectl exec deploy/frontend -- wget -qO- http://backend-service:5000/api/pets
kubectl exec -it deploy/mongodb -- mongosh -u admin -p password
```

`minikube dashboard` → grafisch overzicht

---

## Status → oorzaak

<style scoped>table { font-size: 22px; }</style>

| STATUS | Oorzaak | Oplossing |
|---|---|---|
| `ErrImageNeverPull` | Niet in Minikube gebouwd | Bouwen + `rollout restart` |
| `ImagePullBackOff` | Typfout in imagenaam | `describe pod` → Events |
| `CreateContainerConfigError` | Secret/ConfigMap of key ontbreekt | Namen vergelijken |
| `Pending` | Te weinig geheugen | `minikube delete` + groter `start` |
| `CrashLoopBackOff` | App crasht | `logs --previous` |
| Running, geen dieren | Frontend vindt backend niet | `BACKEND_URL` |

---

<!-- _class: lead -->

## 7. Schalen, updaten, data bewaren

---

## Schalen

```bash
kubectl scale deployment frontend --replicas=3
kubectl delete pod <een-frontend-pod>     # komt meteen terug
```

⚠️ MongoDB **niet** zomaar opschalen: 3 pods = 3 aparte databases → StatefulSet

---

## Nieuwe versie uitrollen

```bash
eval $(minikube docker-env)
docker build -t dimilan/pet-shelter-frontend:v2 frontend/
kubectl set image deployment/frontend \
  frontend=dimilan/pet-shelter-frontend:v2
kubectl rollout status deployment/frontend
kubectl rollout undo   deployment/frontend    # oeps!
```

`frontend=` = naam van de **container**

---

## Data bewaren

```bash
kubectl delete pod -l app=mongodb     # → alle dieren weg!
```

![w:1150](images/6c-pvc.png)

**PersistentVolumeClaim** op `/data/db` → data overleeft de pod
(zie notities 10.3 voor de YAML)

---

## Opruimen

```bash
kubectl delete -f k8s/     # de app
minikube stop              # pauzeren
minikube delete            # helemaal weg
```

---

## Samenvatting

![w:1150](images/6-3-tier-slide.png)

Deployment + Service per tier · Secret & ConfigMap voor config · PVC voor data

---

## Volgende stappen

- **Naar de cloud** (6a): `LoadBalancer`, `imagePullPolicy` weg, images **multi-platform** pushen
- **Helm** (Les 7): deze manifests als herbruikbare chart
- **Ingress** (Les 8): één ingang met HTTPS

PE3: hetzelfde voor **jouw** drie services 🚀
