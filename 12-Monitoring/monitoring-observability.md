# Advanced Monitoring & Observability - Complete Observability Stack

## Inhoudsopgave

1. [Introductie tot Observability](#introductie-tot-observability)
2. [De Drie Pilaren van Observability](#de-drie-pilaren-van-observability)
3. [Prometheus - Metrics Collection](#prometheus-metrics-collection)
4. [Grafana - Visualization](#grafana-visualization)
5. [Jaeger - Distributed Tracing](#jaeger-distributed-tracing)
6. [Application Performance Monitoring](#application-performance-monitoring)
7. [SLA/SLO/SLI Framework](#slaslosli-framework)
8. [Log Management](#log-management)
9. [Alerting en Incident Response](#alerting-en-incident-response)
10. [Praktische Implementatie](#praktische-implementatie)

---

## Introductie tot Observability

### Monitoring vs Observability

**Traditionele Monitoring:**
- Gebaseerd op vooraf gedefinieerde metrics
- Reactief - je weet wat je zoekt
- Dashboard-driven
- Beperkte context

**Observability:**
- Inzicht in interne staat van systemen via externe outputs
- Proactief - ontdek onbekende problemen
- Data-driven exploration
- Rijke context en correlatie

### Waarom Observability?

In moderne gedistribueerde systemen is het onmogelijk om alle mogelijke failure modes te voorspellen. Observability stelt je in staat om:

- **Unknown unknowns** te ontdekken
- **Complex systeem gedrag** te begrijpen
- **Sneller problemen** op te lossen
- **Betere user experience** te leveren
- **Data-driven beslissingen** te nemen

---

## De Drie Pilaren van Observability

### 1. Metrics (Wat er gebeurt)

Numerieke waarden die over tijd gemeten worden:
- **Counter**: Alleen toenemende waarden (requests, errors)
- **Gauge**: Waarden die op en neer gaan (CPU, memory)
- **Histogram**: Distributie van waarden (request duration)
- **Summary**: Pre-calculated percentiles

```promql
# Voorbeelden van metrics
http_requests_total{method="GET", status="200"}
cpu_usage_percent
request_duration_seconds
error_rate
```

### 2. Logs (Wat er precies gebeurde)

Tekstuele records van discrete events:
- **Structured logging** (JSON)
- **Contextual information**
- **Error details**
- **Audit trails**

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "ERROR",
  "message": "Database connection failed",
  "service": "user-api",
  "trace_id": "abc123",
  "span_id": "def456",
  "error": {
    "type": "ConnectionTimeout",
    "message": "Connection to database timed out after 30s"
  },
  "context": {
    "user_id": "12345",
    "request_id": "req-789"
  }
}
```

### 3. Traces (Hoe requests door het systeem reizen)

End-to-end request flow door gedistribueerde systemen:
- **Spans**: Individuele operaties
- **Traces**: Collectie van spans
- **Context propagation**
- **Performance bottlenecks**

```
Trace: User Registration Request
├── Frontend Span (200ms)
│   ├── API Gateway Span (150ms)
│   │   ├── User Service Span (100ms)
│   │   │   ├── Database Write Span (50ms)
│   │   │   └── Email Service Span (30ms)
│   │   └── Analytics Service Span (20ms)
│   └── CDN Span (50ms)
```

---

## Prometheus - Metrics Collection

### 1. Prometheus Installatie

**Met Helm:**
```bash
# Prometheus stack (Prometheus + Grafana + AlertManager)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi
```

Stap voor stap, getest op Minikube, met Grafana, PromQL, ServiceMonitors en alerts:
[Prometheus en Grafana (kube-prometheus-stack)](prometheus-grafana-helm.md).

**Manual configuratie:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    rule_files:
      - "rules/*.yml"
    
    alerting:
      alertmanagers:
        - static_configs:
            - targets:
              - alertmanager:9093
    
    scrape_configs:
      - job_name: 'prometheus'
        static_configs:
          - targets: ['localhost:9090']
      
      - job_name: 'kubernetes-pods'
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)
```

### 2. Application Metrics Instrumentatie

**Node.js voorbeeld:**
```javascript
const express = require('express');
const promClient = require('prom-client');

const app = express();

// Create a Registry
const register = new promClient.Registry();

// Default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.001, 0.01, 0.1, 1, 5, 10],
  registers: [register]
});

// Middleware voor metrics
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    
    httpRequestsTotal
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .inc();
    
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path)
      .observe(duration);
  });
  
  next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Business logic
app.get('/api/users', async (req, res) => {
  try {
    const users = await getUsersFromDatabase();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

**Python/Flask voorbeeld:**
```python
from flask import Flask, request, jsonify
from prometheus_client import Counter, Histogram, generate_latest
import time

app = Flask(__name__)

# Metrics definities
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

def track_requests(f):
    def wrapper(*args, **kwargs):
        start_time = time.time()
        
        try:
            response = f(*args, **kwargs)
            status = response.status_code if hasattr(response, 'status_code') else 200
        except Exception as e:
            status = 500
            raise e
        finally:
            REQUEST_COUNT.labels(
                method=request.method,
                endpoint=request.endpoint,
                status=status
            ).inc()
            
            REQUEST_LATENCY.labels(
                method=request.method,
                endpoint=request.endpoint
            ).observe(time.time() - start_time)
        
        return response
    
    wrapper.__name__ = f.__name__
    return wrapper

@app.route('/metrics')
def metrics():
    return generate_latest()

@app.route('/api/users')
@track_requests
def get_users():
    # Business logic hier
    return jsonify({"users": []})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

### 3. PromQL Queries

**Basic queries:**
```promql
# CPU usage
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage percentage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# HTTP request rate
rate(http_requests_total[5m])

# Error rate percentage
(rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])) * 100

# 95th percentile response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Advanced queries:**
```promql
# Top 5 services by error rate
topk(5, 
  (rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])) * 100
)

# Disk usage prediction (linear regression)
predict_linear(node_filesystem_avail_bytes[1h], 4*3600) < 0

# Alert wanneer service down is
up{job="my-service"} == 0

# High latency detection
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 0.5
```

---

## Grafana - Visualization

### 1. Grafana Setup

**Dashboard configuratie:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboards-config
data:
  dashboards.yaml: |
    apiVersion: 1
    providers:
      - name: 'default'
        orgId: 1
        folder: ''
        type: file
        disableDeletion: false
        updateIntervalSeconds: 10
        options:
          path: /var/lib/grafana/dashboards
```

**Data source configuratie:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
data:
  datasources.yaml: |
    apiVersion: 1
    datasources:
      - name: Prometheus
        type: prometheus
        access: proxy
        url: http://prometheus:9090
        isDefault: true
      - name: Jaeger
        type: jaeger
        access: proxy
        url: http://jaeger-query:16686
      - name: Loki
        type: loki
        access: proxy
        url: http://loki:3100
```

### 2. Essential Dashboards

**Service Overview Dashboard (JSON):**
```json
{
  "dashboard": {
    "title": "Service Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{service}} - {{method}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "(rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])) * 100"
          }
        ],
        "thresholds": [
          {"value": 1, "color": "yellow"},
          {"value": 5, "color": "red"}
        ]
      },
      {
        "title": "Response Time Percentiles",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          },
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "99th percentile"
          }
        ]
      }
    ]
  }
}
```

### 3. Custom Panels en Plugins

**Heatmap voor latency distributie:**
```json
{
  "title": "Request Latency Heatmap",
  "type": "heatmap",
  "targets": [
    {
      "expr": "increase(http_request_duration_seconds_bucket[1m])",
      "format": "heatmap",
      "legendFormat": "{{le}}"
    }
  ],
  "heatmap": {
    "xBucketSize": "1m",
    "yBucketSize": "auto"
  }
}
```

---

## Jaeger - Distributed Tracing

### 1. Jaeger Setup

**Jaeger All-in-One deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jaeger
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jaeger
  template:
    metadata:
      labels:
        app: jaeger
    spec:
      containers:
      - name: jaeger
        image: jaegertracing/all-in-one:1.50
        env:
        - name: COLLECTOR_OTLP_ENABLED
          value: "true"
        ports:
        - containerPort: 16686
          name: ui
        - containerPort: 14250
          name: grpc
        - containerPort: 14268
          name: http
        - containerPort: 4317
          name: otlp-grpc
        - containerPort: 4318
          name: otlp-http
---
apiVersion: v1
kind: Service
metadata:
  name: jaeger
spec:
  selector:
    app: jaeger
  ports:
  - name: ui
    port: 16686
    targetPort: 16686
  - name: grpc
    port: 14250
    targetPort: 14250
  - name: http
    port: 14268
    targetPort: 14268
  - name: otlp-grpc
    port: 4317
    targetPort: 4317
  - name: otlp-http
    port: 4318
    targetPort: 4318
```

