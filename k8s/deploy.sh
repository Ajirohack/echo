#!/bin/bash

# Echo Kubernetes Deployment Script
# This script deploys the Echo application to a Kubernetes cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="echo"
CONTEXT=""
DRY_RUN=false
SKIP_BUILD=false
SKIP_SECRETS=false
VERBOSE=false
WAIT_TIMEOUT=300

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Echo application to Kubernetes cluster

Options:
    -h, --help              Show this help message
    -n, --namespace NAME    Kubernetes namespace (default: echo)
    -c, --context CONTEXT   Kubernetes context to use
    -d, --dry-run          Perform a dry run without applying changes
    -b, --skip-build       Skip Docker image build
    -s, --skip-secrets     Skip secrets creation (use existing)
    -v, --verbose          Enable verbose output
    -w, --wait SECONDS     Wait timeout for deployments (default: 300)
    --delete               Delete the deployment instead of creating
    --status               Show deployment status
    --logs                 Show application logs

Examples:
    $0                                    # Deploy with defaults
    $0 -n production -c prod-cluster     # Deploy to production
    $0 --dry-run                         # Preview changes
    $0 --delete                          # Delete deployment
    $0 --status                          # Check status

EOF
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if docker is installed (unless skipping build)
    if [ "$SKIP_BUILD" = false ] && ! command -v docker &> /dev/null; then
        print_error "docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check kubectl connection
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Set context if provided
    if [ -n "$CONTEXT" ]; then
        print_status "Switching to context: $CONTEXT"
        kubectl config use-context "$CONTEXT"
    fi
    
    print_success "Prerequisites check passed"
}

# Function to build Docker images
build_images() {
    if [ "$SKIP_BUILD" = true ]; then
        print_warning "Skipping Docker image build"
        return
    fi
    
    print_status "Building Docker images..."
    
    # Build main application image
    print_status "Building Echo application image..."
    docker build -t echo-app:latest .
    
    # Tag for registry (adjust as needed)
    # docker tag echo-app:latest your-registry/echo-app:latest
    # docker push your-registry/echo-app:latest
    
    print_success "Docker images built successfully"
}

# Function to create namespace
create_namespace() {
    print_status "Creating namespace: $NAMESPACE"
    
    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        print_warning "Namespace $NAMESPACE already exists"
    else
        if [ "$DRY_RUN" = true ]; then
            kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml
        else
            kubectl create namespace "$NAMESPACE"
            print_success "Namespace $NAMESPACE created"
        fi
    fi
}

# Function to create secrets
create_secrets() {
    if [ "$SKIP_SECRETS" = true ]; then
        print_warning "Skipping secrets creation"
        return
    fi
    
    print_status "Creating secrets..."
    
    # Generate random passwords if not provided
    POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(openssl rand -base64 32)}
    REDIS_PASSWORD=${REDIS_PASSWORD:-$(openssl rand -base64 32)}
    JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 64)}
    GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-$(openssl rand -base64 16)}
    
    # Create main secrets
    kubectl create secret generic echo-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=postgres-password="$POSTGRES_PASSWORD" \
        --from-literal=redis-password="$REDIS_PASSWORD" \
        --from-literal=jwt-secret="$JWT_SECRET" \
        --from-literal=grafana-admin-password="$GRAFANA_ADMIN_PASSWORD" \
        --from-literal=database-url="postgresql://echo:$POSTGRES_PASSWORD@echo-postgres-service:5432/echo_db" \
        --from-literal=redis-url="redis://:$REDIS_PASSWORD@echo-redis-service:6379" \
        --from-literal=elasticsearch-url="http://echo-elasticsearch-service:9200" \
        ${DRY_RUN:+--dry-run=client} -o yaml | kubectl apply -f -
    
    print_success "Secrets created successfully"
    
    if [ "$VERBOSE" = true ]; then
        echo "Generated passwords:"
        echo "  PostgreSQL: $POSTGRES_PASSWORD"
        echo "  Redis: $REDIS_PASSWORD"
        echo "  Grafana Admin: $GRAFANA_ADMIN_PASSWORD"
    fi
}

# Function to apply Kubernetes manifests
apply_manifests() {
    print_status "Applying Kubernetes manifests..."
    
    local manifests=(
        "namespace.yaml"
        "rbac.yaml"
        "postgres-deployment.yaml"
        "redis-deployment.yaml"
        "elasticsearch-deployment.yaml"
        "echo-app-deployment.yaml"
        "nginx-deployment.yaml"
        "monitoring-deployment.yaml"
        "ingress.yaml"
        "hpa.yaml"
    )
    
    for manifest in "${manifests[@]}"; do
        if [ -f "$manifest" ]; then
            print_status "Applying $manifest..."
            if [ "$DRY_RUN" = true ]; then
                kubectl apply -f "$manifest" --namespace="$NAMESPACE" --dry-run=client
            else
                kubectl apply -f "$manifest" --namespace="$NAMESPACE"
            fi
        else
            print_warning "Manifest $manifest not found, skipping..."
        fi
    done
    
    print_success "Manifests applied successfully"
}

