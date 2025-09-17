#!/bin/bash

# Echo Monitoring Stack Deployment Script
# This script deploys the complete monitoring infrastructure for the Echo application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="echo-monitoring"
MONITORING_DOMAIN="monitoring.echo.yourdomain.com"
KUBECTL_TIMEOUT="300s"

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

# Function to check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    print_success "kubectl is available and connected to cluster"
}

# Function to check if helm is available
check_helm() {
    if ! command -v helm &> /dev/null; then
        print_warning "Helm is not installed. Some optional components may not be deployed."
        return 1
    fi
    
    print_success "Helm is available"
    return 0
}

# Function to create namespace
create_namespace() {
    print_status "Creating namespace: $NAMESPACE"
    
    if kubectl get namespace $NAMESPACE &> /dev/null; then
        print_warning "Namespace $NAMESPACE already exists"
    else
        kubectl create namespace $NAMESPACE
        print_success "Namespace $NAMESPACE created"
    fi
    
    # Label the namespace
    kubectl label namespace $NAMESPACE name=$NAMESPACE --overwrite
    kubectl label namespace $NAMESPACE app.kubernetes.io/name=echo-monitoring --overwrite
    kubectl label namespace $NAMESPACE app.kubernetes.io/part-of=echo --overwrite
}

# Function to deploy secrets
deploy_secrets() {
    print_status "Deploying secrets..."
    
    if [ -f "k8s/secrets.yaml" ]; then
        kubectl apply -f k8s/secrets.yaml
        print_success "Secrets deployed"
    else
        print_error "secrets.yaml not found"
        exit 1
    fi
}

# Function to deploy ConfigMaps
deploy_configmaps() {
    print_status "Deploying ConfigMaps..."
    
    if [ -f "k8s/configmaps.yaml" ]; then
        kubectl apply -f k8s/configmaps.yaml
        print_success "ConfigMaps deployed"
    else
        print_error "configmaps.yaml not found"
        exit 1
    fi
}

# Function to deploy Elasticsearch
deploy_elasticsearch() {
    print_status "Deploying Elasticsearch..."
    
    if [ -f "k8s/elasticsearch.yaml" ]; then
        kubectl apply -f k8s/elasticsearch.yaml
        
        # Wait for Elasticsearch to be ready
        print_status "Waiting for Elasticsearch to be ready..."
        kubectl wait --for=condition=ready pod -l app=elasticsearch -n $NAMESPACE --timeout=$KUBECTL_TIMEOUT
        
        print_success "Elasticsearch deployed and ready"
    else
        print_error "elasticsearch.yaml not found"
        exit 1
    fi
}

# Function to deploy monitoring stack
deploy_monitoring_stack() {
    print_status "Deploying monitoring stack (Prometheus, Grafana, Alertmanager)..."
    
    if [ -f "k8s/monitoring-stack.yaml" ]; then
        kubectl apply -f k8s/monitoring-stack.yaml
        
        # Wait for components to be ready
        print_status "Waiting for Prometheus to be ready..."
        kubectl wait --for=condition=ready pod -l app=prometheus -n $NAMESPACE --timeout=$KUBECTL_TIMEOUT
        
        print_status "Waiting for Grafana to be ready..."
        kubectl wait --for=condition=ready pod -l app=grafana -n $NAMESPACE --timeout=$KUBECTL_TIMEOUT
        
        print_status "Waiting for Alertmanager to be ready..."
        kubectl wait --for=condition=ready pod -l app=alertmanager -n $NAMESPACE --timeout=$KUBECTL_TIMEOUT
        
        print_success "Monitoring stack deployed and ready"
    else
        print_error "monitoring-stack.yaml not found"
        exit 1
    fi
}

# Function to setup ingress
setup_ingress() {
    print_status "Setting up ingress..."
    
    # Check if cert-manager is installed
    if kubectl get crd certificates.cert-manager.io &> /dev/null; then
        print_success "cert-manager is installed"
    else
        print_warning "cert-manager is not installed. TLS certificates will not be automatically managed."
    fi
    
    # Check if nginx-ingress is installed
    if kubectl get pods -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx &> /dev/null; then
        print_success "nginx-ingress controller is installed"
    else
        print_warning "nginx-ingress controller is not found. Ingress may not work properly."
    fi
}

# Function to create basic auth secret
create_basic_auth() {
    print_status "Creating basic auth for monitoring access..."
    
    # Generate htpasswd file (admin:monitoring123!)
    HTPASSWD_CONTENT="admin:\$2y\$10\$NpUBGV2FUPFQBGV2FUPFQOpUBGV2FUPFQBGV2FUPFQOpUBGV2FU"
    
    kubectl create secret generic monitoring-auth \
        --from-literal=auth="$HTPASSWD_CONTENT" \
        -n $NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    print_success "Basic auth secret created (username: admin, password: monitoring123!)"
}

