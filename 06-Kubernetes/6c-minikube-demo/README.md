# Pet Shelter App - MERN Stack

A simplified 3-tier application built with MongoDB, Express, React (HTML/JS), and Node.js for demonstration purposes.

## Project Overview

This is a basic Pet Shelter application that allows users to:
- View all pets in the shelter
- Add new pets to the shelter

The application consists of:
- **Frontend**: Simple HTML/JavaScript interface served by Express
- **Backend**: Node.js REST API with two endpoints
- **Database**: MongoDB for data persistence

## Architecture

```
Frontend (Port 3000) --> Backend API (Port 5100:5000) --> MongoDB (Port 27017)
```

## API Endpoints

- `GET /api/pets` - Retrieve all pets
- `POST /api/pets` - Add a new pet

Backend runs on port 5000 inside Docker, mapped to port 5100 on host (Mac uses port 5000 for AirPlay).

## Running with Docker Compose

Build and run all services:

```bash
docker-compose up --build
```

Access the application at `http://localhost:3000`

## Building Docker Images for Kubernetes

Build and tag images:

```bash
# Backend
cd backend
docker build -t dimilan/pet-shelter-backend:latest .
docker push dimilan/pet-shelter-backend:latest

# Frontend
cd ../frontend
docker build -t dimilan/pet-shelter-frontend:latest .
docker push dimilan/pet-shelter-frontend:latest
```

## Deploying to Kubernetes (Minikube)

1. Start Minikube:
```bash
minikube start
```

2. Build Docker images in Minikube's Docker daemon:
```bash
# Point shell to minikube's docker
eval $(minikube docker-env)

# Build backend
cd backend
docker build -t dimilan/pet-shelter-backend:latest .

# Build frontend
cd ../frontend
docker build -t dimilan/pet-shelter-frontend:latest .

cd ..
```

3. Apply Kubernetes configurations:
```bash
kubectl apply -f k8s/mongodb-secret.yaml
kubectl apply -f k8s/mongodb-configmap.yaml
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
```

4. Wait for pods to be ready:
```bash
kubectl get pods -w
```

5. Access the frontend service:
```bash
# Option 1: Use minikube service (creates a tunnel)
minikube service frontend-service

# Option 2: Direct access via NodePort
# Get minikube IP
minikube ip
# Access at http://<minikube-ip>:32500
```

6. Verify the application:
```bash
# Check backend logs for database seeding
kubectl logs -l app=backend

# Should show:
# Connecting to MongoDB...
# Server running on port 5000
# Connected to MongoDB
# Database seeded with initial pets
```

**Note:** Images use `imagePullPolicy: Never` to use locally built images in Minikube instead of pulling from DockerHub.

## Kubernetes Resources

- **Secret**: MongoDB credentials stored as base64 encoded values
  - `username`: admin (base64: YWRtaW4=)
  - `password`: password (base64: cGFzc3dvcmQ=)
- **ConfigMap**: MongoDB connection parameters
  - `database-url`: mongodb-service
  - `database-port`: 27017
  - `database-name`: petshelter
- **Deployments**: MongoDB, Backend, Frontend
- **Services**: 
  - mongodb-service (ClusterIP on port 27017)
  - backend-service (ClusterIP on port 5000)
  - frontend-service (NodePort on port 32500)

The backend constructs the MongoDB connection string from individual environment variables sourced from the Secret and ConfigMap, following security best practices.

## Environment Variables

### Backend
- `MONGO_URL`: MongoDB connection string (from ConfigMap in K8s)
- `PORT`: Server port (default: 5000)

### MongoDB
- `MONGO_INITDB_ROOT_USERNAME`: Admin username (from Secret in K8s)
- `MONGO_INITDB_ROOT_PASSWORD`: Admin password (from Secret in K8s)

## Notes

- No authentication/authorization implemented
- Minimal error handling
- Designed for learning Docker and Kubernetes concepts
- Uses NodePort service type for easy access in Minikube
