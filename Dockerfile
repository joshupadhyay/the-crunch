FROM oven/bun:1 AS base
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Production image
FROM base
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV AWS_LWA_PORT=3000
ENV AWS_LWA_INVOKE_MODE=response_stream
EXPOSE 3000

CMD ["bun", "src/index.tsx"]
