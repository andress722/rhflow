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
    [string]$InternalJobSecret
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

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Starting PresençaFlow RH Production Smoke Test" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. GET Frontend /
$stepName = "GET Frontend /"
$res = Invoke-Api -Url $FrontendBaseUrl -Method 'GET'
if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 400) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Status code was $($res.StatusCode)"
}

# 2. GET Frontend /pilot
$stepName = "GET Frontend /pilot"
$res = Invoke-Api -Url "$FrontendBaseUrl/pilot" -Method 'GET'
if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 400) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Status code was $($res.StatusCode)"
}

# 3. GET /api/health/live
$stepName = "GET /api/health/live"
$res = Invoke-Api -Url "$ApiBaseUrl/api/health/live" -Method 'GET'
if ($res.StatusCode -eq 200 -and $res.Data.status -eq "OK") {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Response: $($res.Raw)"
}

# 4. GET /api/health/ready
$stepName = "GET /api/health/ready"
$res = Invoke-Api -Url "$ApiBaseUrl/api/health/ready" -Method 'GET'
if ($res.StatusCode -eq 200 -and $res.Data.status -eq "OK") {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Response: $($res.Raw)"
}

# 5. POST /api/public/pilot-leads com UTM production_smoke
$stepName = "POST /api/public/pilot-leads com UTM production_smoke"
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
$testEmail = "smoke_test_$timestamp@presencaflow.com.br"
$leadBody = @{
    name = "Smoke Test User"
    companyName = "Smoke Test Company"
    role = "Lead Tester"
    email = $testEmail
    whatsapp = "5511999999999"
    employeeCount = 10
    mainPain = "Atestados"
    source = "production_smoke"
    utmCampaign = "production_smoke"
    utmSource = "production_smoke"
} | ConvertTo-Json

$res = Invoke-Api -Url "$ApiBaseUrl/api/public/pilot-leads" -Method 'POST' -Body $leadBody -Headers @{"Content-Type" = "application/json"}
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Failed to create public pilot lead. Response: $($res.Raw)"
}

# 6. Login SUPER_ADMIN
$stepName = "Login SUPER_ADMIN"
$loginBody = @{
    email = $SuperAdminEmail
    password = $SuperAdminPassword
} | ConvertTo-Json
$res = Invoke-Api -Url "$ApiBaseUrl/api/auth/login" -Method 'POST' -Body $loginBody -Headers @{"Content-Type" = "application/json"}
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    $superToken = $res.Data.data.token
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Super Admin credentials rejected. Status: $($res.StatusCode). Response: $($res.Raw)"
}

# 7. GET /api/admin/leads filtrando lead production_smoke
$stepName = "GET /api/admin/leads filtrando lead production_smoke"
$headers = @{ "Authorization" = "Bearer $superToken" }
$res = Invoke-Api -Url "$ApiBaseUrl/api/admin/leads?source=production_smoke&utmCampaign=production_smoke" -Method 'GET' -Headers $headers
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    $found = $false
    foreach ($lead in $res.Data.data) {
        if ($lead.email -eq $testEmail) {
            $found = $true
            break
        }
    }
    if ($found) {
        Write-Pass $stepName
    } else {
        Write-Fail $stepName "Lead with email $testEmail not found in administration list."
    }
} else {
    Write-Fail $stepName "Failed to fetch admin leads list. Response: $($res.Raw)"
}

# 8. GET /api/admin/support/overview
$stepName = "GET /api/admin/support/overview"
$res = Invoke-Api -Url "$ApiBaseUrl/api/admin/support/overview" -Method 'GET' -Headers $headers
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Failed to fetch support overview. Response: $($res.Raw)"
}

# 9. GET /api/internal/jobs/ping com secret errado -> 401
$stepName = "GET /api/internal/jobs/ping com secret errado"
$jobHeadersWrong = @{
    "x-internal-job-secret" = "invalid_secret_key_123"
}
$res = Invoke-Api -Url "$ApiBaseUrl/api/internal/jobs/ping" -Method 'GET' -Headers $jobHeadersWrong
if ($res.StatusCode -eq 401) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Expected 401 status code, got $($res.StatusCode)"
}

# 10. GET /api/internal/jobs/ping com secret correto -> 200
$stepName = "GET /api/internal/jobs/ping com secret correto"
$jobHeadersCorrect = @{
    "x-internal-job-secret" = $InternalJobSecret
}
$res = Invoke-Api -Url "$ApiBaseUrl/api/internal/jobs/ping" -Method 'GET' -Headers $jobHeadersCorrect
if ($res.StatusCode -eq 200 -and $res.Data.success) {
    Write-Pass $stepName
} else {
    Write-Fail $stepName "Expected 200 success with correct secret, got status $($res.StatusCode). Response: $($res.Raw)"
}

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Production Smoke Test Completed Successfully [EXIT 0]" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
exit 0
