# NewAPI Runtime Compatibility Patch

This repository contains the compatibility patch for NewAPI RC10.

## Patch Content

- Client identity management (fix RawChat 403)
- Global command palette (Cmd+K)
- Theme system (dark mode + custom colors)
- Statistics API (multi-dimensional data)
- Dashboard refactor (Overview + Models)
- Global style optimization

## Usage

The GitHub Action will automatically:
1. Download NewAPI RC10 source code
2. Apply this patch
3. Build Docker image
4. Push to GitHub Container Registry

## Deployment

```yaml
services:
  new-api:
    image: ghcr.io/your-username/newapi-runtime-compat:latest
    user: "0:0"
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    restart: unless-stopped
```

## Statistics

- New files: 30
- Modified files: 12
- New code: 5300+ lines
- API endpoints: 14
- UI components: 18+
