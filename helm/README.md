# After Party - Kubernetes Deployment Guide

This directory contains the Helm chart for deploying the After Party application to a Kubernetes cluster on Digital Ocean.

## Prerequisites

1. **Docker** - For building the application image
2. **kubectl** - Kubernetes command-line tool
3. **Helm 3.x** - Package manager for Kubernetes
4. **Digital Ocean Account** - With Kubernetes cluster provisioned
5. **Container Registry** - For storing Docker images (Digital Ocean Container Registry, Docker Hub, etc.)

## Quick Start

### 1. Build and Push Docker Image

First, build your Docker image and push it to your container registry:

```bash
# Build the Docker image
docker build -t your-registry/after-party:v1.0.0 .

# Login to your registry (example for Digital Ocean)
doctl registry login

# Push the image
docker push your-registry/after-party:v1.0.0
```

### 2. Configure kubectl

Connect to your Digital Ocean Kubernetes cluster:

```bash
# Download the kubeconfig file from Digital Ocean
doctl kubernetes cluster kubeconfig save <your-cluster-name>

# Verify connection
kubectl cluster-info
kubectl get nodes
```

### 3. Install NGINX Ingress Controller

If you haven't already installed an ingress controller:

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install nginx-ingress ingress-nginx/ingress-nginx \
  --create-namespace \
  --namespace ingress-nginx \
  --set controller.service.type=LoadBalancer
```

### 4. Install cert-manager (for HTTPS)

For automatic SSL certificate management:

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update

kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.crds.yaml

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.13.0
```

Create a ClusterIssuer for Let's Encrypt:

```bash
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

### 5. Create Production Values File

Create a `values-production.yaml` file with your configuration:

```yaml
replicaCount: 2

image:
  repository: your-registry/after-party
  tag: "v1.0.0"
  pullPolicy: IfNotPresent

ingress:
  enabled: true
  className: "nginx"
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
  NEXT_PUBLIC_SUPABASE_URL: "https://your-project.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "your-anon-key"
  SUPABASE_SERVICE_ROLE_KEY: "your-service-role-key"
  MUX_TOKEN_ID: "your-mux-token-id"
  MUX_TOKEN_SECRET: "your-mux-token-secret"
  ADMIN_PASSWORD_HASH: "your-bcrypt-hash"
  JWT_SECRET: "your-jwt-secret"

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi
```

**IMPORTANT:** Never commit this file to version control! Add it to `.gitignore`.

### 6. Deploy the Application

Install the Helm chart:

```bash
# Install (first time)
helm install after-party ./helm/after-party \
  -f values-production.yaml \
  --create-namespace \
  --namespace after-party

# Or upgrade (for updates)
helm upgrade --install after-party ./helm/after-party \
  -f values-production.yaml \
  --namespace after-party
```

### 7. Verify Deployment

Check the deployment status:

```bash
# Watch the deployment
kubectl get pods -n after-party -w

# Check the status
kubectl get all -n after-party

# View logs
kubectl logs -f deployment/after-party -n after-party

# Check ingress
kubectl get ingress -n after-party
```

## Configuration Options

### Using Digital Ocean Load Balancer

If you prefer to use Digital Ocean's Load Balancer instead of NGINX Ingress:

```yaml
digitalocean:
  loadBalancer:
    enabled: true
    annotations:
      service.beta.kubernetes.io/do-loadbalancer-protocol: "http"
      service.beta.kubernetes.io/do-loadbalancer-algorithm: "round_robin"
      service.beta.kubernetes.io/do-loadbalancer-healthcheck-path: "/api/health"

ingress:
  enabled: false
```

### Auto-scaling Configuration

The chart includes HorizontalPodAutoscaler (HPA) for automatic scaling:

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### Resource Limits

Adjust based on your needs:

```yaml
resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 1000m
    memory: 1Gi
```

## Maintenance

### Update the Application

1. Build and push a new Docker image with a new tag
2. Update the image tag in your values file
3. Run the upgrade command:

```bash
helm upgrade after-party ./helm/after-party \
  -f values-production.yaml \
  --namespace after-party
```

### Rollback

If something goes wrong:

```bash
# List releases
helm history after-party -n after-party

# Rollback to previous version
helm rollback after-party -n after-party

# Rollback to specific revision
helm rollback after-party <revision> -n after-party
```

### View Logs

```bash
# All pods
kubectl logs -l app.kubernetes.io/name=after-party -n after-party

# Specific pod
kubectl logs <pod-name> -n after-party

# Follow logs
kubectl logs -f deployment/after-party -n after-party
```

### Scale Manually

```bash
kubectl scale deployment after-party --replicas=5 -n after-party
```

## Secrets Management

For better security, consider using one of these approaches:

### Option 1: Kubernetes Secrets (Basic)

Create secrets separately:

```bash
kubectl create secret generic after-party-secrets \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY='your-key' \
  --from-literal=JWT_SECRET='your-secret' \
  -n after-party
```

### Option 2: Sealed Secrets

Install sealed-secrets controller and use it to encrypt secrets in Git.

### Option 3: External Secrets Operator

Use Digital Ocean's Managed Kubernetes with integration to a secrets manager.

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n after-party

# Check events
kubectl get events -n after-party --sort-by='.lastTimestamp'
```

### Image Pull Issues

```bash
# Create image pull secret for private registry
kubectl create secret docker-registry regcred \
  --docker-server=<your-registry-server> \
  --docker-username=<your-name> \
  --docker-password=<your-password> \
  -n after-party

# Add to values file
imagePullSecrets:
  - name: regcred
```

### Database Connection Issues

Check that all Supabase environment variables are correctly set and that your cluster can reach the Supabase API.

### Health Check Failures

Ensure the `/api/health` endpoint is working:

```bash
kubectl port-forward deployment/after-party 3000:3000 -n after-party
curl http://localhost:3000/api/health
```

## Cost Optimization

### For Development/Staging

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

### For Production

Use the default values with auto-scaling enabled to handle traffic efficiently.

## Monitoring

Consider setting up:

1. **Prometheus + Grafana** - For metrics and dashboards
2. **Digital Ocean Monitoring** - Built-in monitoring for DO Kubernetes
3. **Loki** - For log aggregation

## Security Best Practices

1. **Never commit secrets** - Use `.gitignore` for `values-production.yaml`
2. **Use HTTPS** - Ensure cert-manager is properly configured
3. **Regularly update** - Keep your images and Helm charts updated
4. **Use network policies** - Restrict pod-to-pod communication
5. **Enable RBAC** - Use proper service accounts and roles
6. **Scan images** - Use tools like Trivy to scan for vulnerabilities

## Additional Resources

- [Digital Ocean Kubernetes Documentation](https://docs.digitalocean.com/products/kubernetes/)
- [Helm Documentation](https://helm.sh/docs/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [cert-manager Documentation](https://cert-manager.io/docs/)

