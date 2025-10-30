# Deployment Guide

This guide covers deploying the After Party application to a Kubernetes cluster on Digital Ocean.

## Overview

The application is containerized using Docker and deployed to Kubernetes using Helm charts. The setup includes:

- **Docker**: Multi-stage build for optimized production images
- **Kubernetes**: For orchestration and scaling
- **Helm**: For templated Kubernetes deployments
- **Digital Ocean**: Managed Kubernetes cluster
- **NGINX Ingress**: For HTTP(S) routing
- **cert-manager**: For automatic SSL certificates

## Prerequisites

Before deploying, ensure you have:

1. **Digital Ocean Account** with billing enabled
2. **Docker** installed locally
3. **kubectl** - Kubernetes CLI
4. **Helm 3.x** - Kubernetes package manager
5. **doctl** - Digital Ocean CLI (optional but recommended)

### Install Required Tools

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/darwin/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Install Helm
brew install helm

# Install doctl (Digital Ocean CLI)
brew install doctl
doctl auth init
```

## Step 1: Create Digital Ocean Kubernetes Cluster

### Via Web Console

1. Go to [Digital Ocean Control Panel](https://cloud.digitalocean.com/)
2. Click "Create" → "Kubernetes"
3. Configure cluster:
   - **Region**: Choose closest to your users
   - **Node Pool**: Start with 2-3 nodes (e.g., Basic nodes, 2GB RAM, 1 vCPU)
   - **Cluster Name**: `after-party-prod`
4. Click "Create Cluster"

### Via CLI

```bash
doctl kubernetes cluster create after-party-prod \
  --region nyc1 \
  --node-pool "name=worker-pool;size=s-2vcpu-4gb;count=2;auto-scale=true;min-nodes=2;max-nodes=5"
```

### Connect to Cluster

```bash
# Save cluster credentials
doctl kubernetes cluster kubeconfig save after-party-prod

# Verify connection
kubectl cluster-info
kubectl get nodes
```

## Step 2: Setup Container Registry

### Create Digital Ocean Container Registry

```bash
# Create registry
doctl registry create after-party-registry

# Login to registry
doctl registry login
```

### Alternative: Use Docker Hub

```bash
docker login
```

## Step 3: Build and Push Docker Image

```bash
# Navigate to project root
cd /Users/aleccunningham/Projects/github.com/moosh3/after-party

# Build the image
docker build -t registry.digitalocean.com/after-party-registry/after-party:v1.0.0 .

# Push to registry
docker push registry.digitalocean.com/after-party-registry/after-party:v1.0.0

# Tag as latest
docker tag registry.digitalocean.com/after-party-registry/after-party:v1.0.0 \
  registry.digitalocean.com/after-party-registry/after-party:latest
docker push registry.digitalocean.com/after-party-registry/after-party:latest
```

## Step 4: Setup Kubernetes Infrastructure

### Install NGINX Ingress Controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install nginx-ingress ingress-nginx/ingress-nginx \
  --create-namespace \
  --namespace ingress-nginx \
  --set controller.service.type=LoadBalancer \
  --set controller.metrics.enabled=true

# Wait for external IP
kubectl get svc -n ingress-nginx -w
```

Note the EXTERNAL-IP and create an A record pointing your domain to this IP.

### Install cert-manager for SSL

```bash
# Add Helm repository
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Install CRDs
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.crds.yaml

# Install cert-manager
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.13.0

# Create Let's Encrypt ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

## Step 5: Configure Application

### Generate Required Secrets

```bash
# Generate JWT secret
openssl rand -base64 32

# Generate admin password hash
npm run generate-admin-hash
```

### Create Production Values File

Copy the example values file:

```bash
cp helm/after-party/values-production.example.yaml helm/after-party/values-production.yaml
```

Edit `helm/after-party/values-production.yaml` and fill in your values:

```yaml
image:
  repository: registry.digitalocean.com/after-party-registry/after-party
  tag: "v1.0.0"

ingress:
  hosts:
    - host: your-domain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: after-party-tls
      hosts:
        - your-domain.com

secrets:
  NEXT_PUBLIC_SUPABASE_URL: "https://xxxxx.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGc..."
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGc..."
  MUX_TOKEN_ID: "xxxxx"
  MUX_TOKEN_SECRET: "xxxxx"
  ADMIN_PASSWORD_HASH: "$2a$10$..."
  JWT_SECRET: "xxxxx"
```

**Important**: Add this file to `.gitignore`!

```bash
echo "helm/after-party/values-production.yaml" >> .gitignore
```

## Step 6: Deploy Application

### Initial Deployment

```bash
# Create namespace
kubectl create namespace after-party

# Deploy with Helm
helm install after-party ./helm/after-party \
  -f helm/after-party/values-production.yaml \
  --namespace after-party

# Watch the deployment
kubectl get pods -n after-party -w
```

### Verify Deployment

```bash
# Check all resources
kubectl get all -n after-party

# Check pod logs
kubectl logs -f deployment/after-party -n after-party

# Check ingress
kubectl get ingress -n after-party

