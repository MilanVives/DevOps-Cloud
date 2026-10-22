# 7 - Helm als package manager: Prometheus en Grafana

Een demo van Helm als **package manager**. Je installeert een volledige monitoringstack met één commando:

- **Prometheus**: verzamelt metrics;
- **Grafana**: dashboards;
- **Alertmanager**: alerts;
- **node-exporter** en **kube-state-metrics**: de metrics van je nodes en Kubernetes-objecten.

Het zijn tientallen Kubernetes-objecten: Deployments, StatefulSets, een DaemonSet, Services, Secrets, CRDs en een
operator. Met de hand zou je dat dagen kosten.

Onderweg zie je alles wat een package manager doet: een pakket **zoeken**, een **repository toevoegen**, **installeren**,
**configureren**, **upgraden**, **terugdraaien** en **verwijderen**.

> Hoe je de stack daarna **gebruikt** (PromQL, dashboards, je eigen app monitoren) staat in
> [Monitoring met Prometheus en Grafana](../12-Monitoring/prometheus-grafana-helm.md).

**Vooraf:** de [Helm-les](helm.md), secties 1 tot 3. De stack heeft meer geheugen nodig dan de standaard-Minikube:

```bash
minikube start --memory=4g --cpus=2
```

---

## 1. Het pakket zoeken