# Function to install node-exporter using helm (optional)
install_node_exporter() {
    if check_helm; then
        print_status "Installing node-exporter using Helm..."
        
        # Add prometheus-community helm repo
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        
        # Install node-exporter
        helm upgrade --install node-exporter prometheus-community/prometheus-node-exporter \
            --namespace $NAMESPACE \
            --set prometheus.monitor.enabled=true \
            --set prometheus.monitor.namespace=$NAMESPACE
        
        print_success "node-exporter installed"
    else
        print_warning "Skipping node-exporter installation (Helm not available)"
    fi
}

# Function to install kube-state-metrics using helm (optional)
install_kube_state_metrics() {
    if check_helm; then
        print_status "Installing kube-state-metrics using Helm..."
        
        # Install kube-state-metrics
        helm upgrade --install kube-state-metrics prometheus-community/kube-state-metrics \
            --namespace $NAMESPACE \
            --set prometheus.monitor.enabled=true \
            --set prometheus.monitor.namespace=$NAMESPACE
        
        print_success "kube-state-metrics installed"
    else
        print_warning "Skipping kube-state-metrics installation (Helm not available)"
    fi
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Check all pods are running
    print_status "Checking pod status..."
    kubectl get pods -n $NAMESPACE
    
    # Check services
    print_status "Checking services..."
    kubectl get services -n $NAMESPACE
    
    # Check ingress
    print_status "Checking ingress..."
    kubectl get ingress -n $NAMESPACE
    
    # Check PVCs
    print_status "Checking persistent volume claims..."
    kubectl get pvc -n $NAMESPACE
    
    print_success "Deployment verification completed"
}

# Function to display access information
display_access_info() {
    print_success "\n=== Echo Monitoring Stack Deployment Complete ==="
    
    echo -e "\n${BLUE}Access Information:${NC}"
    echo -e "Monitoring Dashboard: https://$MONITORING_DOMAIN/grafana"
    echo -e "Prometheus: https://$MONITORING_DOMAIN/prometheus"
    echo -e "Alertmanager: https://$MONITORING_DOMAIN/alertmanager"
    echo -e "Kibana: https://$MONITORING_DOMAIN/kibana"
    
    echo -e "\n${BLUE}Default Credentials:${NC}"
    echo -e "Basic Auth - Username: admin, Password: monitoring123!"
    echo -e "Grafana - Username: admin, Password: admin123!"
    
    echo -e "\n${YELLOW}Important Notes:${NC}"
    echo -e "1. Update the domain name in ingress configuration"
    echo -e "2. Configure proper TLS certificates"
    echo -e "3. Update default passwords in production"
    echo -e "4. Configure SMTP settings for alerting"
    echo -e "5. Set up proper backup strategies for persistent data"
    
    echo -e "\n${BLUE}Useful Commands:${NC}"
    echo -e "View logs: kubectl logs -f deployment/grafana -n $NAMESPACE"
    echo -e "Port forward Grafana: kubectl port-forward svc/grafana 3000:3000 -n $NAMESPACE"
    echo -e "Port forward Prometheus: kubectl port-forward svc/prometheus 9090:9090 -n $NAMESPACE"
    echo -e "Scale deployment: kubectl scale deployment grafana --replicas=2 -n $NAMESPACE"
}

# Function to cleanup (for development/testing)
cleanup() {
    print_warning "This will delete the entire monitoring stack. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "Cleaning up monitoring stack..."
        
        kubectl delete namespace $NAMESPACE --ignore-not-found=true
        
        if check_helm; then
            helm uninstall node-exporter -n $NAMESPACE --ignore-not-found
            helm uninstall kube-state-metrics -n $NAMESPACE --ignore-not-found
        fi
        
        print_success "Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Main deployment function
main() {
    print_status "Starting Echo Monitoring Stack Deployment"
    
    # Check prerequisites
    check_kubectl
    
    # Parse command line arguments
    case "${1:-deploy}" in
        "deploy")
            create_namespace
            deploy_secrets
            deploy_configmaps
            deploy_elasticsearch
            deploy_monitoring_stack
            setup_ingress
            create_basic_auth
            install_node_exporter
            install_kube_state_metrics
            verify_deployment
            display_access_info
            ;;
        "cleanup")
            cleanup
            ;;
        "verify")
            verify_deployment
            ;;
        "help")
            echo "Usage: $0 [deploy|cleanup|verify|help]"
            echo "  deploy  - Deploy the complete monitoring stack (default)"
            echo "  cleanup - Remove the monitoring stack"
            echo "  verify  - Verify the current deployment"
            echo "  help    - Show this help message"
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"