# Describe ingress for details
kubectl describe ingress after-party -n after-party
```

### Test the Application

```bash
# Port forward for local testing
kubectl port-forward svc/after-party 3000:80 -n after-party

# Test health endpoint
curl http://localhost:3000/api/health

# Access via domain (wait for DNS propagation)
curl https://your-domain.com/api/health
```

## Step 7: Monitor and Maintain

### View Logs

```bash
# Real-time logs
kubectl logs -f deployment/after-party -n after-party

# Logs from all pods
kubectl logs -l app.kubernetes.io/name=after-party -n after-party

# Last 100 lines
kubectl logs deployment/after-party -n after-party --tail=100
```

### Check Status

```bash
# Pod status
kubectl get pods -n after-party

# Deployment status
kubectl get deployment after-party -n after-party

# Service endpoints
kubectl get endpoints -n after-party

# Events
kubectl get events -n after-party --sort-by='.lastTimestamp'
```

### Scale Application

```bash
# Manual scaling
kubectl scale deployment after-party --replicas=5 -n after-party

# Auto-scaling is enabled by default in values.yaml
kubectl get hpa -n after-party
```

## Updating the Application

### Deploy New Version

```bash
# Build new image
docker build -t registry.digitalocean.com/after-party-registry/after-party:v1.1.0 .
docker push registry.digitalocean.com/after-party-registry/after-party:v1.1.0

# Update values file with new tag
# Then upgrade
helm upgrade after-party ./helm/after-party \
  -f helm/after-party/values-production.yaml \
  --namespace after-party

# Watch rollout
kubectl rollout status deployment/after-party -n after-party
```

### Rollback if Needed

```bash
# View release history
helm history after-party -n after-party

# Rollback to previous version
helm rollback after-party -n after-party

# Rollback to specific revision
helm rollback after-party 2 -n after-party
```

## Troubleshooting

### Pods Not Starting

```bash
# Describe pod to see errors
kubectl describe pod <pod-name> -n after-party

# Check events
kubectl get events -n after-party --sort-by='.lastTimestamp'

# Check image pull
kubectl get pods -n after-party -o jsonpath='{.items[*].status.containerStatuses[*].state}'
```

### DNS/Ingress Issues

```bash
# Check ingress configuration
kubectl describe ingress after-party -n after-party

# Check certificate status
kubectl get certificate -n after-party
kubectl describe certificate after-party-tls -n after-party

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

### Database Connection Issues

```bash
# Test from within pod
kubectl exec -it deployment/after-party -n after-party -- /bin/sh

# Inside pod:
apk add curl
curl $NEXT_PUBLIC_SUPABASE_URL/rest/v1/
```

### Performance Issues

```bash
# Check resource usage
kubectl top pods -n after-party
kubectl top nodes

# Check HPA status
kubectl get hpa -n after-party
kubectl describe hpa after-party -n after-party
```

## Cost Optimization

### Development Environment

Use a smaller configuration:

```yaml
replicaCount: 1

autoscaling:
  enabled: false

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi
```

### Production Environment

Optimize based on traffic:

- Start with 2 replicas
- Enable auto-scaling (2-10 replicas)
- Monitor and adjust resource limits
- Use spot instances for non-critical environments

## Security Best Practices

1. **Secrets Management**
   - Never commit `values-production.yaml` to git
   - Use Kubernetes secrets or external secret managers
   - Rotate secrets regularly

2. **Network Security**
   - Enable network policies to restrict pod-to-pod communication
   - Use HTTPS only (cert-manager configured)
   - Configure firewall rules on Digital Ocean

3. **Updates**
   - Regularly update Docker images
   - Keep Kubernetes cluster updated
   - Monitor security advisories

4. **Access Control**
   - Use RBAC for Kubernetes access
   - Limit who can deploy to production
   - Use separate clusters for dev/staging/prod

## CI/CD Setup

See `.github/workflows/deploy.yml.example` for a complete GitHub Actions workflow that:

1. Builds Docker image on push to main
2. Pushes to Digital Ocean Container Registry
3. Deploys to Kubernetes using Helm
4. Runs smoke tests

To use it:

1. Copy to `.github/workflows/deploy.yml`
2. Add required secrets to GitHub repository settings
3. Push to main branch to trigger deployment

## Monitoring and Observability

Consider adding:

1. **Prometheus & Grafana** - Metrics and dashboards
2. **Loki** - Log aggregation
3. **Digital Ocean Monitoring** - Built-in monitoring
4. **Sentry** - Error tracking
5. **Datadog/New Relic** - APM

## Support Resources

- [Digital Ocean Kubernetes Docs](https://docs.digitalocean.com/products/kubernetes/)
- [Helm Documentation](https://helm.sh/docs/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [cert-manager Documentation](https://cert-manager.io/docs/)

## Next Steps

After successful deployment:

1. Set up monitoring and alerting
2. Configure backups for your Supabase database
3. Set up a staging environment
4. Implement CI/CD pipeline
5. Configure log aggregation
6. Set up uptime monitoring
7. Plan disaster recovery procedures

