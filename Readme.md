# DevOps & Cloud Infrastructure – Cursusmateriaal

## Auteur

**Milan Dima**  
[milan.dima@vives.be](mailto:milan.dima@vives.be)

## Licentie

Deze cursus valt onder de **Creative Commons BY 4.0-licentie**.  
Iedereen mag dit materiaal **gratis gebruiken, delen en aanpassen**,  
mits correcte bronvermelding naar: _Milan Dima (milan.dima@vives.be)_.

Meer info: [https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/)

---

# Inhoudstafel

## [Evaluatie](00-Assessment/)

Dit vak wordt gebruikt voor twee klasgroepen, elk met hun eigen evaluatie:

### [Devops & Cloud Computing](00-Assessment/Devops/)

- [PE 1 – GitHub Classroom](00-Assessment/Devops/1-PE_GitHub-Classroom.md) - Uitnodiging accepteren en eerste commit pushen (pass/fail)
- [PE 2 – Docker Compose](00-Assessment/Devops/2-PE_Compose-Devops.md) - Permanente evaluatieopdracht: drieservicetoepassing containeriseren met Docker Compose
- [PE 3 – Minikube](00-Assessment/Devops/3-PE_Minikube-Devops.md) - Permanente evaluatieopdracht: deployment op Minikube
- [Final Assessment (80%)](00-Assessment/Devops/4-Final-Assessment.md) - Stap-voor-stap cloud deployment: cluster, secrets, Helm, ingress/HTTPS, CI/CD, monitoring, bouwt verder op PE1-3
- [Mondelinge Verdediging](00-Assessment/Devops/mondelinge-verdediging.md) - Eén verdediging aan het einde voor het volledige project - toetst begrip naast projectkwaliteit

### [Cloud Infrastructure](00-Assessment/CloudInfrastructure/)

*[Komt binnenkort]*

## [Les 1 – Docker Basics](01-Docker/)

- [Docker Fundamentals](01-Docker/docker.md) - Introductie & Motivatie, Wat is Docker?, Containers vs VMs
- [Slides](01-Docker/docker-slides.md) - Marp-slidedeck versie voor in de les
- [Praktische Oefeningen](01-Docker/oefeningen.md) - Hands-on labs en experimenteren
- **Onderwerpen:**
  - Belangrijkste Docker commando's (`docker run`, `docker ps`, `docker stop`, `docker rm`)
  - Opties: `--rm`, `--name`, `-d`, `-p`, `-v`
  - `docker inspect`
  - Data & Volumes: ephemeral, named, bind mounts, `--volumes-from`
  - Networking: bridge, poortmapping, container-naar-container communicatie
  - Eigen images maken met `docker commit`
  - Publiceren naar Docker Hub

## [Les 2 – Dockerfile](02-Dockerfile/)

- [Dockerfile Tutorial](02-Dockerfile/Dockerfile-Intro.md) - Van Docker run naar distribueerbare images
- [Dockerfile Advanced](02-Dockerfile/Dockerfile-Advanced.md) - Geavanceerde Dockerfile technieken en optimalisaties
- [Dockerfile Multiplatform](02-Dockerfile/Dockerfile-Multiplatform.md) - Multi-platform builds voor ARM en x86 architecturen
- **Onderwerpen:**
  - Images bouwen met Dockerfile
  - Docker layer systeem en caching
  - Dockerfile keywords en best practices
  - Multi-stage builds en optimization
  - Van handmatige containers naar scripted builds
  - Geavanceerde Dockerfile instructies en optimalisatie technieken
  - Security best practices en image hardening
  - Build context optimalisatie en .dockerignore
  - Multi-platform builds voor ARM (macOS M1/M2/M3) en x86_64 architecturen
  - BuildKit en buildx voor cross-platform image creation

## [Les 3 – Docker Compose](03-Compose/)