### 2. Application Instrumentation

**Node.js met OpenTelemetry:**
```javascript
// instrumentation.js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

const jaegerExporter = new JaegerExporter({
  endpoint: 'http://jaeger:14268/api/traces',
});

const sdk = new NodeSDK({
  traceExporter: jaegerExporter,
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: 'user-service',
  serviceVersion: '1.0.0',
});

sdk.start();

// app.js
require('./instrumentation');
const express = require('express');
const { trace, context } = require('@opentelemetry/api');

const app = express();
const tracer = trace.getTracer('user-service');

app.get('/api/users/:id', async (req, res) => {
  const span = tracer.startSpan('get_user');
  
  try {
    span.setAttributes({
      'user.id': req.params.id,
      'http.method': req.method,
      'http.url': req.originalUrl
    });
    
    const user = await getUserFromDatabase(req.params.id);
    
    if (!user) {
      span.setStatus({ code: trace.SpanStatusCode.ERROR, message: 'User not found' });
      return res.status(404).json({ error: 'User not found' });
    }
    
    span.setStatus({ code: trace.SpanStatusCode.OK });
    res.json(user);
  } catch (error) {
    span.setStatus({ code: trace.SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});

async function getUserFromDatabase(userId) {
  const span = tracer.startSpan('database_query');
  
  try {
    span.setAttributes({
      'db.operation': 'SELECT',
      'db.table': 'users',
      'user.id': userId
    });
    
    // Database query logic
    const result = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    return result[0];
  } finally {
    span.end();
  }
}
```

