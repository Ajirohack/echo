# Echo Kubernetes Deployment

This directory contains Kubernetes manifests and deployment configurations for the Echo real-time translation application.

## Overview

The Echo application is deployed as a microservices architecture on Kubernetes with the following components:

- **Echo App**: Main application server with WebRTC and translation capabilities
- **PostgreSQL**: Primary database for user data and translations
- **Redis**: Caching and session storage
- **Elasticsearch**: Search and analytics engine
- **Nginx**: Reverse proxy and load balancer
- **Prometheus**: Metrics collection and monitoring
- **Grafana**: Visualization and dashboards

## Directory Structure

```
k8s/
├── README.md                    # This file
├── deploy.sh                    # Deployment script
├── kustomization.yaml           # Base Kustomize configuration
├── namespace.yaml               # Namespace and base resources
├── rbac.yaml                    # Role-based access control
├── echo-app-deployment.yaml     # Echo application deployment
├── postgres-deployment.yaml     # PostgreSQL database
├── redis-deployment.yaml        # Redis cache
├── elasticsearch-deployment.yaml # Elasticsearch search
├── nginx-deployment.yaml        # Nginx reverse proxy
├── monitoring-deployment.yaml   # Prometheus and Grafana
├── ingress.yaml                 # Ingress and network policies
├── hpa.yaml                     # Auto-scaling configurations
└── overlays/                    # Environment-specific configurations
    ├── development/             # Development environment
    ├── staging/                 # Staging environment
    └── production/              # Production environment
```

## Prerequisites

### Required Tools

- `kubectl` (v1.25+)
- `kustomize` (v4.5+) or `kubectl` with built-in kustomize
- `docker` (for building images)
- `helm` (optional, for cert-manager)

### Cluster Requirements

- Kubernetes cluster (v1.25+)
- Minimum 4 CPU cores and 8GB RAM
- Storage class for persistent volumes
- Ingress controller (nginx-ingress recommended)
- cert-manager (for SSL certificates)

## Quick Start

### 1. Deploy to Development Environment

```bash
# Make the deployment script executable
chmod +x deploy.sh

# Deploy to development
./deploy.sh -n echo-dev
```

### 2. Deploy to Staging Environment

```bash
# Deploy using Kustomize overlay
kubectl apply -k overlays/staging

# Or use the deployment script
./deploy.sh -n echo-staging -c staging-cluster
```

### 3. Deploy to Production Environment

```bash
# Deploy using Kustomize overlay
kubectl apply -k overlays/production

# Or use the deployment script with production settings
./deploy.sh -n echo-prod -c prod-cluster --skip-build
```

## Environment Configurations

### Development

- **Namespace**: `echo-dev`
- **Replicas**: Minimal (1-2 per service)
- **Resources**: Low resource limits
- **Features**: Debug mode, hot reload, NodePort services
- **Access**: Direct port-forwarding

### Staging

- **Namespace**: `echo-staging`
- **Replicas**: Medium (2-3 per service)
- **Resources**: Moderate resource limits
- **Features**: Production-like with debug capabilities
- **Access**: LoadBalancer with staging domain

### Production

- **Namespace**: `echo-prod`
- **Replicas**: High availability (3+ per service)
- **Resources**: Full resource allocation
- **Features**: Optimized for performance and security
- **Access**: LoadBalancer with SSL termination

## Deployment Options

### Using the Deployment Script

The `deploy.sh` script provides a convenient way to deploy Echo:

```bash
# Basic deployment
./deploy.sh

# Advanced deployment options
./deploy.sh \
  --namespace echo-prod \
  --context production-cluster \
  --skip-build \
  --wait 600

# Check deployment status
./deploy.sh --status

# View application logs
./deploy.sh --logs

# Delete deployment
./deploy.sh --delete
```

### Using Kustomize Directly

```bash
# Deploy base configuration
kubectl apply -k .

# Deploy specific environment
kubectl apply -k overlays/production

# Preview changes (dry run)
kubectl apply -k overlays/staging --dry-run=client
```

### Using kubectl Directly

```bash
# Apply manifests in order
kubectl apply -f namespace.yaml
kubectl apply -f rbac.yaml
kubectl apply -f postgres-deployment.yaml
kubectl apply -f redis-deployment.yaml
kubectl apply -f elasticsearch-deployment.yaml
kubectl apply -f echo-app-deployment.yaml
kubectl apply -f nginx-deployment.yaml
kubectl apply -f monitoring-deployment.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml
```

## Configuration

### Environment Variables

Key environment variables that can be customized:

```bash
# Database configuration
export POSTGRES_PASSWORD="your-secure-password"
export REDIS_PASSWORD="your-redis-password"

# Application configuration
export JWT_SECRET="your-jwt-secret"
export NODE_ENV="production"
export LOG_LEVEL="info"

# Monitoring
export GRAFANA_ADMIN_PASSWORD="your-grafana-password"
```

### Secrets Management

Secrets are automatically generated during deployment, but you can pre-create them:

