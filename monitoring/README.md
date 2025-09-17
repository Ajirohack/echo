# Echo Application Monitoring Infrastructure

This directory contains the complete monitoring and observability stack for the Echo real-time communication application. The monitoring infrastructure provides comprehensive visibility into application performance, infrastructure health, and user experience.

## 🏗️ Architecture Overview

The monitoring stack consists of the following components:

### Core Monitoring Components

- **Prometheus** - Metrics collection and alerting
- **Grafana** - Visualization and dashboards
- **Alertmanager** - Alert routing and notification management
- **Elasticsearch** - Centralized log storage and search
- **Kibana** - Log visualization and analysis
- **Fluentd** - Log collection and forwarding

### Supporting Components

- **Node Exporter** - System metrics collection
- **Kube State Metrics** - Kubernetes cluster metrics
- **Elasticsearch Exporter** - Elasticsearch metrics for Prometheus

## 📁 Directory Structure

```
monitoring/
├── prometheus/
│   ├── prometheus.yml          # Prometheus configuration
│   └── rules/
│       └── echo-alerts.yml     # Alerting rules
├── grafana/
│   └── dashboards/
│       └── echo-overview.json  # Main application dashboard
├── logging/
│   ├── fluentd/
│   │   └── fluent.conf        # Log collection configuration
│   └── elasticsearch/
│       └── templates/
│           └── echo-logs.json  # Log index template
├── k8s/
│   ├── monitoring-stack.yaml  # Main monitoring components
│   ├── elasticsearch.yaml     # Elasticsearch deployment
│   ├── secrets.yaml          # Secret templates
│   └── configmaps.yaml       # Configuration maps
├── deploy-monitoring.sh       # Automated deployment script
└── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites

1. **Kubernetes Cluster** (v1.20+)
2. **kubectl** configured and connected
3. **Helm** (optional, for additional components)
4. **Ingress Controller** (nginx-ingress recommended)
5. **cert-manager** (optional, for TLS certificates)

### Deployment

1. **Clone and navigate to the monitoring directory:**

   ```bash
   cd echo/monitoring
   ```

2. **Update configuration:**
   - Edit domain names in `k8s/monitoring-stack.yaml`
   - Update secrets in `k8s/secrets.yaml` with real values
   - Configure SMTP settings for alerting

3. **Deploy the monitoring stack:**

   ```bash
   chmod +x deploy-monitoring.sh
   ./deploy-monitoring.sh deploy
   ```

4. **Verify deployment:**

   ```bash
   ./deploy-monitoring.sh verify
   ```

## 🔧 Configuration

### Secrets Management

The monitoring stack requires several secrets. Update `k8s/secrets.yaml` with your actual values:

```yaml
# Example secret values (Base64 encoded)
data:
  admin-password: <base64-encoded-grafana-admin-password>
  smtp-user: <base64-encoded-smtp-username>
  smtp-password: <base64-encoded-smtp-password>
  slack-webhook-url: <base64-encoded-slack-webhook>
```

**Generate Base64 values:**

```bash
echo -n "your-password" | base64
```

### Domain Configuration

Update the domain name in the ingress configuration:

```yaml
# In k8s/monitoring-stack.yaml
spec:
  rules:
  - host: monitoring.your-domain.com  # Update this
```

### Storage Configuration

Configure persistent storage for data retention:

```yaml
# Adjust storage sizes based on your needs
resources:
  requests:
    storage: 50Gi  # Prometheus data
    storage: 100Gi # Elasticsearch data
    storage: 10Gi  # Grafana data
