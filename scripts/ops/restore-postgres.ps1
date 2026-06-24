param(
    [Parameter(Mandatory=$true)]
    [string]$TargetDatabaseUrl,

    [Parameter(Mandatory=$true)]
    [string]$BackupFile,

    [Parameter(Mandatory=$false)]
    [switch]$UseDockerLocal,

    [Parameter(Mandatory=$false)]
    [switch]$AllowProductionOverride
)

$OutputEncoding = [System.Text.Encoding]::UTF8

# Check if backup file exists
if (-not (Test-Path $BackupFile)) {
    Write-Host "[FAIL] Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

# Parse host and database name for safety warning
$targetHost = "unknown"
$targetDb = "unknown"
if ($TargetDatabaseUrl -match 'postgresql://[^:]+:[^@]+@([^:/]+)(:\d+)?/([^?]+)') {
    $targetHost = $Matches[1]
    $targetDb = $Matches[3]
}

# Identify if target looks like production
$isProductionHost = $true
if ($targetHost -eq "localhost" -or $targetHost -eq "127.0.0.1" -or $targetHost -eq "postgres") {
    $isProductionHost = $false
}

Write-Host "=================== WARNING ===================" -ForegroundColor Yellow
Write-Host "You are about to restore a database backup!"
Write-Host "Target Host: $targetHost" -ForegroundColor White
Write-Host "Target Database: $targetDb" -ForegroundColor White
Write-Host "Backup File: $BackupFile" -ForegroundColor White
Write-Host "===============================================" -ForegroundColor Yellow

# Block production restore by default
if ($isProductionHost -and -not $AllowProductionOverride) {
    Write-Host "[FAIL] RESTORE BLOCKED: Target host '$targetHost' appears to be a remote/production environment." -ForegroundColor Red
    Write-Host "To override this safety check, you must pass the -AllowProductionOverride switch." -ForegroundColor Red
    exit 1
}

# Prompt user for literal "RESTORE" confirmation
Write-Host "To confirm this action, please type 'RESTORE' exactly: " -NoNewline
$userInput = Read-Host
if ($userInput -ne "RESTORE") {
    Write-Host "[FAIL] Restore aborted. User input did not match 'RESTORE'." -ForegroundColor Red
    exit 1
}

Write-Host "Proceeding with database restore..." -ForegroundColor Cyan

if ($UseDockerLocal) {
    $containerName = "presencaflow-postgres"
    $containerBackupPath = "/tmp/restore_temp.dump"
    
    Write-Host "Copying dump file to Docker container..."
    docker cp $BackupFile "${containerName}:${containerBackupPath}"
    
    Write-Host "Running pg_restore inside container..."
    # -c drops database objects before recreating, --no-owner avoids permission warnings
    docker exec $containerName pg_restore -U postgres -c -d presencaflow --no-owner $containerBackupPath
    $exitCode = $LASTEXITCODE
    
    docker exec $containerName rm $containerBackupPath | Out-Null
    
    if ($exitCode -eq 0) {
        Write-Host "[PASS] Database restored successfully inside Docker." -ForegroundColor Green
        exit 0
    } else {
        Write-Host "[FAIL] pg_restore failed inside Docker with exit code $exitCode." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Running local pg_restore command..."
    # Execute pg_restore
    & pg_restore -c --no-owner -d "$TargetDatabaseUrl" "$BackupFile"
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host "[PASS] Database restored successfully." -ForegroundColor Green
        exit 0
    } else {
        Write-Host "[FAIL] pg_restore failed with exit code $exitCode." -ForegroundColor Red
        exit 1
    }
}
