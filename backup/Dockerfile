FROM alpine:latest

# Install PostgreSQL Client (pg_dump) and bash
RUN apk add --no-cache postgresql-client bash coreutils

WORKDIR /app

# Copy the script
COPY backup/backup_cron.sh /app/backup_cron.sh
COPY server/sql/cleanup_old_logs.sql /app/cleanup_old_logs.sql
RUN chmod +x /app/backup_cron.sh

# Create backup directory
RUN mkdir -p /app/backups

CMD ["/app/backup_cron.sh"]
