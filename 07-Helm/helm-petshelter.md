# Migratie van PetShelter naar Helm: Stap voor Stap

## Inhoudsopgave

1. [Introductie](#introductie)
2. [Waarom Helm?](#waarom-helm)
3. [Voorbereiding](#voorbereiding)
4. [Stap 1: Helm Chart Aanmaken](#stap-1-helm-chart-aanmaken)
5. [Stap 2: Chart Metadata Configureren](#stap-2-chart-metadata-configureren)
6. [Stap 3: Values File Ontwerpen](#stap-3-values-file-ontwerpen)
7. [Stap 4: MongoDB Templates](#stap-4-mongodb-templates)
8. [Stap 5: Backend Templates](#stap-5-backend-templates)
9. [Stap 6: Frontend Templates](#stap-6-frontend-templates)
10. [Stap 7: Helper Templates](#stap-7-helper-templates)
11. [Stap 8: Testen en Deployen](#stap-8-testen-en-deployen)
12. [Stap 9: Multi-Environment Setup](#stap-9-multi-environment-setup)
13. [Troubleshooting](#troubleshooting)
14. [Conclusie](#conclusie)

---

## Introductie

In deze tutorial migreren we de **PetShelter 3-tier applicatie** van raw Kubernetes YAML manifests naar een Helm Chart. We nemen de bestaande Kubernetes deployment uit `06-Kubernetes/6c-minikube-demo/k8s/` en transformeren deze naar een herbruikbare, configureerbare Helm Chart.

### Wat Je Leert

- ✅ Raw Kubernetes YAML converteren naar Helm templates
- ✅ Values extracten en parametrizeren
- ✅ Helper templates gebruiken voor herbruikbare code
- ✅ Multi-environment configuratie opzetten
- ✅ Best practices voor Helm chart structuur
- ✅ Helm charts testen en debuggen

### Huidige Applicatie Architectuur

```
┌─────────────────────────────────────────────────────────────┐
│                    PetShelter App                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐     ┌───────────┐ │
│  │  Frontend    │─────>│   Backend    │────>│  MongoDB  │ │
│  │  (Express)   │      │  (Node.js)   │     │ (Database)│ │
│  │  Port: 3000  │      │  Port: 5000  │     │Port: 27017│ │
│  └──────────────┘      └──────────────┘     └───────────┘ │
│         │                      │                    │      │
│         │                      │                    │      │
│  ┌──────────────┐      ┌──────────────┐     ┌───────────┐ │
│  │   Service    │      │   Service    │     │  Service  │ │
│  │  NodePort    │      │  ClusterIP   │     │ ClusterIP │ │
│  │  :32500      │      │  :5000       │     │  :27017   │ │
│  └──────────────┘      └──────────────┘     └───────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ConfigMap: mongodb-config                          │   │
│  │  - database-url, database-port, database-name       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Secret: mongodb-secret                             │   │
│  │  - username, password                               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Waarom Helm?

### Huidige Situatie (Raw YAML)

```bash
# Je moet meerdere commando's uitvoeren in de juiste volgorde:
kubectl apply -f k8s/mongodb-secret.yaml
kubectl apply -f k8s/mongodb-configmap.yaml
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Bij updates:
kubectl apply -f k8s/backend-deployment.yaml

# Bij rollback:
kubectl rollout undo deployment/backend  # Manueel per component
```

**Problemen:**
- ❌ Veel duplicatie tussen environments (dev, staging, prod)
- ❌ Hard-coded waarden (image tags, replica counts, ports)
- ❌ Moeilijk om versies te beheren
- ❌ Geen rollback mechanisme voor hele applicatie
- ❌ Geen dependency management

### Met Helm

```bash
# Installatie met één commando:
helm install petshelter ./petshelter-chart

# Update met nieuwe waarden:
helm upgrade petshelter ./petshelter-chart --set backend.replicas=3

# Rollback van hele applicatie:
helm rollback petshelter 1

# Verschillende environments:
helm install petshelter-dev ./petshelter-chart -f values-dev.yaml
helm install petshelter-prod ./petshelter-chart -f values-prod.yaml
```

**Voordelen:**
- ✅ Één commando voor hele applicatie
- ✅ Configuratie via values files
- ✅ Versiebeheer en rollbacks
- ✅ Herbruikbaar voor meerdere environments
- ✅ Template hergebruik via helpers

---

## Voorbereiding

### Vereisten

```bash
# Controleer of alles geïnstalleerd is
helm version
kubectl version --client
minikube status
```

### Clone de Repository

```bash
git clone https://github.com/MilanVives/PetShelter-minimal.git
cd PetShelter-minimal
```

### Huidige K8s Manifests Bekijken

```bash
ls -la k8s/
# Output:
# backend-deployment.yaml
# frontend-deployment.yaml
# mongodb-configmap.yaml
# mongodb-deployment.yaml
# mongodb-secret.yaml
```

### Bestaande Deployment Verwijderen (Optioneel)

Als je de applicatie al draait in Minikube:

```bash
kubectl delete -f k8s/
```

---

## Stap 1: Helm Chart Aanmaken

### 1.1 Creëer de Chart Structuur

```bash
# Maak een nieuwe Helm chart aan
helm create petshelter-chart

# Bekijk de gegenereerde structuur
tree petshelter-chart
```

**Output:**
```
petshelter-chart/
├── Chart.yaml
├── values.yaml
├── charts/
└── templates/
    ├── NOTES.txt
    ├── _helpers.tpl
    ├── deployment.yaml
    ├── hpa.yaml
    ├── ingress.yaml
    ├── service.yaml
    ├── serviceaccount.yaml
    └── tests/
        └── test-connection.yaml
```

### 1.2 Opschonen van Onnodige Bestanden

De standaard chart bevat veel files die we niet nodig hebben. Laten we opschonen:

```bash
cd petshelter-chart

# Verwijder onnodige templates (we maken onze eigen)
rm templates/deployment.yaml
rm templates/service.yaml
rm templates/serviceaccount.yaml
rm templates/hpa.yaml
rm templates/ingress.yaml
rm -rf templates/tests/

# Behoud alleen
# - Chart.yaml
# - values.yaml
# - templates/_helpers.tpl
# - templates/NOTES.txt
```

### 1.3 Maak Subdirectories voor Organisatie

```bash
# Maak directories per component
mkdir -p templates/mongodb
mkdir -p templates/backend
mkdir -p templates/frontend
```

**Resulterende structuur:**
```
petshelter-chart/
├── Chart.yaml
├── values.yaml
├── charts/
└── templates/
    ├── _helpers.tpl
    ├── NOTES.txt
    ├── mongodb/
    ├── backend/
    └── frontend/
```

---

## Stap 2: Chart Metadata Configureren

### 2.1 Edit Chart.yaml

Open `Chart.yaml` en pas aan:

```yaml
apiVersion: v2
name: petshelter
description: A Helm chart for PetShelter 3-tier application (MongoDB, Node.js Backend, Express Frontend)
type: application
version: 0.1.0
appVersion: "1.0.0"

keywords:
  - petshelter
  - mongodb
  - nodejs
  - express
  - 3-tier

maintainers:
  - name: Milan Vives
    email: milan.vives@example.com

home: https://github.com/MilanVives/PetShelter-minimal

sources:
  - https://github.com/MilanVives/PetShelter-minimal
```

**Uitleg van de velden:**
- `apiVersion`: Helm chart API versie (v2 voor Helm 3)
- `name`: Naam van de chart
- `description`: Beschrijving van wat de chart doet
- `type`: `application` (vs `library`)
- `version`: Chart versie (SemVer)
- `appVersion`: Versie van de applicatie die gedeployed wordt
- `keywords`: Zoektermen voor Artifact Hub
- `maintainers`: Contact informatie
- `home`: Homepage URL
- `sources`: Source code repositories

---

## Stap 3: Values File Ontwerpen

### 3.1 Analyseer de Huidige YAML Bestanden

Laten we identificeren welke waarden we willen parametrizeren:

**MongoDB:**
- Image: `mongo:7`
- Replica count: `1`
- Port: `27017`
- Username: `admin` (base64: `YWRtaW4=`)
- Password: `password` (base64: `cGFzc3dvcmQ=`)
- Database name: `petshelter`

**Backend:**
- Image: `dimilan/pet-shelter-backend:latest`
- Replica count: `1`
- Port: `5000`
- Service type: `ClusterIP`

**Frontend:**
- Image: `dimilan/pet-shelter-frontend:latest`
- Replica count: `1`
- Port: `3000`
- Service type: `NodePort`
- NodePort: `32500`

### 3.2 Ontwerp values.yaml

Vervang de inhoud van `values.yaml`:

```yaml
# Global settings
global:
  nameOverride: ""
  fullnameOverride: ""

# MongoDB Configuration
mongodb:
  enabled: true
  image:
    repository: mongo
    tag: "7"
    pullPolicy: IfNotPresent
  
  replicaCount: 1
  
  service:
    type: ClusterIP
    port: 27017
  
  # Authentication
  auth:
    enabled: true
    rootUsername: admin
    rootPassword: password
    database: petshelter
  
  # Resources (optioneel maar recommended voor productie)
  resources:
    limits:
      memory: "512Mi"
      cpu: "500m"
    requests:
      memory: "256Mi"
      cpu: "250m"
  
  # Persistence (voor productie zou je dit willen)
  persistence:
    enabled: false
    size: 8Gi
    storageClass: ""

# Backend Configuration
backend:
  enabled: true
  image:
    repository: dimilan/pet-shelter-backend
    tag: "latest"
    pullPolicy: IfNotPresent
  
  replicaCount: 1
  
  service:
    type: ClusterIP
    port: 5000
  
  # Environment variables
  env:
    backendUrl: http://backend-service:5000
  
  resources:
    limits:
      memory: "256Mi"
      cpu: "200m"
    requests:
      memory: "128Mi"
      cpu: "100m"

# Frontend Configuration
frontend:
  enabled: true
  image:
    repository: dimilan/pet-shelter-frontend
    tag: "latest"
    pullPolicy: IfNotPresent
  
  replicaCount: 1
  
  service:
    type: NodePort
    port: 3000
    nodePort: 32500
  
  resources:
    limits:
      memory: "128Mi"
      cpu: "100m"
    requests:
      memory: "64Mi"
      cpu: "50m"

# Ingress (voor productie)
ingress:
  enabled: false
  className: nginx
  annotations: {}
    # kubernetes.io/ingress.class: nginx
    # cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: petshelter.local
      paths:
        - path: /
          pathType: Prefix
  tls: []
    # - secretName: petshelter-tls
    #   hosts:
    #     - petshelter.local
```

**Uitleg van de structuur:**
- **Global**: Overschrijvingen voor resource namen
- **Per component** (mongodb, backend, frontend):
  - `enabled`: Mogelijkheid om component aan/uit te zetten
  - `image`: Container image configuratie
  - `replicaCount`: Aantal pods
  - `service`: Service configuratie
  - `resources`: CPU/memory limits en requests
- **Ingress**: Voor productie deployment (optioneel)

---

## Stap 4: MongoDB Templates

### 4.1 MongoDB Secret Template

Maak `templates/mongodb/secret.yaml`:

```yaml
{{- if .Values.mongodb.enabled }}
{{- if .Values.mongodb.auth.enabled }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "petshelter.fullname" . }}-mongodb-secret
  labels:
    {{- include "petshelter.labels" . | nindent 4 }}
    app.kubernetes.io/component: mongodb
type: Opaque
data:
  # Base64 encode de credentials
  username: {{ .Values.mongodb.auth.rootUsername | b64enc | quote }}
  password: {{ .Values.mongodb.auth.rootPassword | b64enc | quote }}
{{- end }}
{{- end }}
```

**Uitleg:**
- `{{- if .Values.mongodb.enabled }}`: Alleen aanmaken als MongoDB enabled is
- `{{ include "petshelter.fullname" . }}`: Gebruik helper voor consistent naming
- `{{ .Values.mongodb.auth.rootUsername | b64enc }}`: Base64 encoding van username
- `{{- include "petshelter.labels" . | nindent 4 }}`: Standard labels via helper
- `app.kubernetes.io/component`: Extra label voor component identificatie

### 4.2 MongoDB ConfigMap Template

Maak `templates/mongodb/configmap.yaml`:

```yaml
{{- if .Values.mongodb.enabled }}
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "petshelter.fullname" . }}-mongodb-config
  labels:
    {{- include "petshelter.labels" . | nindent 4 }}
    app.kubernetes.io/component: mongodb
data:
  database-url: {{ include "petshelter.fullname" . }}-mongodb-service
  database-port: {{ .Values.mongodb.service.port | quote }}
  database-name: {{ .Values.mongodb.auth.database | quote }}
{{- end }}
```

**Uitleg:**
- `database-url`: Dynamisch gegenereerd met fullname helper
- `| quote`: Zorgt ervoor dat de waarde als string opgeslagen wordt

### 4.3 MongoDB Deployment Template

Maak `templates/mongodb/deployment.yaml`:

```yaml
{{- if .Values.mongodb.enabled }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "petshelter.fullname" . }}-mongodb
  labels:
    {{- include "petshelter.labels" . | nindent 4 }}
    app.kubernetes.io/component: mongodb
spec:
  replicas: {{ .Values.mongodb.replicaCount }}
  selector:
    matchLabels:
      {{- include "petshelter.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: mongodb
  template:
    metadata:
      labels:
        {{- include "petshelter.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: mongodb
    spec:
      containers:
      - name: mongodb
        image: "{{ .Values.mongodb.image.repository }}:{{ .Values.mongodb.image.tag }}"
        imagePullPolicy: {{ .Values.mongodb.image.pullPolicy }}
        ports:
        - name: mongodb
          containerPort: {{ .Values.mongodb.service.port }}
          protocol: TCP
        {{- if .Values.mongodb.auth.enabled }}
        env:
        - name: MONGO_INITDB_ROOT_USERNAME
          valueFrom:
            secretKeyRef:
              name: {{ include "petshelter.fullname" . }}-mongodb-secret
              key: username
        - name: MONGO_INITDB_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: {{ include "petshelter.fullname" . }}-mongodb-secret
              key: password
        {{- end }}
        {{- with .Values.mongodb.resources }}
        resources:
          {{- toYaml . | nindent 10 }}
        {{- end }}
{{- end }}
```

**Uitleg:**
- `{{- with .Values.mongodb.resources }}`: Alleen resources block toevoegen als gedefinieerd
- `{{- toYaml . | nindent 10 }}`: Converteer resources object naar YAML met correcte indenting
- Conditionals voor auth: Alleen env vars toevoegen als auth enabled is

### 4.4 MongoDB Service Template

Maak `templates/mongodb/service.yaml`:

```yaml
{{- if .Values.mongodb.enabled }}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "petshelter.fullname" . }}-mongodb-service
  labels:
    {{- include "petshelter.labels" . | nindent 4 }}
    app.kubernetes.io/component: mongodb
spec:
  type: {{ .Values.mongodb.service.type }}
  ports:
  - port: {{ .Values.mongodb.service.port }}
    targetPort: mongodb
    protocol: TCP
    name: mongodb
  selector:
    {{- include "petshelter.selectorLabels" . | nindent 4 }}
    app.kubernetes.io/component: mongodb
{{- end }}
```

---

## Stap 5: Backend Templates

### 5.1 Backend Deployment Template

Maak `templates/backend/deployment.yaml`:

```yaml
{{- if .Values.backend.enabled }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "petshelter.fullname" . }}-backend
  labels:
    {{- include "petshelter.labels" . | nindent 4 }}
    app.kubernetes.io/component: backend
spec:
  replicas: {{ .Values.backend.replicaCount }}
  selector:
    matchLabels:
      {{- include "petshelter.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: backend
  template:
    metadata:
      labels:
        {{- include "petshelter.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: backend
    spec:
      containers:
      - name: backend
        image: "{{ .Values.backend.image.repository }}:{{ .Values.backend.image.tag }}"
        imagePullPolicy: {{ .Values.backend.image.pullPolicy }}
        ports:
        - name: http
          containerPort: {{ .Values.backend.service.port }}
          protocol: TCP
        env:
        {{- if .Values.mongodb.enabled }}
        {{- if .Values.mongodb.auth.enabled }}
        - name: MONGO_USERNAME
          valueFrom:
            secretKeyRef:
              name: {{ include "petshelter.fullname" . }}-mongodb-secret
              key: username
        - name: MONGO_PASSWORD
          valueFrom:
            secretKeyRef:
              name: {{ include "petshelter.fullname" . }}-mongodb-secret
              key: password
        {{- end }}
        - name: MONGO_HOST
          valueFrom:
            configMapKeyRef:
              name: {{ include "petshelter.fullname" . }}-mongodb-config
              key: database-url
        - name: MONGO_PORT
          valueFrom:
            configMapKeyRef:
              name: {{ include "petshelter.fullname" . }}-mongodb-config
              key: database-port
        - name: MONGO_DATABASE
          valueFrom:
            configMapKeyRef:
              name: {{ include "petshelter.fullname" . }}-mongodb-config
              key: database-name
        {{- end }}
        {{- with .Values.backend.resources }}
        resources:
          {{- toYaml . | nindent 10 }}
        {{- end }}
{{- end }}
```

**Uitleg:**
- Backend environment variables worden dynamisch gegenereerd
- Alleen MongoDB vars toevoegen als MongoDB enabled is
- Resources zijn optioneel via `with` block

### 5.2 Backend Service Template

Maak `templates/backend/service.yaml`:

```yaml
{{- if .Values.backend.enabled }}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "petshelter.fullname" . }}-backend-service
  labels:
    {{- include "petshelter.labels" . | nindent 4 }}
    app.kubernetes.io/component: backend
spec:
  type: {{ .Values.backend.service.type }}
  ports:
  - port: {{ .Values.backend.service.port }}
    targetPort: http
    protocol: TCP
    name: http
  selector:
    {{- include "petshelter.selectorLabels" . | nindent 4 }}
    app.kubernetes.io/component: backend
{{- end }}
```

---

## Stap 6: Frontend Templates

### 6.1 Frontend Deployment Template

Maak `templates/frontend/deployment.yaml`:

```yaml
{{- if .Values.frontend.enabled }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "petshelter.fullname" . }}-frontend
  labels:
    {{- include "petshelter.labels" . | nindent 4 }}
    app.kubernetes.io/component: frontend
spec:
  replicas: {{ .Values.frontend.replicaCount }}
  selector:
    matchLabels:
      {{- include "petshelter.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: frontend
  template:
    metadata:
      labels:
        {{- include "petshelter.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: frontend
    spec:
      containers:
      - name: frontend
        image: "{{ .Values.frontend.image.repository }}:{{ .Values.frontend.image.tag }}"
        imagePullPolicy: {{ .Values.frontend.image.pullPolicy }}
        ports:
        - name: http
          containerPort: {{ .Values.frontend.service.port }}
          protocol: TCP
        {{- if .Values.backend.enabled }}
        env:
        - name: BACKEND_URL
          value: "http://{{ include "petshelter.fullname" . }}-backend-service:{{ .Values.backend.service.port }}"
        {{- end }}
        {{- with .Values.frontend.resources }}
        resources:
          {{- toYaml . | nindent 10 }}
        {{- end }}
{{- end }}
```

**Uitleg:**
- `BACKEND_URL`: Dynamisch gegenereerd met fullname en port
- Alleen toevoegen als backend enabled is

### 6.2 Frontend Service Template

Maak `templates/frontend/service.yaml`:

```yaml
{{- if .Values.frontend.enabled }}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "petshelter.fullname" . }}-frontend-service
  labels:
    {{- include "petshelter.labels" . | nindent 4 }}
    app.kubernetes.io/component: frontend
spec:
  type: {{ .Values.frontend.service.type }}
  ports:
  - port: {{ .Values.frontend.service.port }}
    targetPort: http
    protocol: TCP
    name: http
    {{- if and (eq .Values.frontend.service.type "NodePort") .Values.frontend.service.nodePort }}
    nodePort: {{ .Values.frontend.service.nodePort }}
    {{- end }}
  selector:
    {{- include "petshelter.selectorLabels" . | nindent 4 }}
    app.kubernetes.io/component: frontend
{{- end }}
```

**Uitleg:**
- `{{- if and (eq .Values.frontend.service.type "NodePort") .Values.frontend.service.nodePort }}`: 
  - Alleen nodePort specificeren als service type NodePort is EN nodePort gedefinieerd is

---

## Stap 7: Helper Templates

### 7.1 Edit templates/_helpers.tpl

Vervang de inhoud van `templates/_helpers.tpl`:

```yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "petshelter.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "petshelter.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "petshelter.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "petshelter.labels" -}}
helm.sh/chart: {{ include "petshelter.chart" . }}
{{ include "petshelter.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "petshelter.selectorLabels" -}}
app.kubernetes.io/name: {{ include "petshelter.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
MongoDB connection string helper
*/}}
{{- define "petshelter.mongodb.connectionString" -}}
{{- if .Values.mongodb.enabled -}}
{{- printf "mongodb://%s-mongodb-service:%d/%s" (include "petshelter.fullname" .) (int .Values.mongodb.service.port) .Values.mongodb.auth.database -}}
{{- end -}}
{{- end -}}
```

**Uitleg van de helpers:**

1. **petshelter.name**: Basis naam (chart naam of override)
2. **petshelter.fullname**: Volledige naam (release + chart naam)
3. **petshelter.chart**: Chart naam met versie
4. **petshelter.labels**: Standaard Kubernetes labels (voor best practices)
5. **petshelter.selectorLabels**: Labels voor selectors
6. **petshelter.mongodb.connectionString**: Helper voor MongoDB connection (bonus)

### 7.2 Update NOTES.txt

Vervang `templates/NOTES.txt` voor betere gebruikerservaring:

```
Thank you for installing {{ .Chart.Name }}!

Your release is named {{ .Release.Name }}.

To learn more about the release, try:

  $ helm status {{ .Release.Name }}
  $ helm get all {{ .Release.Name }}

{{- if .Values.frontend.enabled }}

===========================================
  🐾 PetShelter Application Deployed! 🐾
===========================================

Frontend Service:
{{- if eq .Values.frontend.service.type "NodePort" }}
  
  You can access the PetShelter application using:
  
  Method 1 - Minikube service (recommended):
    $ minikube service {{ include "petshelter.fullname" . }}-frontend-service
  
  Method 2 - Direct access:
    $ minikube ip
    Then visit: http://<minikube-ip>:{{ .Values.frontend.service.nodePort }}

{{- else if eq .Values.frontend.service.type "LoadBalancer" }}

  Get the application URL by running:
    export SERVICE_IP=$(kubectl get svc --namespace {{ .Release.Namespace }} {{ include "petshelter.fullname" . }}-frontend-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    echo "http://$SERVICE_IP:{{ .Values.frontend.service.port }}"
    
  NOTE: It may take a few minutes for the LoadBalancer IP to be available.

{{- else }}

  Access the frontend by port-forwarding:
    $ kubectl port-forward svc/{{ include "petshelter.fullname" . }}-frontend-service 3000:{{ .Values.frontend.service.port }}
    Then visit: http://localhost:3000

{{- end }}
{{- end }}

{{- if .Values.backend.enabled }}

Backend API:
  URL (from within cluster): http://{{ include "petshelter.fullname" . }}-backend-service:{{ .Values.backend.service.port }}
  
  Test the API:
    $ kubectl port-forward svc/{{ include "petshelter.fullname" . }}-backend-service 5000:{{ .Values.backend.service.port }}
    $ curl http://localhost:5000/api/pets

{{- end }}

{{- if .Values.mongodb.enabled }}

MongoDB Database:
  Connection from within cluster:
    mongodb://{{ include "petshelter.fullname" . }}-mongodb-service:{{ .Values.mongodb.service.port }}/{{ .Values.mongodb.auth.database }}
  
  Connect to MongoDB shell:
    $ kubectl exec -it deployment/{{ include "petshelter.fullname" . }}-mongodb -- mongosh -u {{ .Values.mongodb.auth.rootUsername }} -p {{ .Values.mongodb.auth.rootPassword }}

{{- end }}

Useful commands:
  # View all pods
  $ kubectl get pods -l app.kubernetes.io/instance={{ .Release.Name }}
  
  # View logs
  $ kubectl logs -l app.kubernetes.io/instance={{ .Release.Name }} --all-containers=true
  
  # Scale frontend
  $ helm upgrade {{ .Release.Name }} . --set frontend.replicaCount=3

Happy PetSheltering! 🐕 🐈
```

---

## Stap 8: Testen en Deployen

### 8.1 Valideer de Chart

```bash
# Ga naar de chart directory
cd petshelter-chart

# Lint de chart (check voor syntax errors)
helm lint .

# Expected output:
# ==> Linting .
# [INFO] Chart.yaml: icon is recommended
# 
# 1 chart(s) linted, 0 chart(s) failed
```

### 8.2 Dry-run en Template Rendering

```bash
# Render templates zonder te installeren (dry-run)
helm install petshelter . --dry-run --debug

# Of alleen templates bekijken
helm template petshelter .

# Specifieke template bekijken
helm template petshelter . --show-only templates/mongodb/deployment.yaml
```

**Controleer de output:**
- Zijn alle placeholders vervangen?
- Kloppen de resource namen?
- Zijn conditionals correct?

### 8.3 Start Minikube

```bash
# Start Minikube als het nog niet draait
minikube start

# Controleer status
minikube status

# Optioneel: gebruik minikube Docker daemon voor lokale images
eval $(minikube docker-env)
```

### 8.4 Installeer de Chart

```bash
# Installeer de chart
helm install petshelter ./petshelter-chart

# Output:
# NAME: petshelter
# LAST DEPLOYED: ...
# NAMESPACE: default
# STATUS: deployed
# REVISION: 1
# NOTES:
# Thank you for installing petshelter!
# ...
```

### 8.5 Verifieer de Deployment

```bash
# Check de release status
helm status petshelter

# Bekijk alle resources
kubectl get all -l app.kubernetes.io/instance=petshelter

# Check pods status
kubectl get pods -w

# Expected output (na ~30 seconden):
# NAME                                      READY   STATUS    RESTARTS   AGE
# petshelter-backend-xxxxx                  1/1     Running   0          30s
# petshelter-frontend-xxxxx                 1/1     Running   0          30s
# petshelter-mongodb-xxxxx                  1/1     Running   0          30s
```

### 8.6 Test de Applicatie

```bash
# Method 1: Gebruik minikube service (makkelijkst)
minikube service petshelter-frontend-service

# Method 2: Get minikube IP en access direct
minikube ip
# Visit http://<minikube-ip>:32500 in je browser

# Method 3: Port-forward
kubectl port-forward svc/petshelter-frontend-service 3000:3000
# Visit http://localhost:3000
```

### 8.7 Test Backend API

```bash
# Port-forward backend
kubectl port-forward svc/petshelter-backend-service 5000:5000

# In een nieuwe terminal, test de API
curl http://localhost:5000/api/pets

# Expected: JSON array met pet data
```

### 8.8 Check Logs

```bash
# MongoDB logs
kubectl logs -l app.kubernetes.io/component=mongodb

# Backend logs (moet database seeding laten zien)
kubectl logs -l app.kubernetes.io/component=backend

# Expected output:
# Connecting to MongoDB...
# Server running on port 5000
# Connected to MongoDB
# Database seeded with initial pets

# Frontend logs
kubectl logs -l app.kubernetes.io/component=frontend
```

---

## Stap 9: Multi-Environment Setup

### 9.1 Development Values

Maak `values-dev.yaml`:

```yaml
# Development Environment Configuration

# MongoDB - lighter resources for dev
mongodb:
  replicaCount: 1
  image:
    tag: "7"
    pullPolicy: IfNotPresent
  
  auth:
    rootUsername: devadmin
    rootPassword: devpass123
    database: petshelter-dev
  
  resources:
    limits:
      memory: "256Mi"
      cpu: "250m"
    requests:
      memory: "128Mi"
      cpu: "100m"
  
  persistence:
    enabled: false  # Geen persistence in dev

# Backend - debug mode enabled
backend:
  replicaCount: 1
  image:
    tag: "dev"
    pullPolicy: Always  # Always pull in dev voor laatste changes
  
  env:
    NODE_ENV: development
  
  resources:
    limits:
      memory: "256Mi"
      cpu: "200m"
    requests:
      memory: "128Mi"
      cpu: "100m"

# Frontend - development mode
frontend:
  replicaCount: 1
  image:
    tag: "dev"
    pullPolicy: Always
  
  service:
    type: NodePort
    nodePort: 32500
  
  resources:
    limits:
      memory: "128Mi"
      cpu: "100m"
    requests:
      memory: "64Mi"
      cpu: "50m"

# Ingress disabled in dev
ingress:
  enabled: false
```

### 9.2 Staging Values

Maak `values-staging.yaml`:

```yaml
# Staging Environment Configuration

# MongoDB - production-like setup
mongodb:
  replicaCount: 1
  image:
    tag: "7"
    pullPolicy: IfNotPresent
  
  auth:
    rootUsername: stagingadmin
    rootPassword: stagingSecurePass456
    database: petshelter-staging
  
  resources:
    limits:
      memory: "512Mi"
      cpu: "500m"
    requests:
      memory: "256Mi"
      cpu: "250m"
  
  persistence:
    enabled: true
    size: 5Gi

# Backend - staging configuration
backend:
  replicaCount: 2  # Multiple replicas voor load testing
  image:
    tag: "staging-v1.0"
    pullPolicy: IfNotPresent
  
  env:
    NODE_ENV: staging
  
  resources:
    limits:
      memory: "256Mi"
      cpu: "200m"
    requests:
      memory: "128Mi"
      cpu: "100m"

# Frontend
frontend:
  replicaCount: 2
  image:
    tag: "staging-v1.0"
    pullPolicy: IfNotPresent
  
  service:
    type: ClusterIP  # Use ingress instead of NodePort
  
  resources:
    limits:
      memory: "128Mi"
      cpu: "100m"
    requests:
      memory: "64Mi"
      cpu: "50m"

# Ingress enabled for staging
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-staging
  hosts:
    - host: petshelter-staging.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: petshelter-staging-tls
      hosts:
        - petshelter-staging.example.com
```

### 9.3 Production Values

Maak `values-prod.yaml`:

```yaml
# Production Environment Configuration

# MongoDB - high availability
mongodb:
  replicaCount: 1  # In productie zou je een StatefulSet willen met replicaset
  image:
    tag: "7"
    pullPolicy: IfNotPresent
  
  auth:
    rootUsername: prodadmin
    # In productie: gebruik external secret management (Sealed Secrets, Vault)
    rootPassword: "CHANGE_ME_IN_PRODUCTION"
    database: petshelter
  
  resources:
    limits:
      memory: "1Gi"
      cpu: "1000m"
    requests:
      memory: "512Mi"
      cpu: "500m"
  
  persistence:
    enabled: true
    size: 20Gi
    storageClass: "fast-ssd"  # Production storage class

# Backend - production ready
backend:
  replicaCount: 3  # Multiple replicas voor HA
  image:
    tag: "v1.0.0"  # Specifieke versie, NIET latest
    pullPolicy: IfNotPresent
  
  env:
    NODE_ENV: production
  
  resources:
    limits:
      memory: "512Mi"
      cpu: "500m"
    requests:
      memory: "256Mi"
      cpu: "250m"
  
  # Autoscaling (zou extra config vereisen)
  # autoscaling:
  #   enabled: true
  #   minReplicas: 3
  #   maxReplicas: 10
  #   targetCPUUtilizationPercentage: 70

# Frontend - production ready
frontend:
  replicaCount: 3
  image:
    tag: "v1.0.0"
    pullPolicy: IfNotPresent
  
  service:
    type: ClusterIP  # Use ingress
  
  resources:
    limits:
      memory: "256Mi"
      cpu: "200m"
    requests:
      memory: "128Mi"
      cpu: "100m"

# Ingress - production with TLS
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
  hosts:
    - host: petshelter.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: petshelter-prod-tls
      hosts:
        - petshelter.example.com
```

### 9.4 Deploy naar Verschillende Environments

```bash
# Development
helm install petshelter-dev ./petshelter-chart -f values-dev.yaml

# Staging
helm install petshelter-staging ./petshelter-chart -f values-staging.yaml -n staging --create-namespace

# Production
helm install petshelter-prod ./petshelter-chart -f values-prod.yaml -n production --create-namespace

# List all releases across namespaces
helm list --all-namespaces
```

### 9.5 Update een Environment

```bash
# Update development met nieuwe image tag
helm upgrade petshelter-dev ./petshelter-chart -f values-dev.yaml --set backend.image.tag=dev-feature-x

# Update staging
helm upgrade petshelter-staging ./petshelter-chart -f values-staging.yaml -n staging

# Production rollout met extra verificatie
helm upgrade petshelter-prod ./petshelter-chart -f values-prod.yaml -n production --atomic --timeout 5m
```

**Uitleg flags:**
- `--atomic`: Rollback automatisch bij failure
- `--timeout 5m`: Maximale tijd voor deployment
- `-n <namespace>`: Target namespace

---

## Troubleshooting

### Probleem 1: Pods starten niet

```bash
# Check pod status
kubectl get pods -l app.kubernetes.io/instance=petshelter

# Describe pod voor events
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>

# Veel voorkomende oorzaken:
# - Image pull error: Check imagePullPolicy en image tag
# - CrashLoopBackOff: Check logs voor applicatie errors
# - Pending: Onvoldoende resources
```

### Probleem 2: Backend kan niet connecten met MongoDB

```bash
# Check MongoDB pod logs
kubectl logs -l app.kubernetes.io/component=mongodb

# Check backend logs voor connection errors
kubectl logs -l app.kubernetes.io/component=backend

# Verify ConfigMap en Secret
kubectl get configmap petshelter-mongodb-config -o yaml
kubectl get secret petshelter-mongodb-secret -o yaml

# Test MongoDB connectivity van backend pod
kubectl exec -it deployment/petshelter-backend -- sh
# In de pod:
nc -zv petshelter-mongodb-service 27017
```

### Probleem 3: Frontend kan Backend niet bereiken

```bash
# Check backend service
kubectl get svc petshelter-backend-service

# Check frontend environment variables
kubectl exec -it deployment/petshelter-frontend -- env | grep BACKEND

# Test backend connectivity van frontend pod
kubectl exec -it deployment/petshelter-frontend -- sh
# In de pod:
wget -O- http://petshelter-backend-service:5000/api/pets
```

### Probleem 4: Template Rendering Errors

```bash
# Lint de chart
helm lint ./petshelter-chart

# Dry-run met debug
helm install test ./petshelter-chart --dry-run --debug

# Check specifieke template
helm template test ./petshelter-chart --show-only templates/backend/deployment.yaml

# Veelvoorkomende template errors:
# - Missing closing brackets: {{ vs }}
# - Incorrect indentation: Use | nindent
# - Undefined values: Check values.yaml
```

### Probleem 5: Rollback Nodig

```bash
# Bekijk release history
helm history petshelter

# Rollback naar vorige versie
helm rollback petshelter

# Rollback naar specifieke revisie
helm rollback petshelter 2

# Force rollback
helm rollback petshelter 1 --force
```

### Debug Tips

```bash
# 1. Bekijk alle Helm releases
helm list --all-namespaces

# 2. Get all resources van een release
helm get all petshelter

# 3. Get alleen de values
helm get values petshelter

# 4. Get manifest (deployed YAML)
helm get manifest petshelter

# 5. Check events
kubectl get events --sort-by='.lastTimestamp'

# 6. Port-forward voor debugging
kubectl port-forward deployment/petshelter-backend 5000:5000
kubectl port-forward deployment/petshelter-mongodb 27017:27017

# 7. Execute in pod voor debugging
kubectl exec -it deployment/petshelter-backend -- sh
```

---

## Conclusie

### Wat Je Hebt Geleerd

✅ **Migratie Proces**:
- Raw Kubernetes YAML converteren naar Helm templates
- Values extracten en parametrizeren
- Dynamische resource namen genereren
- Conditionals en loops gebruiken in templates

✅ **Helm Best Practices**:
- Helper templates voor herbruikbare code
- Proper labeling en resource naming
- Resource limits en requests definiëren
- Multi-environment configuratie

✅ **Operationele Skills**:
- Chart linting en validatie
- Dry-run testing
- Release management (install, upgrade, rollback)
- Debugging van templates en deployments

### Voor en Na Vergelijking

**Voor (Raw YAML):**
```bash
# 5 aparte commando's
kubectl apply -f k8s/mongodb-secret.yaml
kubectl apply -f k8s/mongodb-configmap.yaml
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Hard-coded values in elke file
# Moeilijk te beheren
# Geen versiebeheer
# Handmatige rollbacks
```

**Na (Helm):**
```bash
# Één commando voor alles
helm install petshelter ./petshelter-chart

# Configureerbaar via values
# Easy multi-environment
# Automatische rollbacks
# Versiebeheer ingebouwd
```

### Volgende Stappen

1. **Chart Packaging & Distribution**
   ```bash
   # Package de chart
   helm package petshelter-chart/
   
   # Upload naar chart repository
   # (GitHub Pages, Harbor, ChartMuseum, etc.)
   ```

2. **Secrets Management Verbeteren**
   - Gebruik [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
   - Of [External Secrets Operator](https://external-secrets.io/)
   - Of [HashiCorp Vault](https://www.vaultproject.io/)

3. **Monitoring Toevoegen**
   ```bash
   # Install Prometheus & Grafana
   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
   helm install monitoring prometheus-community/kube-prometheus-stack
   ```

4. **CI/CD Pipeline**
   - Automatische Helm deployments via GitHub Actions
   - GitOps met ArgoCD of Flux
   - Automated testing

5. **Production Deployment**
   - Deploy naar managed Kubernetes (AKS, EKS, GKE)
   - Setup proper ingress met cert-manager
   - Implement autoscaling (HPA)

### Nuttige Resources

- 📚 [Helm Documentation](https://helm.sh/docs/)
- 📚 [Helm Best Practices](https://helm.sh/docs/chart_best_practices/)
- 💻 [PetShelter Repository](https://github.com/MilanVives/PetShelter-minimal)
- 🎓 [Helm Tutorial](helm.md)

---

**Gefeliciteerd! Je hebt succesvol een Kubernetes applicatie naar Helm gemigreerd! 🎉**

Happy Helming! ⎈ 🚀
