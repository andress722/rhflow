param(
    [Parameter(Mandatory=$true)]
    [string]$ApiBaseUrl,

    [Parameter(Mandatory=$true)]
    [string]$FrontendBaseUrl,

    [Parameter(Mandatory=$true)]
    [string]$SuperAdminEmail,

    [Parameter(Mandatory=$true)]
    [string]$SuperAdminPassword,

    [Parameter(Mandatory=$true)]
    [string]$InternalJobSecret,

    [Parameter(Mandatory=$false)]
    [string]$TestCompanyCnpj,

    [Parameter(Mandatory=$false)]
    [string]$TestCompanyName
)

# Set standard output encoding
$OutputEncoding = [System.Text.Encoding]::UTF8

# Helpers for formatting status output
function Write-Pass {
    param([string]$message)
    Write-Host "[PASS] $message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$message, [string]$reason)
    Write-Host "[FAIL] $message - $reason" -ForegroundColor Red
    exit 1
}

# Helper to perform standard HTTP API requests
function Invoke-Api {
    param(
        [string]$Url,
        [string]$Method = 'GET',
        [string]$Body = $null,
        $Headers = @{}
    )
    
    $params = @{
        Uri = $Url
        Method = $Method
        Headers = $Headers
        UseBasicParsing = $true
    }
    
    if ($Body) {
        $params.Body = $Body
    }
    
    try {
        $response = Invoke-WebRequest @params
        $json = $null
        if ($response.Content) {
            try {
                $json = $response.Content | ConvertFrom-Json
            } catch {}
        }
        return @{
            Success = $true
            StatusCode = $response.StatusCode
            Data = $json
            Raw = $response.Content
        }
    } catch {
        $ex = $_
        $statusCode = 0
        $errorBody = ""
        if ($ex.Exception.Response) {
            $statusCode = [int]$ex.Exception.Response.StatusCode
            $reader = New-Object System.IO.StreamReader($ex.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
        }
        
        $errorJson = $null
        try {
            $errorJson = $errorBody | ConvertFrom-Json
        } catch {}
        
        return @{
            Success = $false
            StatusCode = $statusCode
            Error = $errorJson
            Raw = $errorBody
            Exception = $ex
        }
    }
}

# Helper to perform multipart file upload for CSV import
function Invoke-MultipartUpload {
    param(
        [string]$Url,
        [string]$FilePath,
        [string]$Token
    )
    
    $boundary = [System.Guid]::NewGuid().ToString()
    $fileBytes = [System.IO.File]::ReadAllBytes($FilePath)
    $fileName = [System.IO.Path]::GetFileName($FilePath)
    
    $LF = "`r`n"
    $body = New-Object System.IO.MemoryStream
    $writer = New-Object System.IO.StreamWriter($body)
    
    $writer.Write("--$boundary$LF")
    $writer.Write("Content-Disposition: form-data; name=""file""; filename=""$fileName""$LF")
    $writer.Write("Content-Type: text/csv$LF$LF")
    $writer.Flush()
    
    $body.Write($fileBytes, 0, $fileBytes.Length)
    
    $writer.Write("$LF--$boundary--$LF")
    $writer.Flush()
    
    $headers = @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "multipart/form-data; boundary=$boundary"
    }
    
    $bodyBytes = $body.ToArray()
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Post -Body $bodyBytes -Headers $headers -UseBasicParsing
        $json = $null
        if ($response.Content) {
            $json = $response.Content | ConvertFrom-Json
        }
        return @{
            Success = $true
            StatusCode = $response.StatusCode
            Data = $json
        }
    } catch {
        $ex = $_
        $statusCode = 0
        $errorBody = ""
        if ($ex.Exception.Response) {
            $statusCode = [int]$ex.Exception.Response.StatusCode
            $reader = New-Object System.IO.StreamReader($ex.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
        }
        return @{
            Success = $false
            StatusCode = $statusCode
            Raw = $errorBody
            Error = $errorBody
        }
    }
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Starting PresençaFlow RH Smoke Test Suite" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. GET frontend base URL
$stepName = "GET frontend base URL"
$res = Invoke-Api -Url $FrontendBaseUrl -Method 'GET'
if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 400) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Status code was $($res.StatusCode)"
}

# 2. GET /api/health/live
$stepName = "GET /api/health/live"
$res = Invoke-Api -Url "$ApiBaseUrl/api/health/live" -Method 'GET'
if ($res.StatusCode -eq 200 -and $res.Data.status -eq "OK") {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Response: $($res.Raw)"
}