- [Van Docker run naar Compose](03-Compose/3-compose.md) - Multi-container orchestratie
- [Compose bestanden](03-Compose/compose-files/) - Praktische voorbeelden
- **Onderwerpen:**
  - Multi-container applicaties
  - YAML configuratie en service definitie
  - Container communicatie via service names
  - Volumes en networking in Compose
  - Van handmatige linking naar geautomatiseerde orchestratie

## [Les 4 – Docker Networking](04-Docker-networking/)

- [Docker Networking Tutorial](04-Docker-networking/docker-networking.md) - Complete netwerkgids
- **Onderwerpen:**
  - Netwerkmodi: bridge, host, overlay, none
  - Container-naar-container communicatie
  - Custom networks aanmaken en beheren
  - Network drivers en gebruik cases
  - Externe toegang en poort forwarding
  - Praktische voorbeelden met netcat

## [Les 5 – Infrastructure as Code (IaC)](05-IaC/)

- [IaC Tutorial](05-IaC/iac.md) - Ansible en Terraform mastery
- [IaC bestanden](05-IaC/iac-files/) - Praktische voorbeelden en templates
- **Onderwerpen:**
  - Van handmatige naar geautomatiseerde infrastructuur
  - **Ansible**: Configuration Management, Playbooks, inventory, modules en roles
  - **Terraform/OpenTofu**: Infrastructure Provisioning, declaratieve vs imperatieve benaderingen
  - State management en lifecycle workflows
  - Resource cleanup en destroy best practices
  - Tool integratie: Terraform + Ansible workflows
  - Praktische cloud deployment (GCP/AWS/Azure)

## [Les 6 – Kubernetes](06-Kubernetes/)

### [Les 6a – Kubernetes Cloud Deployment](06-Kubernetes/6a-kubernetes-cloud.md)
- [Slides](06-Kubernetes/6a-kubernetes-cloud-slides.md) - Marp-slidedeck versie voor in de les
- [Demobestanden](06-Kubernetes/6a-cloud-demo/) - Virtuweb: index.html, Dockerfile, Deployment en Service manifests
- Waarom container orkestratie? Docker Compose vs Kubernetes
- Kubernetes architectuur: control plane, worker nodes, kubelet, kube-proxy, pods
- Website dockerizen en multi-platform pushen (amd64 + arm64)
- Managed Kubernetes cluster aanmaken bij Linode (LKE), kosten
- kubectl en KUBECONFIG
- Deployment (replicas, desired state) en Service van type LoadBalancer (NodeBalancer)
- Schalen, self-healing, rolling updates en rollback
- Correct opruimen zonder verborgen kosten

### [Les 6b – Kubernetes Fundamentals](06-Kubernetes/6b-kubernetes-fundamentals.md)
- [Slides](06-Kubernetes/6b-kubernetes-fundamentals-slides.md) - Marp-slidedeck versie voor in de les
- Wat gebeurt er bij `kubectl apply`? Controle-lus en desired state
- Anatomie van een manifest, imperatief vs declaratief
- **Pods**: levenscyclus, sidecars, requests/limits, readiness/liveness probes
- **Deployments & ReplicaSets**: rolling updates en rollback
- **Services & DNS**: ClusterIP, NodePort, LoadBalancer, headless
- **ConfigMaps & Secrets**: env, envFrom, volumes (base64 ≠ encryptie)
- **Labels & selectors**, **Namespaces** en resource quotas
- **Opslag**: volumes, PersistentVolumeClaims, StorageClasses
- Een 3-tier applicatie uitgedrukt in Kubernetes-objecten

