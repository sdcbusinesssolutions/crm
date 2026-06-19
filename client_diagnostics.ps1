$domain = "apiautomation.in"
$scriptPath = $PSScriptRoot
if (-not $scriptPath) { $scriptPath = Get-Location }
$logFile = Join-Path -Path $scriptPath -ChildPath "Website_Diagnostic_Log.txt"

Function Write-Log {
    param([string]$message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$timestamp] $message"
    Write-Host $logMsg
    Add-Content -Path $logFile -Value $logMsg
}

# Clear previous log
if (Test-Path $logFile) { Remove-Item $logFile }

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Website Auto-Fix & Diagnostic Tool" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

Write-Log "Starting diagnostics and auto-fix for $domain"
Write-Log "------------------------------------------------"

# --- AUTO FIX SECTION ---
Write-Log "Step A: Attempting to automatically fix DNS cache issues..."
try {
    # Attempt PowerShell native command first
    Clear-DnsClientCache -ErrorAction Stop
    Write-Log "   [SUCCESS] System DNS Cache successfully cleared (PowerShell method)."
} catch {
    try {
        # Fallback to ipconfig
        $flushResult = ipconfig /flushdns
        if ($flushResult -match "Successfully") {
            Write-Log "   [SUCCESS] System DNS Cache successfully cleared (ipconfig method)."
        } else {
            Write-Log "   [WARNING] ipconfig /flushdns returned an unexpected result."
        }
    } catch {
        Write-Log "   [WARNING] Could not automatically flush DNS cache."
    }
}
Write-Log "------------------------------------------------"

# --- DIAGNOSTICS SECTION ---

# 1. DNS Resolution (System Default)
Write-Log "1. Checking System DNS Resolution..."
try {
    $dns = Resolve-DnsName -Name $domain -ErrorAction Stop
    foreach ($record in $dns) {
        if ($record.IPAddress) {
            Write-Log "   Resolved IP: $($record.IPAddress) (Type: $($record.Type))"
        } elseif ($record.IP4Address) {
            Write-Log "   Resolved IP: $($record.IP4Address) (Type: $($record.Type))"
        } else {
            Write-Log "   Resolved Record: $($record.NameHost) (Type: $($record.Type))"
        }
    }
} catch {
    Write-Log "   [ERROR] DNS Resolution failed: $($_.Exception.Message)"
}
Write-Log "------------------------------------------------"

# 1.b Google DNS Resolution (To check for ISP Cache issues)
Write-Log "1b. Checking Google DNS (8.8.8.8) Resolution..."
try {
    $dnsGoogle = Resolve-DnsName -Name $domain -Server 8.8.8.8 -ErrorAction Stop
    foreach ($record in $dnsGoogle) {
        if ($record.IPAddress) {
            Write-Log "   Resolved IP (Google): $($record.IPAddress) (Type: $($record.Type))"
        } elseif ($record.IP4Address) {
            Write-Log "   Resolved IP (Google): $($record.IP4Address) (Type: $($record.Type))"
        }
    }
} catch {
    Write-Log "   [ERROR] Google DNS Resolution failed: $($_.Exception.Message)"
}
Write-Log "------------------------------------------------"

# 2. Ping Test
Write-Log "2. Testing Ping (ICMP)..."
try {
    $ping = Test-Connection -ComputerName $domain -Count 4 -ErrorAction Stop
    foreach ($p in $ping) {
        Write-Log "   Reply from $($p.IPV4Address): bytes=$($p.BufferSize) time=$($p.ResponseTime)ms"
    }
} catch {
    Write-Log "   [ERROR] Ping failed or blocked by firewall: $($_.Exception.Message)"
}
Write-Log "------------------------------------------------"

# 3. Port TCP 80 & 443 Test
Write-Log "3. Testing TCP Ports (80 and 443)..."
foreach ($port in @(80, 443)) {
    try {
        $tcp = Test-NetConnection -ComputerName $domain -Port $port -WarningAction SilentlyContinue
        if ($tcp.TcpTestSucceeded) {
            Write-Log "   Port $port (TCP): OPEN"
        } else {
            Write-Log "   [ERROR] Port $port (TCP): CLOSED or BLOCKED"
        }
    } catch {
        Write-Log "   [ERROR] Port $port check failed: $($_.Exception.Message)"
    }
}
Write-Log "------------------------------------------------"

# 4. HTTP/HTTPS Request
Write-Log "4. Testing HTTPS Connection..."
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $response = Invoke-WebRequest -Uri "https://$domain" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    Write-Log "   HTTPS Request SUCCESS."
    Write-Log "   Status Code: $($response.StatusCode) ($($response.StatusDescription))"
} catch {
    Write-Log "   [ERROR] HTTPS Request failed: $($_.Exception.Message)"
}
Write-Log "------------------------------------------------"

Write-Log "Diagnostics complete."
Write-Host "`n[Done] A log file has been saved in the SAME FOLDER where you ran this script: Website_Diagnostic_Log.txt" -ForegroundColor Green

Write-Host "`n>>> IMPORTANT NEXT STEPS <<<" -ForegroundColor Yellow
Write-Host "1. Please completely CLOSE your web browser and reopen it." -ForegroundColor White
Write-Host "2. Try accessing the website again." -ForegroundColor White
Write-Host "3. If it still does not load, please send the 'Website_Diagnostic_Log.txt' file (found right next to this script) to IT." -ForegroundColor White

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
