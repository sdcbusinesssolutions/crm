#!/bin/bash
# Checks if bulk_deploy.sh needs unix conversion and runs it
remote_dir=$1
cd "$remote_dir"
unzip -o deploy-package.zip
dos2unix bulk_deploy.sh 2>/dev/null || sed -i 's/\r$//' bulk_deploy.sh
chmod +x bulk_deploy.sh
./bulk_deploy.sh
