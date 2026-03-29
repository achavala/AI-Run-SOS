#!/bin/bash
set -euo pipefail

# AI-RUN-SOS EKS Deployment Script
# Usage: ./deploy.sh [tag]
# Example: ./deploy.sh v0.9.0

TAG=${1:-$(git describe --tags --abbrev=0 2>/dev/null || echo "latest")}
REGION=${AWS_REGION:-us-east-1}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
CLUSTER_NAME=${EKS_CLUSTER:-ai-run-sos}

echo "============================================"
echo "  AI-RUN-SOS Deployment"
echo "  Tag:     ${TAG}"
echo "  Region:  ${REGION}"
echo "  ECR:     ${ECR_REPO}"
echo "  Cluster: ${CLUSTER_NAME}"
echo "============================================"

# 1. Authenticate with ECR
echo "[1/6] Authenticating with ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_REPO}

# 2. Build Docker images
echo "[2/6] Building Docker images..."
docker build -f Dockerfile.api -t ${ECR_REPO}/ai-run-sos-api:${TAG} .
docker build -f Dockerfile.web -t ${ECR_REPO}/ai-run-sos-web:${TAG} .
docker build -f Dockerfile.worker -t ${ECR_REPO}/ai-run-sos-worker:${TAG} .

# Also tag as latest
docker tag ${ECR_REPO}/ai-run-sos-api:${TAG} ${ECR_REPO}/ai-run-sos-api:latest
docker tag ${ECR_REPO}/ai-run-sos-web:${TAG} ${ECR_REPO}/ai-run-sos-web:latest
docker tag ${ECR_REPO}/ai-run-sos-worker:${TAG} ${ECR_REPO}/ai-run-sos-worker:latest

# 3. Create ECR repos if they don't exist
echo "[3/6] Ensuring ECR repositories exist..."
for repo in ai-run-sos-api ai-run-sos-web ai-run-sos-worker; do
  aws ecr describe-repositories --repository-names ${repo} --region ${REGION} 2>/dev/null || \
  aws ecr create-repository --repository-name ${repo} --region ${REGION}
done

# 4. Push images
echo "[4/6] Pushing images to ECR..."
docker push ${ECR_REPO}/ai-run-sos-api:${TAG}
docker push ${ECR_REPO}/ai-run-sos-api:latest
docker push ${ECR_REPO}/ai-run-sos-web:${TAG}
docker push ${ECR_REPO}/ai-run-sos-web:latest
docker push ${ECR_REPO}/ai-run-sos-worker:${TAG}
docker push ${ECR_REPO}/ai-run-sos-worker:latest

# 5. Update kubeconfig
echo "[5/6] Updating kubeconfig..."
aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${REGION}

# 6. Apply K8s manifests
echo "[6/6] Deploying to EKS..."
kubectl apply -f k8s/namespace.yaml

# Substitute ECR_REPO in manifests and apply
for f in k8s/api-deployment.yaml k8s/web-deployment.yaml k8s/worker-deployment.yaml; do
  sed "s|\${ECR_REPO}|${ECR_REPO}|g" "$f" | kubectl apply -f -
done

kubectl apply -f k8s/ingress.yaml

# Run Prisma migration
echo "Running database migration..."
kubectl -n ai-run-sos exec deploy/api -- npx prisma db push --schema packages/db/prisma/schema.prisma --accept-data-loss

# Restart deployments to pick up new images
kubectl -n ai-run-sos rollout restart deployment/api
kubectl -n ai-run-sos rollout restart deployment/web
kubectl -n ai-run-sos rollout restart deployment/worker

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "  Tag: ${TAG}"
echo "  Waiting for rollout..."
echo "============================================"

kubectl -n ai-run-sos rollout status deployment/api --timeout=120s
kubectl -n ai-run-sos rollout status deployment/web --timeout=120s
kubectl -n ai-run-sos rollout status deployment/worker --timeout=120s

echo ""
echo "All services are running. Deployment successful!"
echo "App: https://sos.cloudresources.net"
