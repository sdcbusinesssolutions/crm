#!/bin/bash

LOG_FILE="restart_diagnosis.log"
echo "🔍 Starting Diagnosis at $(date)" > $LOG_FILE

echo "--- 1. Checking Docker Events (Last 1 hour) ---" >> $LOG_FILE
docker events --since 1h --until 0m >> $LOG_FILE 2>&1

echo "--- 2. Checking System OOM Kills (dmesg) ---" >> $LOG_FILE
if command -v dmesg &> /dev/null; then
    dmesg | grep -i "killed process" >> $LOG_FILE 2>&1
    dmesg | grep -i "oom-killer" >> $LOG_FILE 2>&1
else
    echo "dmesg command not found." >> $LOG_FILE
fi

echo "--- 3. Checking Cron Jobs (Looking for deploy scripts) ---" >> $LOG_FILE
crontab -l | grep -i "deploy" >> $LOG_FILE 2>&1
if [ -d /etc/cron.d ]; then
    grep -r "deploy" /etc/cron.d >> $LOG_FILE 2>&1
    grep -r "deploy" /etc/crontab >> $LOG_FILE 2>&1
fi

echo "--- 4. Checking Disk Space ---" >> $LOG_FILE
df -h >> $LOG_FILE 2>&1

echo "--- 5. Checking Docker Container Inspection ---" >> $LOG_FILE
docker ps --format "{{.Names}}" | grep "whatsapp-app" | while read name; do
    echo "Inspecting $name..." >> $LOG_FILE
    docker inspect "$name" --format 'RestartCount: {{.RestartCount}}, ExitCode: {{.State.ExitCode}}, Error: {{.State.Error}}, Health: {{.State.Health.Status}}' >> $LOG_FILE 2>&1
done

echo "✅ Diagnosis Complete. Check $LOG_FILE"
cat $LOG_FILE