Zoals `apt search` of `npm search`. Helm zoekt op [Artifact Hub](https://artifacthub.io), de centrale catalogus van
Helm-charts:

```bash
helm search hub prometheus
```

```
URL                                                 CHART VERSION  APP VERSION  DESCRIPTION
https://artifacthub.io/packages/helm/prometheus...  29.37.1        v3.15.1      Prometheus is a monitoring system ...
https://artifacthub.io/packages/helm/quench-pro...  0.0.21         3.15.0       Metrics collection, storage, ...
...
```

Er zijn tientallen charts met "prometheus" in de naam. **Welke kies je?** Open
[artifacthub.io](https://artifacthub.io) en zoek `kube-prometheus-stack`:

- de **publisher** is `prometheus-community`, het Prometheus-project zelf ("official" of "verified publisher");
- veel sterren en downloads, recent bijgewerkt;
- de pagina toont de **repository-URL**, de installatie-instructies en alle values.

| Chart | Wat |
|---|---|
| `prometheus-community/prometheus` | enkel Prometheus |
| `prometheus-community/kube-prometheus-stack` | **alles samen**: Prometheus, Grafana, Alertmanager, exporters, dashboards en alerts |

We nemen `kube-prometheus-stack`.

---

## 2. De repository toevoegen

Artifact Hub is enkel een catalogus: de chart zelf staat in de repository van de maker. Die voeg je toe, zoals een
extra bron in `apt`:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update                      # de lijst charts ophalen (zoals apt update)
helm repo list
```

Nu kan je **in die repository** zoeken:

```bash
helm search repo prometheus-community
helm search repo prometheus-community/kube-prometheus-stack --versions | head -5
```

```
NAME                                        CHART VERSION  APP VERSION
prometheus-community/kube-prometheus-stack  92.11.0        v0.94.1
prometheus-community/kube-prometheus-stack  92.10.1        v0.94.1
...
```

**CHART VERSION** is de versie van het pakket. **APP VERSION** is de versie van de software erin (hier de Prometheus
Operator).

---

## 3. Bekijken wat je gaat installeren

```bash
helm show chart prometheus-community/kube-prometheus-stack     # Chart.yaml: beschrijving en dependencies
helm show values prometheus-community/kube-prometheus-stack | wc -l    # ruim 6000 regels instellingen
helm show values prometheus-community/kube-prometheus-stack > alle-values.yaml
```

In `helm show chart` zie je de **dependencies**: deze chart bevat zelf andere charts, net zoals een npm-pakket
andere pakketten nodig heeft.

```yaml
dependencies:
  - name: kube-state-metrics
  - name: prometheus-node-exporter
  - name: grafana
  ...
```

Helm installeert ze allemaal mee. Je hoeft ze niet zelf te zoeken.

---

## 4. Installeren

```bash
helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace
```

- `monitoring`: de naam van de **release**. Die zie je terug in de namen van alle objecten (`monitoring-grafana`, …).
- `-n monitoring --create-namespace`: alles in een eigen namespace.

Helm toont daarna de **NOTES** van de chart: hoe je de pods controleert en het Grafana-wachtwoord opvraagt. Na 2 à 3
minuten:

```bash
helm list -n monitoring
kubectl get pods -n monitoring
```

```
NAME                                                     READY   STATUS
alertmanager-monitoring-kube-prometheus-alertmanager-0   2/2     Running
monitoring-grafana-58d76b59f4-t94fw                      3/3     Running
monitoring-kube-prometheus-operator-84886b6549-zjt9z     1/1     Running
monitoring-kube-state-metrics-75d7ddcc9c-97qff           1/1     Running
monitoring-prometheus-node-exporter-shvhv                1/1     Running
prometheus-monitoring-kube-prometheus-prometheus-0       2/2     Running
```

---

## 5. Wat heeft Helm allemaal gemaakt?

Dit is waarom deze chart zo'n goede demo is: je ziet bijna elk soort Kubernetes-object.

```bash
kubectl get deploy,statefulset,daemonset,svc -n monitoring
kubectl get crd | grep monitoring.coreos.com
helm get manifest monitoring -n monitoring | grep '^kind:' | sort | uniq -c
```

| Object | Wat | Waarom dit type |
|---|---|---|
| **Deployment** `monitoring-grafana` | Grafana | staatloos: de dashboards komen uit ConfigMaps |
| **Deployment** `…-operator` | de Prometheus Operator | beheert Prometheus en Alertmanager (zie hieronder) |
| **Deployment** `…-kube-state-metrics` | metrics over Kubernetes-objecten (replicas, pods, …) | staatloos |
| **StatefulSet** `prometheus-…` | Prometheus zelf | slaat metrics op: vaste naam (`-0`) en een eigen volume per pod |
| **StatefulSet** `alertmanager-…` | Alertmanager | onthoudt welke alerts al verstuurd zijn |
| **DaemonSet** `…-node-exporter` | metrics van elke node (CPU, geheugen, schijf) | precies **één pod per node** |
| **CRD**s (10) | nieuwe objecttypes: `Prometheus`, `ServiceMonitor`, `PrometheusRule`, … | de operator leest ze |
| **Secret** `monitoring-grafana` | het admin-wachtwoord van Grafana | |
| **ConfigMaps** | 29 kant-en-klare Grafana-dashboards | |

**De operator.** Helm maakt de StatefulSets van Prometheus en Alertmanager niet zelf. Het maakt een object van het type
`Prometheus` (een CRD), en de **Prometheus Operator** maakt daar een StatefulSet van:

```bash
kubectl get prometheus,alertmanager -n monitoring
```

Zo werken veel grote charts (databases, cert-manager, …): Helm installeert de operator en de configuratie, en de
operator doet de rest.

---

## 6. Prometheus, Grafana en Alertmanager openen

Alle Services zijn `ClusterIP`: van buiten bereik je ze met `kubectl port-forward`. Elk in een eigen venster:

```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-alertmanager 9093:9093
```

| URL | Wat |
|---|---|
| http://localhost:9090 | **Prometheus**. Kijk bij *Status → Targets*: alles wat Prometheus ophaalt. |
| http://localhost:3000 | **Grafana**. Gebruiker `admin`; het wachtwoord staat hieronder. *Dashboards* toont 29 dashboards. |
| http://localhost:9093 | **Alertmanager** |

Het wachtwoord van Grafana genereert de chart zelf. Het staat in een Secret (zoals de NOTES na de install zeggen):

```bash
kubectl get secret -n monitoring monitoring-grafana -o jsonpath="{.data.admin-password}" | base64 -d; echo
```

> Oude tutorials vermelden het wachtwoord `prom-operator`. Nieuwe versies van de chart genereren een willekeurig
> wachtwoord.

**4 targets "down"?** Op Minikube en kind luisteren de controller-manager, de scheduler, etcd en kube-proxy enkel op
`127.0.0.1` van de node. Prometheus kan ze niet bereiken. Dat is normaal op een lokale cluster; in de volgende stap
zet je ze uit.

---

## 7. Configureren met een values-bestand

Van de ruim 6000 regels in `helm show values` pas je er maar een paar aan. Die zet je in een eigen bestand:
[prometheus-grafana/monitoring-values.yaml](prometheus-grafana/monitoring-values.yaml).

```yaml
grafana:
  adminPassword: devops123        # enkel voor een lokale demo

prometheus:
  prometheusSpec:
    retention: 7d
    storageSpec:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 5Gi

alertmanager:
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 1Gi

kubeControllerManager: { enabled: false }
kubeScheduler: { enabled: false }
kubeEtcd: { enabled: false }
kubeProxy: { enabled: false }
```

**Hoe vind je die namen?** Zoek in `alle-values.yaml` (stap 3) of op de pagina van de chart op Artifact Hub. Neem
enkel de regels over die je wil veranderen, met dezelfde inspringing.

```bash
helm upgrade monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring -f prometheus-grafana/monitoring-values.yaml
```

Controleer:

```bash
helm history monitoring -n monitoring            # revision 2
helm get values monitoring -n monitoring         # jouw instellingen
kubectl get pvc -n monitoring                    # 2 volumes: 5Gi en 1Gi
```

**StatefulSet en volumes.** De `volumeClaimTemplate` geeft **elke pod van de StatefulSet** een eigen
PersistentVolumeClaim, met een vaste naam (`…-prometheus-0`). Start de pod opnieuw, dan krijgt hij hetzelfde volume
terug, en dus zijn metrics. Bij een Deployment kan dat niet: die pods zijn inwisselbaar en hebben geen vaste naam.

> Zonder `storageSpec` bewaart Prometheus zijn metrics in een `emptyDir`: bij elke herstart is alles weg.

---

## 8. Terugdraaien

```bash
helm rollback monitoring 1 -n monitoring
helm history monitoring -n monitoring
```

```
REVISION  STATUS      DESCRIPTION
1         superseded  Install complete
2         superseded  Upgrade complete
3         deployed    Rollback to 1
```

Een rollback maakt een **nieuwe** revision (3) met de inhoud van revision 1. Het Grafana-wachtwoord is weer het
gegenereerde. **De PVC's blijven bestaan**: Helm verwijdert nooit volumes die een StatefulSet heeft aangemaakt. Je
data is dus niet weg.

---

## 9. Een versie vastzetten

Zonder `--version` installeert Helm altijd de **nieuwste** versie. Die kan morgen anders zijn dan vandaag. In een
echte omgeving (en in je CI/CD-pipeline) zet je de versie vast:

```bash
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --version 92.11.0 -n monitoring --create-namespace \
  -f prometheus-grafana/monitoring-values.yaml
```

`helm upgrade --install`: installeren als de release nog niet bestaat, anders upgraden. Je kan het commando dus altijd
opnieuw uitvoeren.

---

## 10. Verwijderen

```bash
helm uninstall monitoring -n monitoring
kubectl get all,pvc -n monitoring             # de PVC's staan er nog
kubectl get crd | grep monitoring.coreos.com  # de CRDs ook
```

Twee dingen blijven achter, met opzet:

- **PVC's**: je data. Verwijder ze zelf als je ze niet meer nodig hebt: `kubectl delete pvc --all -n monitoring`.
- **CRDs**: andere releases kunnen ze nog gebruiken. Helm installeert CRDs (uit de map `crds/` van een chart) maar
  verwijdert ze nooit. Helemaal opruimen:

```bash
kubectl delete namespace monitoring
kubectl get crd -o name | grep monitoring.coreos.com | xargs kubectl delete
```

---

## Samengevat: Helm als package manager

| Wat | `apt` | Helm |
|---|---|---|
| zoeken | `apt search` | `helm search hub` / `helm search repo` |
| bron toevoegen | `add-apt-repository` | `helm repo add` |
| lijst bijwerken | `apt update` | `helm repo update` |
| info bekijken | `apt show` | `helm show chart` / `helm show values` |
| installeren | `apt install` | `helm install` |
| dependencies | automatisch | automatisch (`dependencies` in `Chart.yaml`) |
| configureren | bestanden in `/etc` | `-f values.yaml` |
| bijwerken | `apt upgrade` | `helm upgrade` |
| terug naar vorige versie | (moeilijk) | `helm rollback` |
| wat is geïnstalleerd | `apt list --installed` | `helm list -A` |
| verwijderen | `apt remove` (configuratie blijft) | `helm uninstall` (PVC's en CRDs blijven) |

---

## Oefeningen

1. Installeer de stack en zoek in Grafana het dashboard *Kubernetes / Compute Resources / Namespace (Pods)*. Hoeveel
   geheugen gebruikt de namespace `monitoring`?
2. Verander in je values-bestand de `retention` naar `3d` en upgrade. Waar zie je in Prometheus dat het gelukt is?
   (Tip: *Status → Runtime & Build Information*.)
3. Hoeveel pods van `node-exporter` draaien er op een cluster met 3 nodes? Waarom?
4. Verwijder de pod `prometheus-monitoring-kube-prometheus-prometheus-0`. Welke naam krijgt de nieuwe pod, en welk
   volume?
5. Maak Grafana bereikbaar via Traefik op `http://grafana.localhost`
   (zie [Monitoring met Prometheus en Grafana](../12-Monitoring/prometheus-grafana-helm.md)).

**Meer weten:** [kube-prometheus-stack op Artifact Hub](https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack)
· [Video: Prometheus en Grafana met Helm](https://www.youtube.com/watch?v=bwUECsVDbMA)
