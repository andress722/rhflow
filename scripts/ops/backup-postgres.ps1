param(
    [Parameter(Mandatory=$false)]
    [string]$DatabaseUrl,

    [Parameter(Mandatory=$false)]
    [string]$OutputDir = "./backups",

    [Parameter(Mandatory=$false)]
    [switch]$UseDockerLocal
)

$OutputEncoding = [System.Text.Encoding]::UTF8

# Ensure output directory exists
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}

$dateStr = (Get-Date).ToString("yyyyMMdd_HHmmss")
$filename = "presencaflow_${dateStr}.dump"
$BackupPath = Join-Path $OutputDir $filename
$BackupPath = [System.IO.Path]::GetFullPath($BackupPath)

Write-Host "Starting PostgreSQL backup process..." -ForegroundColor Cyan

if ($UseDockerLocal) {
    $containerName = "presencaflow-postgres"
    $containerBackupPath = "/tmp/$filename"
    
    Write-Host "Running pg_dump inside local Docker container: $containerName..."
    
    # Run pg_dump inside the container to prevent any Windows pipeline text conversions
    docker exec $containerName pg_dump -U postgres -F c presencaflow -f $containerBackupPath
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host "Copying dump file from Docker container to host..."
        docker cp "${containerName}:${containerBackupPath}" $BackupPath
        
        # Cleanup container file
        docker exec $containerName rm $containerBackupPath | Out-Null
        
        if (Test-Path $BackupPath) {
            Write-Host "[PASS] Backup generated successfully at: $BackupPath" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "[FAIL] Failed to copy backup file from Docker container." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "[FAIL] pg_dump failed inside Docker container with exit code $exitCode." -ForegroundColor Red
        exit 1
    }
} else {
    # Extract from .env if not specified
    if (-not $DatabaseUrl) {
        $envPath = [System.IO.Path]::Combine($PSScriptRoot, "../../backend/.env")
        if (Test-Path $envPath) {
            $envContent = Get-Content $envPath
            foreach ($line in $envContent) {
                if ($line -match '^DATABASE_URL="?(.*?)"?$') {
                    $DatabaseUrl = $Matches[1]
                    break
                }
            }
        }
    }

    if (-not $DatabaseUrl) {
        Write-Host "[FAIL] Connection string (DatabaseUrl) was not provided and could not be loaded from .env." -ForegroundColor Red
        exit 1
    }

    Write-Host "Running pg_dump with connection URI..."
    
    # Hide password output in logs by executing pg_dump using the full connection string
    & pg_dump -F c -d "$DatabaseUrl" -f "$BackupPath"
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0 -and (Test-Path $BackupPath)) {
        Write-Host "[PASS] Backup generated successfully at: $BackupPath" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "[FAIL] pg_dump failed with exit code $exitCode." -ForegroundColor Red
        exit 1
    }
}