```bash
# Create main application secrets
kubectl create secret generic echo-secrets \
  --namespace=echo \
  --from-literal=postgres-password="$(openssl rand -base64 32)" \
  --from-literal=redis-password="$(openssl rand -base64 32)" \
  --from-literal=jwt-secret="$(openssl rand -base64 64)"

# Create monitoring authentication
htpasswd -c auth admin
kubectl create secret generic echo-monitoring-auth \
  --namespace=echo \
  --from-file=auth
```

### SSL Certificates

For production deployments, configure SSL certificates:

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@domain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

## Monitoring and Observability

### Accessing Monitoring Services

```bash
# Port-forward to Grafana
kubectl port-forward service/echo-grafana-service 3000:3000 -n echo
# Access: http://localhost:3000 (admin/admin)

# Port-forward to Prometheus
kubectl port-forward service/echo-prometheus-service 9090:9090 -n echo
# Access: http://localhost:9090
```

### Key Metrics

- **Application Performance**: Response times, throughput, error rates
- **Resource Usage**: CPU, memory, disk, network
- **Database Performance**: Connection pools, query performance
- **Translation Quality**: Success rates, processing times
- **WebRTC Statistics**: Connection quality, audio metrics

### Logs

```bash
# View application logs
kubectl logs -l app=echo-app -n echo --tail=100 -f

# View all pod logs
kubectl logs -l app.kubernetes.io/part-of=echo-platform -n echo

# View specific service logs
kubectl logs deployment/echo-postgres -n echo
```

## Scaling

### Horizontal Pod Autoscaling

HPA is configured for automatic scaling based on CPU and memory usage:

```bash
# Check HPA status
kubectl get hpa -n echo

# Manual scaling
kubectl scale deployment echo-app --replicas=5 -n echo
```

### Vertical Pod Autoscaling

VPA is configured for database services to optimize resource allocation:

```bash
# Check VPA recommendations
kubectl get vpa -n echo
kubectl describe vpa echo-postgres-vpa -n echo
```

## Troubleshooting

### Common Issues

1. **Pods not starting**:

   ```bash
   kubectl describe pod <pod-name> -n echo
   kubectl logs <pod-name> -n echo
   ```

2. **Service connectivity issues**:

   ```bash
   kubectl get endpoints -n echo
   kubectl exec -it <pod-name> -n echo -- nslookup echo-app-service
   ```

3. **Persistent volume issues**:

   ```bash
   kubectl get pv,pvc -n echo
   kubectl describe pvc <pvc-name> -n echo
   ```

4. **Ingress not working**:

   ```bash
   kubectl describe ingress echo-ingress -n echo
   kubectl logs -l app.kubernetes.io/name=ingress-nginx -n ingress-nginx
   ```

### Health Checks

```bash
# Check all deployments
kubectl get deployments -n echo

# Check pod status
kubectl get pods -n echo -o wide

# Check services
kubectl get services -n echo

# Check ingress
kubectl get ingress -n echo
```

### Performance Testing

```bash
# Load test the application
kubectl run load-test --image=busybox --rm -it --restart=Never -- \
  wget -qO- --timeout=2 http://echo-app-service:8080/health

# Database connection test
kubectl exec -it deployment/echo-postgres -n echo -- \
  psql -U echo -d echo_db -c "SELECT version();"
```

## Security

### Network Policies

Network policies are configured to restrict traffic between services:

- Nginx can communicate with Echo app
- Echo app can communicate with databases
- Monitoring services have limited access
- External traffic is controlled via ingress

### Pod Security

- All containers run as non-root users
- Security contexts are configured
- Resource limits are enforced
- Read-only root filesystems where possible

### RBAC

Role-based access control is configured with minimal required permissions:

- Service accounts for each component
- Roles with specific permissions
- Pod security policies (where supported)

## Backup and Recovery

### Database Backup

```bash
# Create database backup
kubectl exec -it deployment/echo-postgres -n echo -- \
  pg_dump -U echo echo_db > backup.sql

# Restore database
kubectl exec -i deployment/echo-postgres -n echo -- \
  psql -U echo echo_db < backup.sql
```

### Persistent Volume Backup

```bash
# Create volume snapshots (if supported)
kubectl create -f - <<EOF
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: echo-postgres-snapshot
  namespace: echo
spec:
  source:
    persistentVolumeClaimName: echo-postgres-pvc
EOF
```

## Upgrading

### Application Updates

```bash
# Update application image
kubectl set image deployment/echo-app echo-app=echo-app:v1.1.0 -n echo

# Check rollout status
kubectl rollout status deployment/echo-app -n echo

# Rollback if needed
kubectl rollout undo deployment/echo-app -n echo
```

### Database Migrations

```bash
# Run database migrations
kubectl exec -it deployment/echo-app -n echo -- \
  npm run migrate

# Check migration status
kubectl exec -it deployment/echo-postgres -n echo -- \
  psql -U echo echo_db -c "SELECT * FROM schema_migrations;"
```

## Support

For issues and questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review application logs
3. Check Kubernetes events: `kubectl get events -n echo`
4. Consult the main project documentation

## Contributing

When modifying Kubernetes manifests:

1. Test changes in development environment first
2. Update relevant overlay configurations
3. Validate with `kubectl apply --dry-run=client`
4. Update this documentation if needed
5. Test deployment script with new changes

---

**Note**: Replace `your-domain.com` with your actual domain name in ingress configurations and SSL certificates.