```

## 📊 Dashboards and Metrics

### Key Metrics Monitored

#### Application Metrics

- HTTP request rate and latency
- WebRTC connection counts and quality
- Audio processing performance
- Error rates and types
- User session metrics

#### Infrastructure Metrics

- CPU and memory usage
- Network I/O and disk usage
- Pod health and restart counts
- Database performance
- Cache hit rates

#### Business Metrics

- Active user counts
- Feature usage statistics
- Revenue impact metrics
- Geographic distribution

### Default Dashboards

1. **Echo Overview** - High-level application health
2. **WebRTC Metrics** - Real-time communication performance
3. **Infrastructure** - System and Kubernetes metrics
4. **Database Performance** - PostgreSQL and Redis metrics
5. **Error Analysis** - Error tracking and debugging

## 🚨 Alerting

### Alert Categories

#### Critical Alerts

- Application down or unresponsive
- Database connectivity issues
- High error rates (>5%)
- Audio processing failures
- Security incidents

#### Warning Alerts

- High latency (>2s 95th percentile)
- Resource usage >80%
- WebRTC connection issues
- Certificate expiration warnings

### Notification Channels

- **Slack** - Real-time team notifications
- **Email** - Critical alerts and summaries
- **PagerDuty** - On-call escalation
- **Webhooks** - Custom integrations

### Alert Configuration

Alerts are defined in `prometheus/rules/echo-alerts.yml`:

```yaml
- alert: EchoAppDown
  expr: up{job="echo-app"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Echo application is down"
```

## 📝 Logging

### Log Collection

Fluentd collects logs from:

- Application containers
- Kubernetes system components
- Infrastructure services
- Security events

### Log Structure

Logs are structured in JSON format:

```json
{
  "@timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "service_name": "echo-api",
  "message": "WebRTC connection established",
  "user_id": "user123",
  "session_id": "session456",
  "kubernetes": {
    "namespace": "echo-prod",
    "pod_name": "echo-api-7d8f9b6c5d-xyz"
  }
}
```

### Log Retention

Elasticsearch Index Lifecycle Management (ILM) policy:

- **Hot phase**: 7 days (active indexing)
- **Warm phase**: 30 days (read-only, compressed)
- **Cold phase**: 90 days (minimal resources)
- **Delete phase**: After 90 days

## 🔍 Troubleshooting

### Common Issues

#### Prometheus Not Scraping Metrics

```bash
# Check service discovery
kubectl logs deployment/prometheus -n echo-monitoring

# Verify service annotations
kubectl get svc -n echo-prod -o yaml | grep prometheus
```

#### Grafana Dashboard Not Loading

```bash
# Check Grafana logs
kubectl logs deployment/grafana -n echo-monitoring

# Verify datasource connectivity
kubectl port-forward svc/grafana 3000:3000 -n echo-monitoring
```

#### Elasticsearch Storage Issues

```bash
# Check disk usage
kubectl exec -it elasticsearch-0 -n echo-monitoring -- df -h

# Monitor index sizes
curl -X GET "elasticsearch:9200/_cat/indices?v"
```

### Useful Commands

```bash
# View all monitoring pods
kubectl get pods -n echo-monitoring

# Check resource usage
kubectl top pods -n echo-monitoring

# Access Grafana locally
kubectl port-forward svc/grafana 3000:3000 -n echo-monitoring

# Access Prometheus locally
kubectl port-forward svc/prometheus 9090:9090 -n echo-monitoring

# View Fluentd logs
kubectl logs daemonset/fluentd -n echo-monitoring

# Restart a component
kubectl rollout restart deployment/grafana -n echo-monitoring
```

## 🔒 Security Considerations

### Access Control

- Basic authentication for monitoring interfaces
- RBAC for Kubernetes service accounts
- Network policies for pod-to-pod communication
- TLS encryption for all external traffic

### Secret Management

- Use external secret management (Vault, AWS Secrets Manager)
- Rotate credentials regularly
- Avoid hardcoded secrets in configurations
- Implement least-privilege access

### Data Privacy

- Anonymize sensitive data in logs
- Implement log retention policies
- Secure backup and archival processes
- Comply with data protection regulations

## 📈 Performance Optimization

### Resource Tuning

#### Prometheus

```yaml
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 1000m
    memory: 2Gi
```

#### Elasticsearch

```yaml
env:
- name: ES_JAVA_OPTS
  value: "-Xms2g -Xmx2g"
```

### Storage Optimization

- Use SSD storage classes for better performance
- Configure appropriate retention policies
- Implement data compression and archival
- Monitor and alert on storage usage

## 🔄 Backup and Recovery

### Backup Strategy

1. **Prometheus Data**
   - Use remote write to long-term storage
   - Regular snapshots of TSDB

2. **Grafana Configuration**
   - Export dashboards and datasources
   - Version control dashboard JSON

3. **Elasticsearch Data**
   - Snapshot to S3/GCS
   - Cross-cluster replication

### Recovery Procedures

```bash
# Restore Prometheus from snapshot
kubectl exec prometheus-0 -- promtool tsdb create-blocks-from snapshot

# Restore Grafana dashboards
curl -X POST "http://admin:password@grafana:3000/api/dashboards/db" \
  -H "Content-Type: application/json" \
  -d @dashboard.json
```

## 🚀 Scaling and High Availability

### Horizontal Scaling

```yaml
# Scale Grafana for high availability
replicas: 3

# Use external database for Grafana
env:
- name: GF_DATABASE_TYPE
  value: postgres
```

### Prometheus Federation

```yaml
# Configure Prometheus federation for multi-cluster
scrape_configs:
- job_name: 'federate'
  scrape_interval: 15s
  honor_labels: true
  metrics_path: '/federate'
  params:
    'match[]':
      - '{job=~"prometheus"}
      - '{__name__=~"job:.*"}'
```

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Elasticsearch Guide](https://www.elastic.co/guide/)
- [Kubernetes Monitoring Best Practices](https://kubernetes.io/docs/concepts/cluster-administration/monitoring/)
- [Echo Application Documentation](../README.md)

## 🤝 Contributing

To contribute to the monitoring infrastructure:

1. Test changes in a development environment
2. Update documentation for any configuration changes
3. Validate alert rules and thresholds
4. Ensure backward compatibility
5. Submit pull requests with detailed descriptions

## 📞 Support

For monitoring-related issues:

- Check the troubleshooting section above
- Review application and infrastructure logs
- Contact the DevOps team for infrastructure issues
- Create GitHub issues for bugs or feature requests

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Maintainer**: Echo DevOps Team