# Function to wait for deployments
wait_for_deployments() {
    if [ "$DRY_RUN" = true ]; then
        print_warning "Skipping deployment wait in dry-run mode"
        return
    fi
    
    print_status "Waiting for deployments to be ready..."
    
    local deployments=(
        "echo-postgres"
        "echo-redis"
        "echo-elasticsearch"
        "echo-app"
        "echo-nginx"
        "echo-prometheus"
        "echo-grafana"
    )
    
    for deployment in "${deployments[@]}"; do
        print_status "Waiting for $deployment..."
        if kubectl rollout status deployment/$deployment --namespace="$NAMESPACE" --timeout=${WAIT_TIMEOUT}s; then
            print_success "$deployment is ready"
        else
            print_error "$deployment failed to become ready within ${WAIT_TIMEOUT}s"
            return 1
        fi
    done
    
    print_success "All deployments are ready"
}

# Function to show deployment status
show_status() {
    print_status "Deployment Status for namespace: $NAMESPACE"
    echo
    
    print_status "Pods:"
    kubectl get pods --namespace="$NAMESPACE" -o wide
    echo
    
    print_status "Services:"
    kubectl get services --namespace="$NAMESPACE" -o wide
    echo
    
    print_status "Ingresses:"
    kubectl get ingresses --namespace="$NAMESPACE" -o wide
    echo
    
    print_status "PVCs:"
    kubectl get pvc --namespace="$NAMESPACE" -o wide
    echo
    
    print_status "HPA:"
    kubectl get hpa --namespace="$NAMESPACE" -o wide
    echo
}

# Function to show logs
show_logs() {
    print_status "Application Logs:"
    kubectl logs -l app=echo-app --namespace="$NAMESPACE" --tail=100 -f
}

# Function to delete deployment
delete_deployment() {
    print_warning "Deleting Echo deployment from namespace: $NAMESPACE"
    read -p "Are you sure? This will delete all resources. (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deleting resources..."
        
        # Delete in reverse order
        local manifests=(
            "hpa.yaml"
            "ingress.yaml"
            "monitoring-deployment.yaml"
            "nginx-deployment.yaml"
            "echo-app-deployment.yaml"
            "elasticsearch-deployment.yaml"
            "redis-deployment.yaml"
            "postgres-deployment.yaml"
            "rbac.yaml"
        )
        
        for manifest in "${manifests[@]}"; do
            if [ -f "$manifest" ]; then
                print_status "Deleting resources from $manifest..."
                kubectl delete -f "$manifest" --namespace="$NAMESPACE" --ignore-not-found=true
            fi
        done
        
        # Delete secrets
        kubectl delete secret echo-secrets --namespace="$NAMESPACE" --ignore-not-found=true
        
        # Delete namespace (optional)
        read -p "Delete namespace $NAMESPACE? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kubectl delete namespace "$NAMESPACE" --ignore-not-found=true
        fi
        
        print_success "Deployment deleted"
    else
        print_status "Deletion cancelled"
    fi
}

# Function to get service URLs
get_service_urls() {
    print_status "Service URLs:"
    
    # Get LoadBalancer IPs
    local nginx_ip=$(kubectl get service echo-nginx-service --namespace="$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "<pending>")
    
    echo "  Application: http://$nginx_ip"
    echo "  API: http://$nginx_ip/api"
    echo "  WebSocket: ws://$nginx_ip/ws"
    
    # Port-forward commands for local access
    echo
    print_status "For local access, use port-forwarding:"
    echo "  kubectl port-forward service/echo-nginx-service 8080:80 --namespace=$NAMESPACE"
    echo "  kubectl port-forward service/echo-grafana-service 3000:3000 --namespace=$NAMESPACE"
    echo "  kubectl port-forward service/echo-prometheus-service 9090:9090 --namespace=$NAMESPACE"
}

# Main deployment function
main_deploy() {
    print_status "Starting Echo deployment..."
    
    check_prerequisites
    build_images
    create_namespace
    create_secrets
    apply_manifests
    wait_for_deployments
    
    print_success "Echo deployment completed successfully!"
    echo
    get_service_urls
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -c|--context)
            CONTEXT="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -b|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -s|--skip-secrets)
            SKIP_SECRETS=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -w|--wait)
            WAIT_TIMEOUT="$2"
            shift 2
            ;;
        --delete)
            delete_deployment
            exit 0
            ;;
        --status)
            show_status
            exit 0
            ;;
        --logs)
            show_logs
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run main deployment
main_deploy