**Python met OpenTelemetry:**
```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor

# Setup tracing
trace.set_tracer_provider(TracerProvider())
tracer_provider = trace.get_tracer_provider()

jaeger_exporter = JaegerExporter(
    agent_host_name="jaeger",
    agent_port=6831,
)

span_processor = BatchSpanProcessor(jaeger_exporter)
tracer_provider.add_span_processor(span_processor)

# Instrumenteer automatisch Flask en database calls
FlaskInstrumentor().instrument()
Psycopg2Instrumentor().instrument()

from flask import Flask
import time

app = Flask(__name__)
tracer = trace.get_tracer(__name__)

@app.route('/api/users/<int:user_id>')
def get_user(user_id):
    with tracer.start_as_current_span("get_user") as span:
        span.set_attribute("user.id", user_id)
        
        try:
            user = fetch_user_from_db(user_id)
            if not user:
                span.set_status(trace.Status(trace.StatusCode.ERROR, "User not found"))
                return {"error": "User not found"}, 404
            
            return {"user": user}
        except Exception as e:
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            span.record_exception(e)
            return {"error": "Internal server error"}, 500

def fetch_user_from_db(user_id):
    with tracer.start_as_current_span("database_query") as span:
        span.set_attribute("db.operation", "SELECT")
        span.set_attribute("db.table", "users")
        # Database logic hier
        time.sleep(0.1)  # Simulate DB call
        return {"id": user_id, "name": "John Doe"}
```

### 3. Trace Analysis

**Context Propagation:**
```javascript
// Service A -> Service B call met trace context
const axios = require('axios');
const { context, trace, propagation } = require('@opentelemetry/api');

async function callServiceB(data) {
  const span = tracer.startSpan('call_service_b');
  
  try {
    // Inject trace context in headers
    const headers = {};
    propagation.inject(context.active(), headers);
    
    const response = await axios.post('http://service-b/api/process', data, {
      headers
    });
    
    return response.data;
  } finally {
    span.end();
  }
}

// Service B extracts context
app.use((req, res, next) => {
  // Extract trace context from headers
  const parentContext = propagation.extract(context.active(), req.headers);
  
  context.with(parentContext, () => {
    next();
  });
});
```

---

## Application Performance Monitoring

### 1. Golden Signals

**Latency, Traffic, Errors, Saturation:**

```promql
# Latency (95th percentile)
histogram_quantile(0.95, 
  rate(http_request_duration_seconds_bucket{job="my-service"}[5m])
)

# Traffic (requests per second)
rate(http_requests_total{job="my-service"}[5m])

# Errors (error rate percentage)
(
  rate(http_requests_total{job="my-service",status=~"5.."}[5m]) /
  rate(http_requests_total{job="my-service"}[5m])
) * 100

# Saturation (CPU usage)
100 - (avg by (instance) (
  rate(node_cpu_seconds_total{mode="idle"}[5m])
) * 100)
```

### 2. RED Metrics (Request-focused)