# 3. GET /api/health/ready
$stepName = "GET /api/health/ready"
$res = Invoke-Api -Url "$ApiBaseUrl/api/health/ready" -Method 'GET'
if ($res.StatusCode -eq 200 -and $res.Data.status -eq "OK") {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Response: $($res.Raw)"
}

# 4. Login SUPER_ADMIN
$stepName = "Login SUPER_ADMIN"
$loginBody = @{
    email = $SuperAdminEmail
    password = $SuperAdminPassword
} | ConvertTo-Json
$res = Invoke-Api -Url "$ApiBaseUrl/api/auth/login" -Method 'POST' -Body $loginBody
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    $superToken = $res.Data.data.token
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Credentials rejected or connection error. Status: $($res.StatusCode). Response: $($res.Raw)"
}

# Generate unique values for onboarding to keep test execution idempotent
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
if ($timestamp.Length -gt 12) {
    $timestamp = $timestamp.Substring(0, 12)
}
$cnpj = $TestCompanyCnpj
if (-not $cnpj) {
    $cnpj = "99" + $timestamp
}
$companyName = $TestCompanyName
if (-not $companyName) {
    $companyName = "Empresa Piloto $timestamp"
}
$adminEmail = "admin.company$timestamp@test.com"

# 5. POST /api/admin/companies/onboard
$stepName = "POST /api/admin/companies/onboard"
$onboardBody = @{
    company = @{
        legalName = "$companyName Ltda"
        tradeName = $companyName
        cnpj = $cnpj
    }
    adminUser = @{
        name = "Gestor $companyName"
        email = $adminEmail
    }
    planCode = "PRO"
} | ConvertTo-Json

$headers = @{ "Authorization" = "Bearer $superToken"; "Content-Type" = "application/json" }
$res = Invoke-Api -Url "$ApiBaseUrl/api/admin/companies/onboard" -Method 'POST' -Body $onboardBody -Headers $headers
if ($res.StatusCode -eq 201 -and $res.Data.success) {
    $tempPassword = $res.Data.data.tempPassword
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Onboarding failed. Response: $($res.Raw)"
}

# 6. Login ADMIN inicial
$stepName = "Login ADMIN inicial"
$adminLoginBody = @{
    email = $adminEmail
    password = $tempPassword
} | ConvertTo-Json
$res = Invoke-Api -Url "$ApiBaseUrl/api/auth/login" -Method 'POST' -Body $adminLoginBody
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    $adminToken = $res.Data.data.token
    $mustChange = $res.Data.data.user.mustChangePassword
    if ($mustChange -eq $true) {
        Write-Pass $stepName
    } else {
        Write-Fail $stepName "mustChangePassword flag was expected to be true, got false"
    }
} else {
    Write-Fail $stepName "Login of temporary admin failed. Response: $($res.Raw)"
}

# 7. POST /api/auth/change-password
$stepName = "POST /api/auth/change-password"
$changeBody = @{
    currentPassword = $tempPassword
    newPassword = "StrongNewPassword123!"
} | ConvertTo-Json
$headers = @{ "Authorization" = "Bearer $adminToken"; "Content-Type" = "application/json" }
$res = Invoke-Api -Url "$ApiBaseUrl/api/auth/change-password" -Method 'POST' -Body $changeBody -Headers $headers
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    # Refresh token
    $adminToken = $res.Data.data.token
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Failed to change temporary password. Response: $($res.Raw)"
}

# 8. GET /api/billing/plan
$stepName = "GET /api/billing/plan"
$headers = @{ "Authorization" = "Bearer $adminToken" }
$res = Invoke-Api -Url "$ApiBaseUrl/api/billing/plan" -Method 'GET' -Headers $headers
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Failed to fetch billing plan. Response: $($res.Raw)"
}

# 9. GET /api/onboarding/checklist
$stepName = "GET /api/onboarding/checklist"
$res = Invoke-Api -Url "$ApiBaseUrl/api/onboarding/checklist" -Method 'GET' -Headers $headers
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Failed to fetch onboarding checklist. Response: $($res.Raw)"
}

# 10. Create small temp CSV
$stepName = "Create CSV file"
$tempCsvPath = [System.IO.Path]::GetTempFileName()
$csvData = "name;cpf;whatsapp;email;sector;workmodel;manageremail;workschedulename`nCarlos Santos;12345678901;5511999999999;carlos@test.com;TI;REMOTE;;"
[System.IO.File]::WriteAllText($tempCsvPath, $csvData, [System.Text.Encoding]::UTF8)
if (Test-Path $tempCsvPath) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Failed to write CSV file on disk"
}

