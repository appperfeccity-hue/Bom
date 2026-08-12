.PHONY: install dev build test typecheck lint docker-build docker-run clean

# Install dependencies
install:
	cd frontend && npm ci

# Start development server
dev:
	cd frontend && npm run dev

# Build for production
build:
	cd frontend && npm run build

# Run tests
test:
	cd frontend && npm run test -- --run

# Run TypeScript type checking
typecheck:
	cd frontend && npx tsc --noEmit

# Run ESLint (skip if no config found)
lint:
	@cd frontend && \
	if [ -f eslint.config.js ] || [ -f eslint.config.mjs ] || [ -f .eslintrc.js ] || [ -f .eslintrc.json ] || [ -f .eslintrc.yml ]; then \
		npm run lint; \
	else \
		echo "No ESLint config found, skipping lint step"; \
	fi

# Build Docker image
docker-build:
	docker build -t bom-frontend ./frontend

# Run Docker container
docker-run:
	docker run --rm -p 8080:80 --env-file ./frontend/.env bom-frontend

# Clean build artifacts and dependencies
clean:
	rm -rf frontend/dist frontend/node_modules
