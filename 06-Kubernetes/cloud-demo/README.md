# Virtuweb – cloud demo (Les 6a)

Bestanden voor de demo in [kubernetes-cloud-start.md](../kubernetes-cloud-start.md).

| Bestand | Doel |
|---|---|
| `index.html` | De "webshop" (v1) |
| `Dockerfile` | nginx + index.html → image `virtuweb` |
| `virtuweb-deployment.yaml` | Deployment met 3 replicas |
| `virtuweb-service.yaml` | Service van type `LoadBalancer` (→ Linode NodeBalancer) |

```bash
# 1. Image bouwen voor amd64 én arm64 en pushen
docker buildx build --platform linux/amd64,linux/arm64 -t <user>/virtuweb:v1 --push .

# 2. Verbinden met het cluster
export KUBECONFIG=$PWD/virtuweb-kubeconfig.yaml
kubectl get nodes

# 3. Deployen (eerst DOCKERHUB-USER vervangen in de deployment!)
kubectl apply -f virtuweb-deployment.yaml
kubectl apply -f virtuweb-service.yaml
kubectl get svc virtuweb-service -w     # wacht op EXTERNAL-IP

# 4. Opruimen: eerst de service (verwijdert de NodeBalancer), dan het cluster
kubectl delete -f .
```