```promql
# Rate - Requests per second
rate(http_requests_total[5m])

# Errors - Error percentage
(
  sum(rate(http_requests_total{status=~"5.."}[5m])) by (service) /
  sum(rate(http_requests_total[5m])) by (service)
) * 100

# Duration - Response time distribution
histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

### 3. USE Metrics (Resource-focused)

```promql
# Utilization - Resource usage percentage
# CPU
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Saturation - Queue lengths or wait times
# Load average
node_load1 / on(instance) count by (instance) (node_cpu_seconds_total{mode="idle"})

# Errors - Error counts
# Disk errors
rate(node_filesystem_device_error[5m])
```

---

## SLA/SLO/SLI Framework

### 1. Definities

**Service Level Indicator (SLI):**
Kwantitatieve meting van service niveau:
```promql
# Availability SLI
(
  sum(rate(http_requests_total{status!~"5.."}[5m])) /
  sum(rate(http_requests_total[5m]))
) * 100

# Latency SLI
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Service Level Objective (SLO):**
Target waarde voor SLI:
- Availability: 99.9% (43 min/month downtime)
- Latency: 95% of requests < 200ms
- Error rate: < 0.1%

**Service Level Agreement (SLA):**
Contract met consequenties bij niet-halen van SLO.

### 2. Error Budget Implementation

**Error budget berekening:**
```promql
# Error budget consumption (30 dagen)
(
  1 - (
    sum(increase(http_requests_total{status!~"5.."}[30d])) /
    sum(increase(http_requests_total[30d]))
  )
) / (1 - 0.999) * 100  # Voor 99.9% SLO
```

**Error budget alerting:**
```yaml
groups:
- name: error-budget
  rules:
  - alert: ErrorBudgetBurn
    expr: |
      (
        1 - (
          sum(rate(http_requests_total{status!~"5.."}[1h])) /
          sum(rate(http_requests_total[1h]))
        )
      ) > (1 - 0.999) * 14.4  # 14.4x burn rate = exhaust budget in 2 hours
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error budget burn rate"
      description: "Error budget will be exhausted in < 2 hours at current rate"
```

---

## Log Management

### 1. Structured Logging Best Practices

**Log structure:**
```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "INFO",
  "message": "User login successful",
  "service": "auth-service",
  "version": "1.2.3",
  "trace_id": "abc123def456",
  "span_id": "789xyz",
  "user_id": "user-12345",
  "session_id": "session-67890",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "duration_ms": 45,
  "context": {
    "feature_flags": ["new_ui", "enhanced_auth"],
    "experiment_id": "login_experiment_a"
  }
}
```

### 2. Loki Configuration

**Loki deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: loki
spec:
  replicas: 1
  selector:
    matchLabels:
      app: loki
  template:
    metadata:
      labels:
        app: loki
    spec:
      containers:
      - name: loki
        image: grafana/loki:2.9.0
        args:
          - -config.file=/etc/loki/local-config.yaml
        volumeMounts:
        - name: config
          mountPath: /etc/loki
        - name: storage
          mountPath: /tmp/loki
      volumes:
      - name: config
        configMap:
          name: loki-config
      - name: storage
        emptyDir: {}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
data:
  local-config.yaml: |
    auth_enabled: false
    server:
      http_listen_port: 3100
    ingester:
      lifecycler:
        address: 127.0.0.1
        ring:
          kvstore:
            store: inmemory
          replication_factor: 1
    schema_config:
      configs:
        - from: 2020-10-24
          store: boltdb-shipper
          object_store: filesystem
          schema: v11
          index:
            prefix: index_
            period: 24h
    storage_config:
      boltdb_shipper:
        active_index_directory: /tmp/loki/boltdb-shipper-active
        cache_location: /tmp/loki/boltdb-shipper-cache
        shared_store: filesystem
      filesystem:
        directory: /tmp/loki/chunks
    limits_config:
      enforce_metric_name: false
      reject_old_samples: true
      reject_old_samples_max_age: 168h
```

**Promtail voor log collection:**
```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: promtail
spec:
  selector:
    matchLabels:
      name: promtail
  template:
    metadata:
      labels:
        name: promtail
    spec:
      containers:
      - name: promtail
        image: grafana/promtail:2.9.0
        args:
          - -config.file=/etc/promtail/config.yml
        volumeMounts:
        - name: config
          mountPath: /etc/promtail
        - name: varlog
          mountPath: /var/log
          readOnly: true
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: promtail-config
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

---

## Alerting en Incident Response

### 1. AlertManager Configuration

