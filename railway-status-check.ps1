# Railway Status Check Script
# Run this to get detailed information about the current deployment

Write-Host "=== RAILWAY DEPLOYMENT STATUS CHECK ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: DNS Resolution
Write-Host "1. Testing DNS Resolution..." -ForegroundColor Yellow
try {
    $dns = Resolve-DnsName -Name "architectureapp-production.up.railway.app" -Type A
    Write-Host "✅ DNS Resolution: SUCCESS" -ForegroundColor Green
    Write-Host "   IP Address: $($dns.IPAddress)" -ForegroundColor Gray
} catch {
    Write-Host "❌ DNS Resolution: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}
Write-Host ""

# Test 2: TCP Connectivity
Write-Host "2. Testing TCP Connectivity..." -ForegroundColor Yellow
try {
    $tcp = Test-NetConnection -ComputerName "architectureapp-production.up.railway.app" -Port 443 -WarningAction SilentlyContinue
    if ($tcp.TcpTestSucceeded) {
        Write-Host "✅ TCP Connection: SUCCESS" -ForegroundColor Green
    } else {
        Write-Host "❌ TCP Connection: FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ TCP Connection: ERROR" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}
Write-Host ""

# Test 3: HTTP Response Details
Write-Host "3. Testing HTTP Response..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://architectureapp-production.up.railway.app/" -Method GET -TimeoutSec 30
    Write-Host "✅ HTTP Request: SUCCESS" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Content Length: $($response.Content.Length) bytes" -ForegroundColor Gray
} catch {
    Write-Host "❌ HTTP Request: FAILED" -ForegroundColor Red
    Write-Host "   Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    
    # Get more detailed error information
    if ($_.Exception.Response) {
        Write-Host "   Response Headers:" -ForegroundColor Gray
        $_.Exception.Response.Headers | ForEach-Object { Write-Host "     $($_.Key): $($_.Value)" -ForegroundColor DarkGray }
    }
}
Write-Host ""

# Test 4: Health Check Endpoint
Write-Host "4. Testing Health Check Endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "https://architectureapp-production.up.railway.app/health" -Method GET -TimeoutSec 30
    Write-Host "✅ Health Check: SUCCESS" -ForegroundColor Green
    Write-Host "   Response: $($health | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health Check: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}
Write-Host ""

# Test 5: Check Current Git Status
Write-Host "5. Checking Git Status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "⚠️  Uncommitted changes detected:" -ForegroundColor Yellow
    $gitStatus | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "✅ Git: Clean working directory" -ForegroundColor Green
}

$lastCommit = git log -1 --oneline
Write-Host "   Last commit: $lastCommit" -ForegroundColor Gray
Write-Host ""

# Test 6: Check Package.json Start Script
Write-Host "6. Checking Package.json Configuration..." -ForegroundColor Yellow
try {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    Write-Host "✅ Start script: $($packageJson.scripts.start)" -ForegroundColor Green
    Write-Host "   Node version required: $($packageJson.engines.node)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Package.json: Could not read" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== NEXT STEPS ===" -ForegroundColor Cyan
Write-Host "1. Check Railway Dashboard logs at: https://railway.app" -ForegroundColor White
Write-Host "2. Look for deployment errors in the 'Deployments' tab" -ForegroundColor White
Write-Host "3. Check 'Variables' tab for environment configuration" -ForegroundColor White
Write-Host "4. If logs show no errors, contact Railway support" -ForegroundColor White
Write-Host ""
