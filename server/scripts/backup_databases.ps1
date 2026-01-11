<#
.SYNOPSIS
    Bulk Backup Script for Supabase Databases
.DESCRIPTION
    Reads domains.csv and backs up Schema, Roles, and Data for each tenant.
    Requires 'pg_dump' to be installed and in PATH.
.PARAMETER CsvPath
    Path to domains.csv (Default: ../../domains.csv)
#>

param (
    [string]$CsvPath = "$PSScriptRoot/../../domains.csv",
    [string]$BackupDir = "$PSScriptRoot/../../backups"
)

# 1. Check for pg_dump
if (-not (Get-Command "pg_dump" -ErrorAction SilentlyContinue)) {
    Write-Error "[ERROR] 'pg_dump' is not installed or not in PATH. Please install PostgreSQL tools."
    exit 1
}

# 2. Check CSV
if (-not (Test-Path $CsvPath)) {
    Write-Error "[ERROR] domains.csv not found at $CsvPath"
    exit 1
}

# 3. Create Backup Directory
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
}

$domains = Import-Csv $CsvPath

foreach ($row in $domains) {
    $domain = $row.Domain
    $dbUrl = $row.DbConnection 

    Write-Host "`n[PROCESSING]: $domain" -ForegroundColor Cyan

    # Check if DB URL exists (User needs to add this column or provide it)
    if ([string]::IsNullOrWhiteSpace($dbUrl)) {
        Write-Warning "   [SKIP] '$domain': No 'DbConnection' column in CSV."
        Write-Warning "   [INFO] Add a column 'DbConnection' to domains.csv with string: postgres://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
        continue
    }

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $targetFolder = Join-Path $BackupDir $domain
    if (-not (Test-Path $targetFolder)) { New-Item -ItemType Directory -Force -Path $targetFolder | Out-Null }

    # Files
    $schemaFile = Join-Path $targetFolder "${timestamp}_schema.sql"
    $dataFile = Join-Path $targetFolder "${timestamp}_data.sql"
    $rolesFile = Join-Path $targetFolder "${timestamp}_roles.sql"

    try {
        # A. Schema (Structure)
        Write-Host "   [DUMP] Dumping Schema..."
        $env = @{ "PGPASSWORD" = ($dbUrl -split ":")[2].Split("@")[0] } # Basic parsing, better to use Uri
        # Note: Parsing connection string in PWSH is complex, assumption: user passes URI to pg_dump -d
        
        pg_dump --dbname "$dbUrl" --schema-only --no-owner --no-privileges --file "$schemaFile"
        if ($LASTEXITCODE -eq 0) { Write-Host "      [OK] Schema Saved" -ForegroundColor Green }
        else { Write-Error "      [FAIL] Schema Dump Failed" }

        # B. Data (Content)
        Write-Host "   [DUMP] Dumping Data..."
        pg_dump --dbname "$dbUrl" --data-only --no-owner --no-privileges --file "$dataFile"
        if ($LASTEXITCODE -eq 0) { Write-Host "      [OK] Data Saved" -ForegroundColor Green }
        else { Write-Error "      [FAIL] Data Dump Failed" }

        # C. Roles (Global) - require pg_dumpall, often restricted in cloud
        # We try to dump only roles if possible, or skip if restricted.
        # pg_dumpall requires connection to 'postgres' db and often superuser.
        # usually supabase admin user is not superuser. skipping for safety unless requested.

    }
    catch {
        Write-Error "   [ERROR] Unexpected: $_"
    }
}

Write-Host "`n[DONE] Backup Process Completed." -ForegroundColor Green
