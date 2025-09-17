# Echo CI/CD Pipeline

This directory contains the GitHub Actions workflows for the Echo application's continuous integration and deployment pipeline.

## 🚀 Workflows Overview

### 1. Continuous Integration (`ci.yml`)

Runs on every push and pull request to ensure code quality and functionality.

**Triggers:**

- Push to `main`, `develop`, `feature/*`, `bugfix/*`, `hotfix/*` branches
- Pull requests to `main` and `develop`
- Daily scheduled runs at 2 AM UTC

**Jobs:**

- **Changes Detection**: Optimizes CI runs by detecting which parts of the codebase changed
- **Lint & Format Check**: ESLint, Prettier, and TypeScript checks
- **Security Audit**: npm audit and Snyk security scanning
- **Backend Tests**: Unit, integration, and API tests with PostgreSQL, Redis services
- **Frontend Tests**: Unit, component, and E2E tests with Playwright
- **Docker Build Test**: Validates Docker image builds and basic functionality
- **Kubernetes Validation**: Validates K8s manifests using kubectl and kubeval
- **CI Success**: Aggregates all results and updates commit status

### 2. Deployment Pipeline (`deploy.yml`)

Handles automated deployment to different environments based on branch/tag.

**Triggers:**

- Push to `main`, `develop`, `release/*` branches
- Git tags matching `v*`
- Manual workflow dispatch

**Jobs:**

- **Code Quality & Security**: Comprehensive security and quality checks
- **Test Suite**: Full test matrix across unit, integration, and E2E tests
- **Build & Push Images**: Multi-platform Docker image builds with caching
- **Security Scan**: Container vulnerability scanning with Trivy
- **Environment Determination**: Smart environment selection based on branch/tag
- **Kubernetes Deployment**: Automated deployment using Kustomize
- **Smoke Tests**: Post-deployment health checks
- **Rollback**: Automatic rollback on deployment failure
- **Notifications**: Slack notifications and GitHub deployment status

### 3. Release Management (`release.yml`)

Manages versioned releases with comprehensive artifact generation.

**Triggers:**

- Git tags matching `v*.*.*`
- Manual workflow dispatch with version input

**Jobs:**

- **Validation**: Version format validation and changelog generation
- **Release Tests**: Full test suite execution
- **Build Artifacts**: Source archives, build artifacts, and Docker images
- **Security Scan**: Vulnerability scanning and SBOM generation
- **GitHub Release**: Automated release creation with artifacts
- **Production Deployment**: Automated production deployment for stable releases
- **Notifications**: Stakeholder notifications and documentation updates

## 🔧 Configuration

### Required Secrets

Configure these secrets in your GitHub repository settings:

```bash
# Kubernetes Configuration
KUBECONFIG                    # Base64 encoded kubeconfig file

# Application Secrets
POSTGRES_PASSWORD            # PostgreSQL password
REDIS_PASSWORD               # Redis password
JWT_SECRET                   # JWT signing secret
GRAFANA_ADMIN_PASSWORD       # Grafana admin password
DATABASE_URL                 # Production database URL
REDIS_URL                    # Production Redis URL
ELASTICSEARCH_URL           # Production Elasticsearch URL

# Security Scanning
SNYK_TOKEN                   # Snyk security scanning token

# Notifications
SLACK_WEBHOOK_URL           # Slack webhook for notifications
```

### Environment Variables

The workflows use these environment variables:

```yaml
NODE_VERSION: '18'           # Node.js version
PYTHON_VERSION: '3.11'      # Python version for ML components
REGISTRY: ghcr.io           # Container registry
IMAGE_NAME: ${{ github.repository }}  # Docker image name
```

## 🌍 Deployment Environments

### Development

- **Trigger**: Push to feature branches
- **Namespace**: `echo-dev`
- **URL**: `http://dev.echo.yourdomain.com`
- **Features**: Debug mode, reduced resources, NodePort services

### Staging

- **Trigger**: Push to `develop` or `release/*` branches
- **Namespace**: `echo-staging`
- **URL**: `https://staging.echo.yourdomain.com`
- **Features**: Production-like environment, SSL, monitoring

### Production

- **Trigger**: Push to `main` or version tags
- **Namespace**: `echo-prod`
- **URL**: `https://echo.yourdomain.com`
- **Features**: Full production setup, high availability, monitoring

## 📊 Monitoring and Observability

### Test Coverage

- **Backend**: Unit and integration test coverage reports
- **Frontend**: Component and E2E test coverage
- **Mobile**: Platform-specific test coverage

### Security Scanning

- **Dependencies**: npm audit and Snyk vulnerability scanning
- **Containers**: Trivy security scanning
- **Code**: CodeQL static analysis
- **SBOM**: Software Bill of Materials generation

### Performance Monitoring

- **Load Testing**: Artillery-based performance tests
- **Lighthouse**: Frontend performance audits
- **Resource Usage**: Kubernetes resource monitoring

## 🔄 Workflow Optimization

### Caching Strategy

- **Dependencies**: npm and pip package caching
- **Docker**: Multi-layer build caching with GitHub Actions cache
- **Test Results**: Artifact caching for faster reruns

### Parallel Execution

- **Test Matrix**: Parallel test execution across different suites
- **Multi-Platform**: Concurrent Docker builds for AMD64 and ARM64
- **Environment Deployment**: Parallel deployment to multiple environments

### Change Detection

- **Path Filters**: Only run relevant jobs based on changed files
- **Conditional Execution**: Skip unnecessary steps when possible
- **Concurrency Control**: Cancel in-progress runs for new commits

## 🚨 Troubleshooting

### Common Issues

#### CI Failures

```bash
# Check workflow logs
gh run list --workflow=ci.yml
gh run view <run-id> --log

# Re-run failed jobs
gh run rerun <run-id> --failed
```

#### Deployment Issues

```bash
# Check deployment status
kubectl get deployments -n echo-prod
kubectl describe deployment echo-app-prod -n echo-prod

# View pod logs
kubectl logs -f deployment/echo-app-prod -n echo-prod
```

#### Security Scan Failures

```bash
# View security scan results
gh run view <run-id> --log | grep -A 10 "Security Scan"

# Check vulnerability details
docker run --rm -v $(pwd):/workspace aquasecurity/trivy image echo:latest
```

### Debug Mode

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true`.

## 📚 Best Practices

### Branch Strategy

- **Feature branches**: `feature/description`
- **Bug fixes**: `bugfix/description`
- **Hot fixes**: `hotfix/description`
- **Releases**: `release/v1.2.3`

### Commit Messages

Follow conventional commits for automatic changelog generation:

```
feat: add new audio processing feature
fix: resolve WebRTC connection issues
docs: update API documentation
chore: update dependencies
```

### Version Management

- **Semantic Versioning**: `v1.2.3` for releases
- **Pre-releases**: `v1.2.3-beta.1` for testing
- **Automatic Tagging**: Tags created automatically on release

### Security

- **Secrets Management**: Use GitHub secrets for sensitive data
- **Least Privilege**: Minimal permissions for workflow tokens
- **Vulnerability Scanning**: Regular security scans and updates
- **SBOM Generation**: Software Bill of Materials for compliance

## 🔗 Related Documentation

- [Kubernetes Deployment Guide](../k8s/README.md)
- [Docker Configuration](../Dockerfile)
- [API Documentation](../docs/api.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

## 📞 Support

For CI/CD pipeline issues:

1. Check the [workflow runs](../../actions)
2. Review the troubleshooting section above
3. Create an issue with workflow logs
4. Contact the DevOps team via Slack `#devops`
