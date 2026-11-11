# 12 - Monitoring & Observability: verdieping

De praktische les, met installatie, PromQL, Grafana en alerts, staat in
[Monitoring met Prometheus en Grafana](prometheus-grafana-helm.md). Dit document gaat dieper in op de ideeën erachter:
**wat** meet je, hoe instrumenteer je je eigen app, en waar passen logs en traces in het verhaal.

---

## 1. Monitoring en observability

| | Monitoring | Observability |
|---|---|---|
| Vraag | "Is er iets mis met wat ik al ken?" | "Waarom gebeurt dit, ook als ik het nooit voorzag?" |
| Werkwijze | vooraf gekozen metrics, dashboards en alerts | vrij zoeken en combineren in metrics, logs en traces |
| Typisch voor | één app, gekende fouten | veel services die elkaar aanroepen |

Monitoring is een deel van observability. In een kleine opzet (zoals PetShelter) kom je met goede monitoring ver.

---

## 2. De drie pijlers

### Metrics: wat er gebeurt, in getallen

| Type | Gedrag | Voorbeeld |
|---|---|---|
| **counter** | gaat enkel omhoog | aantal requests, aantal fouten |
| **gauge** | gaat op en neer | geheugen, aantal pods |
| **histogram** | telt waarden in vakjes (*buckets*) | duur van requests: hoeveel < 0,1 s, < 0,5 s, … |
| **summary** | berekent percentielen in de app zelf | zelden nodig; gebruik een histogram |

Met een histogram bereken je **percentielen**: "95% van de requests is sneller dan 300 ms".

```promql
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))
```

Een **gemiddelde** verbergt problemen: 99 snelle requests en 1 van 10 seconden geven een mooi gemiddelde, maar
één gebruiker wacht 10 seconden. Kijk daarom naar het 95ste of 99ste percentiel.

### Logs: wat er precies gebeurde

Schrijf logs **gestructureerd** (JSON) naar stdout. Dan kan je erin zoeken en filteren:

```json
{"time": "2026-11-12T10:30:00Z", "level": "error", "msg": "database timeout", "service": "backend", "trace_id": "abc123"}
```

In Kubernetes lees je logs met `kubectl logs`. Die zijn weg zodra de pod verdwijnt. Wil je ze bewaren en
doorzoeken, dan verzamel je ze centraal, bv. met **Loki** (met **Grafana Alloy** als verzamelaar op elke node; het
oudere Promtail wordt niet meer ondersteund). Je bekijkt ze dan in dezelfde Grafana als je metrics.

### Traces: de weg van één request

```
GET /api/pets                       240 ms
├── frontend                         20 ms
└── backend                         210 ms
    ├── auth-check                   15 ms
    └── MongoDB find                180 ms   ← hier zit de tijd
```

Een **trace** volgt één request langs alle services. Elk stukje is een **span**. Traces zijn vooral nuttig als
je veel services hebt die elkaar aanroepen. De standaard om ze te maken is **OpenTelemetry**; je stuurt ze via het
OTLP-protocol naar **Jaeger** of **Grafana Tempo**.

De `trace_id` in je logs verbindt de drie pijlers: van een piek in een grafiek, naar de logs van dat moment, naar
de trace van één trage request.

---

## 3. Wat meet je?

Je kan duizenden metrics verzamelen. Deze drie lijstjes helpen je kiezen.

### De vier golden signals (Google SRE)

| Signaal | Vraag | PromQL |
|---|---|---|
| **Latency** | hoe snel? | `histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))` |
| **Traffic** | hoeveel? | `sum(rate(http_requests_total[5m]))` |
| **Errors** | hoeveel fout? | `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))` |
| **Saturation** | hoe vol? | `100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))` |

### RED, voor services

**R**ate (requests/s), **E**rrors (fouten/s), **D**uration (hoe lang). Voor elke API of webapp: de eerste drie
grafieken op je dashboard.

### USE, voor resources

Per resource (CPU, geheugen, schijf, netwerk): **U**tilization (hoe vol), **S**aturation (hoeveel moet er wachten),
**E**rrors. Dit is wat de node-exporter-dashboards in Grafana tonen.