```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@company.com'
  slack_api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
  - match:
      severity: critical
    receiver: 'critical-alerts'
  - match:
      severity: warning
    receiver: 'warning-alerts'

receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://webhook-service:5000/alerts'

- name: 'critical-alerts'
  slack_configs:
  - channel: '#alerts-critical'
    title: 'Critical Alert'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
  pagerduty_configs:
  - service_key: 'YOUR_PAGERDUTY_KEY'

- name: 'warning-alerts'
  slack_configs:
  - channel: '#alerts-warning'
    title: 'Warning Alert'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

### 2. Alert Rules

```yaml
groups:
- name: application-alerts
  rules:
  - alert: HighErrorRate
    expr: |
      (
        rate(http_requests_total{status=~"5.."}[5m]) /
        rate(http_requests_total[5m])
      ) * 100 > 5
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }}% for {{ $labels.service }}"
      runbook_url: "https://runbooks.company.com/high-error-rate"

  - alert: HighLatency
    expr: |
      histogram_quantile(0.95, 
        rate(http_request_duration_seconds_bucket[5m])
      ) > 0.5
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High latency detected"
      description: "95th percentile latency is {{ $value }}s"

  - alert: ServiceDown
    expr: up{job="my-service"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Service is down"
      description: "{{ $labels.instance }} has been down for more than 1 minute"

  - alert: DiskSpaceLow
    expr: |
      (
        node_filesystem_avail_bytes / 
        node_filesystem_size_bytes
      ) * 100 < 10
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Disk space is low"
      description: "Disk space is {{ $value }}% on {{ $labels.instance }}"
```

---

## Praktische Implementatie

### 1. Complete Monitoring Stack

**Kustomization voor monitoring namespace:**
```yaml
# kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: monitoring

resources:
- namespace.yaml
- prometheus/
- grafana/
- jaeger/
- loki/
- alertmanager/

configMapGenerator:
- name: monitoring-config
  files:
  - prometheus/prometheus.yml
  - grafana/datasources.yml
  - alertmanager/alertmanager.yml
```

### 2. Application Monitoring Setup

**Complete Node.js service met monitoring:**
```javascript
// monitoring.js
const promClient = require('prom-client');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route'],
  buckets: [0.001, 0.01, 0.1, 1, 5, 10],
  registers: [register]
});

// OpenTelemetry setup
const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: 'user-service',
});
sdk.start();

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDuration
};

// app.js
const express = require('express');
const winston = require('winston');
const { register, httpRequestsTotal, httpRequestDuration } = require('./monitoring');

// Structured logging
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

const app = express();

// Monitoring middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    
    httpRequestsTotal
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .inc();
    
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path)
      .observe(duration);
    
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: duration,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Business endpoints
app.get('/api/users', async (req, res) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (error) {
    logger.error('Failed to get users', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  logger.info('Server started', { port: 3000 });
});
```

### 3. Kubernetes Monitoring Labels

**Deployment met monitoring annotations:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  labels:
    app: user-service
    version: "1.0.0"
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
        version: "1.0.0"
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: user-service
        image: user-service:1.0.0
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: JAEGER_ENDPOINT
          value: "http://jaeger:14268/api/traces"
        - name: LOKI_ENDPOINT
          value: "http://loki:3100"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

---

## Conclusie

Een complete observability stack is essentieel voor moderne gedistribueerde applicaties. Door metrics, logs en traces te combineren krijg je:

**Voordelen:**
- **Snellere troubleshooting** - van symptoom naar root cause
- **Proactieve monitoring** - problemen oplossen voordat gebruikers het merken  
- **Data-driven decisions** - optimalisaties gebaseerd op echte data
- **Better user experience** - consistente performance en reliability

**Key components:**
- **Prometheus + Grafana** - Metrics collection en visualisatie
- **Jaeger** - Distributed tracing voor request flows
- **Loki** - Centralized logging met powerful querying
- **AlertManager** - Intelligent alerting en escalation

**Best practices:**
- Start met golden signals (latency, traffic, errors, saturation)
- Implementeer SLO/SLI framework voor objectieve targets
- Gebruik structured logging voor betere searchability
- Automate alerting met proper escalation
- Correlate data across all three pillars

**Volgende stappen:**
- Deploy monitoring stack in je Kubernetes cluster
- Instrument je applicaties met metrics en tracing
- Definieer SLOs voor je services
- Setup alerting en incident response procedures
- Train je team in observability practices

---

*Deze cursus is onderdeel van de DevOps & Cloud Native training door Milan Dima (milan.dima@vives.be)*