# 11. POST /api/employees/import
$stepName = "POST /api/employees/import"
$res = Invoke-MultipartUpload -Url "$ApiBaseUrl/api/employees/import" -FilePath $tempCsvPath -Token $adminToken
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    Write-Pass $stepName
} else {
    # Cleanup temp CSV on fail
    Remove-Item $tempCsvPath -ErrorAction SilentlyContinue
    Write-Fail $stepName "CSV Import failed. Response: $($res.Raw)"
}

# 12. Remove temp CSV
$stepName = "Remove CSV file"
Remove-Item $tempCsvPath -ErrorAction SilentlyContinue
if (-not (Test-Path $tempCsvPath)) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Failed to delete temporary CSV file"
}

# 13. GET /api/presence/summary
$stepName = "GET /api/presence/summary"
$res = Invoke-Api -Url "$ApiBaseUrl/api/presence/summary" -Method 'GET' -Headers $headers
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Failed to fetch presence summary. Response: $($res.Raw)"
}

# 14. GET /api/whatsapp-channel
$stepName = "GET /api/whatsapp-channel"
$res = Invoke-Api -Url "$ApiBaseUrl/api/whatsapp-channel" -Method 'GET' -Headers $headers
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    # Ensure confidential secrets are masked/omitted in response
    if ($res.Raw -like "*accessToken*" -or $res.Raw -like "*webhookSecret*" -and -not ($res.Raw -like "*webhookSecretMasked*")) {
        Write-Fail $stepName "Security leak detected: secrets exposed in API response! Raw: $($res.Raw)"
    } else {
        Write-Pass $stepName
    }
} else {
    Write-Fail $stepName "Failed to fetch whatsapp configuration. Response: $($res.Raw)"
}

# 15. GET /api/reports/operational
$stepName = "GET /api/reports/operational"
$today = (Get-Date).ToString("yyyy-MM-dd")
$res = Invoke-Api -Url "$ApiBaseUrl/api/reports/operational?from=$today&to=$today" -Method 'GET' -Headers $headers
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Failed to fetch operational report. Response: $($res.Raw)"
}

# 16. Export CSV operational & validate CPF privacy
$stepName = "Export CSV operational & validate CPF privacy"
$res = Invoke-Api -Url "$ApiBaseUrl/api/reports/operational/export?from=$today&to=$today" -Method 'GET' -Headers $headers
if ($res.StatusCode -eq 200) {
    $csvContent = $res.Raw
    # Verify that the CPF is masked
    if ($csvContent -like "****.***.***-**" -or $csvContent -like "*CPF*") {
        # Check that there is no sequence of 11 consecutive digits in the CSV
        if ($csvContent -match '\d{11}') {
            Write-Fail $stepName "Security leak: CSV contains an unmasked 11-digit CPF sequence!"
        } else {
            Write-Pass $stepName
        }
    } else {
        Write-Fail $stepName "CSV headers or structure mismatch. CSV response: $csvContent"
    }
} else {
    Write-Fail $stepName "Failed to export operational report. Response: $($res.Raw)"
}

# 17. POST /api/internal/jobs/mark-not-responded with WRONG secret
$stepName = "POST /api/internal/jobs/mark-not-responded with WRONG secret"
$jobHeaders = @{
    "x-internal-job-secret" = "wrong-secret-value-12345"
    "Content-Type" = "application/json"
}
$res = Invoke-Api -Url "$ApiBaseUrl/api/internal/jobs/mark-not-responded" -Method 'POST' -Headers $jobHeaders
if ($res.StatusCode -eq 401) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Expected 401 Unauthorized, got $($res.StatusCode). Response: $($res.Raw)"
}

# 18. POST /api/internal/jobs/mark-not-responded with CORRECT secret
$stepName = "POST /api/internal/jobs/mark-not-responded with CORRECT secret"
$jobHeaders = @{
    "x-internal-job-secret" = $InternalJobSecret
    "Content-Type" = "application/json"
}
$res = Invoke-Api -Url "$ApiBaseUrl/api/internal/jobs/mark-not-responded" -Method 'POST' -Headers $jobHeaders
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Job execution failed with correct secret. Status: $($res.StatusCode). Response: $($res.Raw)"
}

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Smoke Test Completed Successfully [EXIT 0]" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
exit 0