---

## 4. SLI, SLO en SLA

| Begrip | Wat | Voorbeeld |
|---|---|---|
| **SLI** (indicator) | een meting | % requests zonder 5xx-fout |
| **SLO** (objective) | je doel voor die meting | 99,9% over 30 dagen |
| **SLA** (agreement) | een contract met de klant, met gevolgen | onder 99,5%: korting op de factuur |

Je SLO is strenger dan je SLA: zo merk je problemen voor ze geld kosten.

### Error budget

99,9% beschikbaar = 0,1% mag mislukken. Over 30 dagen is dat **43 minuten** downtime. Dat is je **error budget**.

- Budget over? Dan mag je risico nemen: nieuwe features releasen, experimenteren.
- Budget op? Dan eerst stabiliteit, geen risicovolle releases.

Zo wordt "hoe betrouwbaar moet het zijn?" een afspraak in cijfers in plaats van een discussie.

**Burn rate** is hoe snel je het budget opsoupeert. Een burn rate van 1 betekent: precies op, na 30 dagen. Bij een
burn rate van 14,4 verbruik je in één uur 2% van je maandbudget, en is het na ongeveer 2 dagen op. Dat is een goede
drempel voor een dringende alert:

```yaml
- alert: ErrorBudgetBurn
  expr: |
    (
      sum(rate(http_requests_total{status=~"5.."}[1h]))
      / sum(rate(http_requests_total[1h]))
    ) > 14.4 * (1 - 0.999)
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: Error budget raakt snel op (burn rate > 14,4)
```

---

## 5. Je eigen app instrumenteren (Node.js)

Met het pakket [prom-client](https://github.com/siimon/prom-client) toont je Express-app een pagina `/metrics`:

```bash
npm install prom-client
```

```javascript
const express = require('express');
const client = require('prom-client');

const app = express();

// Standaardmetrics van Node.js: geheugen, CPU, event loop, ...
client.collectDefaultMetrics();

const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Aantal HTTP-requests',
  labelNames: ['method', 'route', 'status'],
});

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duur van HTTP-requests in seconden',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

// Elke request meten
app.use((req, res, next) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path ?? 'onbekend';   // de route, niet de volledige URL
    httpRequests.inc({ method: req.method, route, status: res.statusCode });
    end({ method: req.method, route });
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.get('/api/pets', (req, res) => res.json([]));

app.listen(5000);
```

- Gebruik als label de **route** (`/api/pets/:id`), niet de volledige URL (`/api/pets/123`). Elke unieke
  labelwaarde is een aparte tijdreeks: met ID's in je labels groeit Prometheus eindeloos (*cardinality explosion*).
- Daarna: een **ServiceMonitor** met het label `release: monitoring` en de **naam** van de poort in je Service, zoals
  in [sectie 6 van de praktische les](prometheus-grafana-helm.md#6-je-eigen-app-monitoren).

---

## 6. Goede alerts

- **Alert op symptomen, niet op oorzaken.** "Gebruikers krijgen fouten" (error rate) is een goede alert. "CPU op 80%"
  meestal niet: misschien merkt niemand er iets van.
- **Elke alert moet een actie vragen.** Een alert waar je niets mee doet, leert je team alerts te negeren.
- **Gebruik `for:`** zodat een korte hapering geen alarm geeft.
- **Twee niveaus van `severity`:** `critical` (nu iemand wakker maken) en `warning` (morgen bekijken). Alertmanager
  stuurt ze naar een ander kanaal.
- **Monitor ook van buitenaf**: zie [sectie 8 van de praktische les](prometheus-grafana-helm.md#8-van-buiten-de-cluster-monitoren).

---

## Samengevat

| Vraag | Antwoord |
|---|---|
| Gaat het goed? | **metrics** + dashboards + alerts (Prometheus, Grafana) |
| Wat gebeurde er precies? | **logs** (`kubectl logs`, Loki) |
| Waar zit de vertraging? | **traces** (OpenTelemetry, Jaeger, Tempo) |
| Wat meet ik? | golden signals, RED voor services, USE voor resources |
| Hoe betrouwbaar moet het zijn? | SLO en error budget |