### [Les 6c – Kubernetes met Minikube: 3-tier Pet Shelter](06-Kubernetes/6c-kubernetes-minikube.md)
- [Slides](06-Kubernetes/6c-kubernetes-minikube-slides.md) - Marp-slidedeck versie voor in de les
- **Minikube**: installatie en starten (macOS, Linux, Windows)
- **Pet Shelter**: frontend (Express) + backend (Node.js API) + MongoDB, van Docker Compose naar Kubernetes
- **Manifests**: Secret, ConfigMap, Deployments en Services één voor één uitgelegd
- **Images bouwen in Minikube** (`docker-env` / `minikube image build`, `imagePullPolicy: Never`)
- **Toegang**: `minikube service`, port-forward, NodePort
- **Debugging & troubleshooting**: status → oorzaak → oplossing
- **Schalen, rolling updates en data bewaren** met een PersistentVolumeClaim
- **Repository**: [PetShelter-minimal](https://github.com/MilanVives/PetShelter-minimal), kopie in [minikube-demo](06-Kubernetes/6c-minikube-demo/)

## [Les 7 – Helm Package Management](07-Helm/)

- [Helm Tutorial](07-Helm/helm.md) - Kubernetes package management fundamentals
- [Helm PetShelter Migration](07-Helm/helm-petshelter.md) - Praktische migratie van Kubernetes naar Helm
- **Onderwerpen:**
  - Kubernetes applicatie packaging en templating
  - Helm charts en custom chart development
  - Package management en versioning strategieën
  - Helm repositories en chart distribution
  - Complex deployments met Helm dependency management
  - Stap-voor-stap migratie van PetShelter applicatie naar Helm
  - Values.yaml configuratie en template development
  - Helper templates en best practices

## [Les 8 – Ingress & Reverse Proxies](08-Ingress-and-Reverse-Proxies/)

- [Ingress Controllers](08-Ingress-and-Reverse-Proxies/ingress.md) - Complete Kubernetes ingress fundamentals
- [Traefik Tutorial](08-Ingress-and-Reverse-Proxies/Traefik.md) - Modern reverse proxy met automatische SSL
- [Nginx Tutorial](08-Ingress-and-Reverse-Proxies/Nginx.md) - Klassieke reverse proxy configuratie
- [Traefik Examples](08-Ingress-and-Reverse-Proxies/traefik-examples/) - Praktische Traefik configuraties
- [Nginx Examples](08-Ingress-and-Reverse-Proxies/nginx-examples/) - Praktische Nginx voorbeelden
- **Onderwerpen:**
  - Ingress controllers en routing mechanismen
  - Kubernetes Ingress resources en controllers (NGINX, Traefik, HAProxy)
  - Ingress architectuur en deployment patterns
  - Traefik als modern reverse proxy met automatische SSL certificates (Let's Encrypt)
  - Nginx reverse proxy configuratie met port redirection en upstream servers
  - Load balancing strategieën en algoritmes
  - SSL/TLS certificate management (automatisch en manueel)
  - External DNS en domain management voor production
  - Container-naar-container proxy routing
  - Path-based en host-based routing configuraties
  - Health checks en monitoring van ingress traffic
  - Best practices voor production ingress setups

## [Les 9 – CI/CD](09-CI-CD/)

- [GitHub Actions Basics](09-CI-CD/github-actions.md) - GitHub Actions fundamentals en workflow syntax
- [Complete Pipeline Example](09-CI-CD/Example-Pipeline.md) - GitHub Actions CI/CD voor frontend/backend deployment
- [GitHub Container Registry (GHCR)](09-CI-CD/ga-with-ghcr.md) - Container images automatisch pushen naar GHCR
- **Onderwerpen:**
  - **GitHub Actions Fundamentals:**
    - Workflow syntax en triggers (push, pull_request, schedule)
    - Jobs, steps en actions marketplace
    - Environment variables en secrets management
    - Matrix builds voor multi-platform testing
    - Artifact sharing tussen jobs
  - **Complete CI/CD Pipeline:**
    - Docker image building en versioning strategieën
    - Docker Hub registry management en authentication
    - Automated deployment naar production servers via SSH
    - SSH key configuratie en GitHub secrets setup
    - Zero-downtime deployments met docker compose
    - Environment-specific configurations
  - **GitHub Container Registry (GHCR):**
    - Personal Access Token (PAT) configuratie voor GHCR
    - Docker login naar ghcr.io en image naming conventions
    - Container images bouwen en pushen naar GHCR
    - GitHub Actions workflow voor automatische GHCR deployments
    - Package visibility management (public/private)
    - Troubleshooting GHCR authentication en build errors
  - **Advanced CI/CD Concepts:**
    - GitOps principes en workflow patterns
    - ArgoCD voor declaratieve Kubernetes deployments
    - Flux voor continuous delivery automation
    - Infrastructure as Code in CI/CD pipelines
    - Multi-environment deployment strategieën (dev, staging, prod)
    - Canary deployments en blue-green deployment patterns
    - Rollback strategieën en disaster recovery

## [Les 10 – Service Mesh & Microservices](10-Service-Mesh-and-Microservices/)

- [Service Mesh Tutorial](10-Service-Mesh-and-Microservices/service-mesh.md) - Advanced microservices communication
- **Onderwerpen:**
  - Service mesh architectuur en use cases
  - Istio: traffic management, security, observability
  - Linkerd als lightweight alternatief  
  - Service-to-service communication patronen
  - Circuit breakers en resilience patterns
  - Microservices observability en debugging

## [Les 11 – Security & DevSecOps](11-Security-and-Devops/)

- [Security & DevSecOps](11-Security-and-Devops/security-devops.md) - Container security, vulnerability scanning, Kubernetes security, Policy as Code
- **Onderwerpen:**
  - Container security best practices
  - Image vulnerability scanning (Trivy, Snyk)
  - Kubernetes security: RBAC, PodSecurityPolicies
  - Policy as Code met Open Policy Agent (OPA)
  - Secrets management en encryption
  - Security monitoring en compliance automation

## [Les 12 – Advanced Monitoring & Observability](12-Monitoring/)

- [Monitoring & Observability](12-Monitoring/monitoring-observability.md) - Prometheus, Grafana, Jaeger, APM, SLA/SLO/SLI
- **Onderwerpen:**
  - Observability: metrics, logs, distributed tracing
  - Prometheus voor metrics collection en alerting
  - Grafana voor visualization en dashboards
  - Jaeger voor distributed tracing
  - Application Performance Monitoring (APM)
  - SLA/SLO/SLI definitie en monitoring

## [Les 13 – Performance & Scalability](13-Scalability/)

- [Performance & Scalability](13-Scalability/performance-scalability.md) - Auto-scaling, load testing, capacity planning, disaster recovery
- **Onderwerpen:**
  - Kubernetes auto-scaling: HPA, VPA, Cluster Autoscaler
  - Load testing strategieën (K6, Artillery)
  - Performance optimization technieken
  - Resource management en capacity planning
  - Multi-cloud en hybrid cloud strategieën
  - Disaster recovery en business continuity planning

## [Les 14 – Cloudflare](14-Cloudflare/) *[Komt binnenkort]*

- **Onderwerpen:**
  - Tunneling: Cloudflare Tunnel zonder open inbound poorten
  - App security: WAF, rate limiting, DDoS-bescherming
  - App login: Zero Trust Access (identity-based toegang zonder VPN)
  - App deployment: DNS, SSL/TLS, Cloudflare Pages
  - Workers: serverless functies op de edge

## [Les 15 – Cloud Providers & Cloud Services](15-Cloud-Providers/) *[Komt binnenkort]*

- **Onderwerpen:**
  - Cloud computing basics: on-premise vs cloud, IaaS/PaaS/SaaS
  - Overzicht cloudproviders: AWS, Azure, GCP, Linode, DigitalOcean, Oracle Cloud, Hetzner
  - Kerninfrastructuur: compute, storage, networking, managed databases
  - Regions, availability zones, kostenbeheer, shared responsibility model

---

# Curriculum per opleiding

Dit vak wordt gebruikt voor twee opleidingen met elk hun eigen traject door de lessen hierboven. Zie ook [Evaluatie](00-Assessment/) — dat hoofdstuk (permanente evaluatie + eindopdracht) is **enkel voor Devops & Cloud Computing**.

## Devops & Cloud Computing (B-VIV-V3R316)

| # | Les | Verplicht/optioneel |
|---|---|---|
| 1 | [Docker Basics](01-Docker/) | Verplicht |
| 2 | [Dockerfile](02-Dockerfile/) | Verplicht |
| 3 | [Docker Compose](03-Compose/) | Verplicht |
| 4 | [Docker Networking](04-Docker-networking/) | Verplicht |
| 6 | [Kubernetes](06-Kubernetes/) | Verplicht |
| 7 | [Helm](07-Helm/) | Verplicht |
| 8 | [Ingress & Reverse Proxies](08-Ingress-and-Reverse-Proxies/) | Verplicht |
| 14 | [Cloudflare](14-Cloudflare/) *(nieuw, nog te schrijven)* | Verplicht |
| 9 | [CI/CD](09-CI-CD/) | Verplicht |
| 12 | [Monitoring & Observability](12-Monitoring/) | Optioneel, indien tijd |

> Evaluatie: zie [PE1-3 en Final Assessment](00-Assessment/Devops/).

## Cloud Infrastructure (B-VIV-V3R449)

| # | Les | Verplicht/optioneel |
|---|---|---|
| 15 | [Cloud Providers & Cloud Services](15-Cloud-Providers/) *(nieuw, nog te schrijven)* | Verplicht |
| 5 | [Infrastructure as Code](05-IaC/) | Verplicht |
| 6 | [Kubernetes](06-Kubernetes/) | Verplicht |
| 7 | [Helm](07-Helm/) | Verplicht |
| 8 | [Ingress & Reverse Proxies](08-Ingress-and-Reverse-Proxies/) | Verplicht |
| 10 | [Service Mesh & Microservices](10-Service-Mesh-and-Microservices/) | Optioneel, indien tijd |
| 11 | [Security & DevSecOps](11-Security-and-Devops/) | Optioneel, indien tijd |
| 12 | [Monitoring & Observability](12-Monitoring/) | Optioneel, indien tijd |

> Evaluatie: zie [00-Assessment/CloudInfrastructure](00-Assessment/CloudInfrastructure/) *(nog in te vullen)*.

---

# Introductie

Deze cursus **DevOps & Cloud Infrastructure** biedt een praktijkgerichte inleiding in de moderne manier van software ontwikkelen, uitrollen en beheren.  

We starten met **Docker** als basis van containerisatie, gevolgd door **Dockerfile** en **Docker Compose** voor multi-container applicaties. Vervolgens leren we **Docker Networking** voor complexe communicatie patronen.

Een belangrijke stap is **Infrastructure as Code (IAC)** met **Ansible** en **Terraform**, waarmee we complete infrastructuur automatiseren. Daarna bouwen we verder naar **Kubernetes** voor enterprise orchestratie, **CI/CD** pipelines, en cloud-native tools zoals **Helm, Traefik en monitoring oplossingen**.

### Doelstellingen

- Begrijpen waarom containerisatie en orkestratie essentieel zijn voor moderne software development.
- Leren werken met Docker ecosysteem voor development, testing en productie.
- Infrastructure as Code beheersen voor geautomatiseerd infrastructuur beheer.
- Inzicht krijgen in Kubernetes als standaard voor cloud deployment en orchestratie.
- Kennismaken met CI/CD pipelines, monitoring en enterprise-ready infrastructuurtools.
- Praktische ervaring opbouwen met industry-standard DevOps workflows.

### Voor wie?

- Studenten en professionals die inzicht willen krijgen in **DevOps** en **Cloud Infrastructure**.
- Basiskennis Linux en command line is een pluspunt.
- Interesse in automatisering, cloud platforms en moderne development practices.
- Voorbereiding op DevOps Engineer, Site Reliability Engineer of Cloud Infrastructure rollen.

---