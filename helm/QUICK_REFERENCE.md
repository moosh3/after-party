# Kubernetes Deployment Quick Reference

Quick commands for common deployment tasks.

## Build & Push

```bash
# Build Docker image
docker build -t registry.digitalocean.com/your-registry/after-party:v1.0.0 .

# Push to registry
docker push registry.digitalocean.com/your-registry/after-party:v1.0.0

# Tag as latest
docker tag registry.digitalocean.com/your-registry/after-party:v1.0.0 \
  registry.digitalocean.com/your-registry/after-party:latest
docker push registry.digitalocean.com/your-registry/after-party:latest
```

## Deploy

```bash
# Initial install
helm install after-party ./helm/after-party \
  -f helm/after-party/values-production.yaml \
  --namespace after-party \
  --create-namespace

# Upgrade existing deployment
helm upgrade after-party ./helm/after-party \
  -f helm/after-party/values-production.yaml \
  --namespace after-party

# Upgrade with new image
helm upgrade after-party ./helm/after-party \
  --set image.tag=v1.1.0 \
  --namespace after-party

# Upgrade and wait for completion
helm upgrade after-party ./helm/after-party \
  -f helm/after-party/values-production.yaml \
  --namespace after-party \
  --wait \
  --timeout 5m
```

## Monitor

```bash
# Watch pods
kubectl get pods -n after-party -w

# View logs (real-time)
kubectl logs -f deployment/after-party -n after-party

# View logs (all pods)
kubectl logs -l app.kubernetes.io/name=after-party -n after-party

# Check deployment status
kubectl rollout status deployment/after-party -n after-party

# Get all resources
kubectl get all -n after-party

# Check events
kubectl get events -n after-party --sort-by='.lastTimestamp'

# Check pod details
kubectl describe pod <pod-name> -n after-party

# Resource usage
kubectl top pods -n after-party
kubectl top nodes
```

## Scale

```bash
# Manual scale
kubectl scale deployment after-party --replicas=5 -n after-party

# Check HPA status
kubectl get hpa -n after-party
kubectl describe hpa after-party -n after-party
```

## Debug

```bash
# Execute command in pod
kubectl exec -it deployment/after-party -n after-party -- /bin/sh

# Port forward to local
kubectl port-forward svc/after-party 3000:80 -n after-party

# Test health endpoint
curl http://localhost:3000/api/health

# Check ingress
kubectl get ingress -n after-party
kubectl describe ingress after-party -n after-party

# Check certificate
kubectl get certificate -n after-party
kubectl describe certificate after-party-tls -n after-party

# Check secrets
kubectl get secrets -n after-party
kubectl describe secret after-party -n after-party
```

## Rollback

```bash
# View release history
helm history after-party -n after-party

# Rollback to previous version
helm rollback after-party -n after-party

# Rollback to specific revision
helm rollback after-party 2 -n after-party

# Kubernetes rollback
kubectl rollout undo deployment/after-party -n after-party
kubectl rollout undo deployment/after-party --to-revision=2 -n after-party
```

## Cleanup

```bash
# Delete release (keeps namespace)
helm uninstall after-party -n after-party

# Delete namespace (removes everything)
kubectl delete namespace after-party

# Delete specific resources
kubectl delete deployment after-party -n after-party
kubectl delete service after-party -n after-party
kubectl delete ingress after-party -n after-party
```

## Secrets Management

```bash
# Create secret manually
kubectl create secret generic after-party-secrets \
  --from-literal=JWT_SECRET='your-secret' \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY='your-key' \
  --namespace after-party

# Update secret
kubectl create secret generic after-party-secrets \
  --from-literal=JWT_SECRET='new-secret' \
  --namespace after-party \
  --dry-run=client -o yaml | kubectl apply -f -

# View secret (base64 encoded)
kubectl get secret after-party -n after-party -o yaml

# Decode secret
kubectl get secret after-party -n after-party -o jsonpath='{.data.JWT_SECRET}' | base64 -d
```

## Helm Commands

```bash
# List releases
helm list -n after-party

# Get values
helm get values after-party -n after-party

# Get all values (including defaults)
helm get values after-party -n after-party -a

# Dry run (test without installing)
helm install after-party ./helm/after-party \
  -f helm/after-party/values-production.yaml \
  --namespace after-party \
  --dry-run --debug

# Template (render templates)
helm template after-party ./helm/after-party \
  -f helm/after-party/values-production.yaml

# Lint chart
helm lint ./helm/after-party \
  -f helm/after-party/values-production.yaml
```

## Digital Ocean Specific

```bash
# Login to DO Container Registry
doctl registry login

# Get cluster credentials
doctl kubernetes cluster kubeconfig save <cluster-name>

# List clusters
doctl kubernetes cluster list

# Get cluster info
doctl kubernetes cluster get <cluster-name>

# List node pools
doctl kubernetes cluster node-pool list <cluster-name>

# Scale node pool
doctl kubernetes cluster node-pool update <cluster-name> <pool-id> \
  --count 3
```

## Troubleshooting

```bash
# Pod stuck in ImagePullBackOff
kubectl describe pod <pod-name> -n after-party
# Check: image name, registry credentials

# Pod stuck in CrashLoopBackOff
kubectl logs <pod-name> -n after-party --previous
# Check: application errors, environment variables

# Ingress not working
kubectl describe ingress after-party -n after-party
kubectl logs -n ingress-nginx deployment/nginx-ingress-controller
# Check: DNS, certificate, ingress annotations

# Service not accessible
kubectl get endpoints -n after-party
kubectl describe service after-party -n after-party
# Check: pod labels, service selector

# Out of resources
kubectl describe nodes
kubectl top nodes
kubectl top pods -n after-party
# Check: resource limits, node capacity
```

## Common Issues & Solutions

### Issue: Pods not starting
```bash
kubectl describe pod <pod-name> -n after-party
# Look for: Events, Container Status, Conditions
```

### Issue: Out of memory
```bash
# Increase memory limits in values.yaml
resources:
  limits:
    memory: 2Gi
  requests:
    memory: 1Gi
```

### Issue: SSL certificate not working
```bash
# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Check certificate status
kubectl describe certificate after-party-tls -n after-party

# Check ClusterIssuer
kubectl get clusterissuer
kubectl describe clusterissuer letsencrypt-prod
```

### Issue: Can't pull image
```bash
# Create image pull secret
kubectl create secret docker-registry regcred \
  --docker-server=registry.digitalocean.com \
  --docker-username=<token> \
  --docker-password=<token> \
  -n after-party

# Add to values.yaml
imagePullSecrets:
  - name: regcred
```

## Useful Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
alias k='kubectl'
alias kgp='kubectl get pods'
alias kgs='kubectl get svc'
alias kgd='kubectl get deployments'
alias kgi='kubectl get ingress'
alias kga='kubectl get all'
alias kdp='kubectl describe pod'
alias kl='kubectl logs'
alias klf='kubectl logs -f'
alias kex='kubectl exec -it'
alias h='helm'
alias hl='helm list'
alias hh='helm history'

# Namespace specific
alias kap='kubectl -n after-party'
alias kapgp='kubectl get pods -n after-party'
alias kapl='kubectl logs -f -n after-party'
```

