$ErrorActionPreference = "Stop"

function Show-Menu {
    Clear-Host
    Write-Host "==============================" -ForegroundColor Cyan
    Write-Host "   DOCKER MANAGEMENT SCRIPT" -ForegroundColor Cyan
    Write-Host "==============================" -ForegroundColor Cyan
    Write-Host "1. Build Secure Image (Compiles Code)"
    Write-Host "2. Run Locally (Simulates VPS)"
    Write-Host "3. Push to Registry (Prepare for VPS)"
    Write-Host "4. View Logs (Local Container)"
    Write-Host "5. Stop & Remove Local Container"
    Write-Host "q. Quit"
    Write-Host "==============================" -ForegroundColor Cyan
}

function Build-Image {
    Write-Host "`n[INFO] Building Docker Image (This may take a while)..." -ForegroundColor Yellow
    # Note: We build from Root context to allow access to both server/ and client/
    docker build -t whatsapp-crm-secure -f Dockerfile .
    if ($?) { Write-Host "`n[SUCCESS] Image Built: whatsapp-crm-secure" -ForegroundColor Green }
}

function Run-Local {
    Write-Host "`n[INFO] Preparing to run locally..." -ForegroundColor Yellow
    
    # Check for .env
    if (-not (Test-Path "server/.env")) {
        Write-Error "CRITICAL: server/.env file missing! Create one first."
        return
    }

    # Stop existing container if it exists
    $containerId = docker ps -a -q -f "name=whatsapp-crm-local"
    if ($containerId) {
        Write-Host "Stopping existing container..."
        docker stop whatsapp-crm-local | Out-Null
        docker rm whatsapp-crm-local | Out-Null
    }

    # Run
    # We mount the logs folder so you can see them on host
    # We pass the env file
    docker run -d `
        --name whatsapp-crm-local `
        -p 5000:5000 `
        --env-file server/.env `
        -v "$(Get-Location)/server_logs:/app/logs" `
        -v "$(Get-Location)/server_uploads:/app/uploads" `
        whatsapp-crm-secure

    if ($?) { 
        Write-Host "Container started. Verifying health..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        
        $state = docker inspect -f '{{.State.Running}}' whatsapp-crm-local
        if ($state -eq 'true') {
            Write-Host "`n[SUCCESS] App is running healthy at http://localhost:5000" -ForegroundColor Green 
        }
        else {
            Write-Host "`n[ERROR] Container started but crashed immediately." -ForegroundColor Red
            Write-Host "--- CRASH LOGS ---" -ForegroundColor Gray
            docker logs whatsapp-crm-local
            Write-Host "------------------" -ForegroundColor Gray
        }
    }
}

function Push-Image {
    $repo = Read-Host "Enter your Docker Hub Repository (e.g., myuser/myrepo)"
    if ([string]::IsNullOrWhiteSpace($repo)) { return }

    $tag = Read-Host "Enter Tag (default: latest)"
    if ([string]::IsNullOrWhiteSpace($tag)) { $tag = "latest" }

    $fullImage = "$repo`:$tag"

    Write-Host "`n[INFO] Tagging image as $fullImage..." -ForegroundColor Yellow
    docker tag whatsapp-crm-secure $fullImage

    Write-Host "[INFO] Pushing to Docker Hub..." -ForegroundColor Yellow
    docker push $fullImage

    if ($?) { Write-Host "`n[SUCCESS] Image Pushed!" -ForegroundColor Green }
}

function View-Logs {
    docker logs -f whatsapp-crm-local
}

function Stop-App {
    docker stop whatsapp-crm-local
    docker rm whatsapp-crm-local
    Write-Host "`n[INFO] Stopped and Removed container." -ForegroundColor Green
}

# Main Loop
do {
    Show-Menu
    $choice = Read-Host "Select an option"
    switch ($choice) {
        "1" { Build-Image; Pause }
        "2" { Run-Local; Pause }
        "3" { Push-Image; Pause }
        "4" { View-Logs }
        "5" { Stop-App; Pause }
        "q" { Write-Host "Bye!"; break }
    }
} until ($choice -eq "q")
