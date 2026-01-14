# Fix Super Admin on Railway
# This script calls the fix endpoint on Railway to ensure the Super Admin user is correct

$railwayUrl = "https://mannystoolbox.com"
$endpoint = "$railwayUrl/api/admin/fix-super-admin"

Write-Host "`n=== FIXING SUPER ADMIN ON RAILWAY ===" -ForegroundColor Cyan
Write-Host "`nEndpoint: $endpoint" -ForegroundColor Yellow
Write-Host "`nThis will create/update the Super Admin user in the Railway database.`n" -ForegroundColor White

$body = @{
    email = "enmaeladio@gmail.com"
    password = "En220193"
    name = "Emmanuel Suero"
} | ConvertTo-Json

try {
    Write-Host "Sending request..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri $endpoint `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop

    Write-Host "`n✅ SUCCESS!" -ForegroundColor Green
    Write-Host "`nResponse:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host

    if ($response.verification.loginShouldWork) {
        Write-Host "`n✅ Login should work now!" -ForegroundColor Green
        Write-Host "Try logging in at: $railwayUrl/auth/signin" -ForegroundColor Yellow
    } else {
        Write-Host "`n⚠️  Warning: Login might still not work. Check verification details above." -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n❌ ERROR:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "`nResponse body:" -ForegroundColor Yellow
        Write-Host $responseBody -ForegroundColor Gray
    }
    
    Write-Host "`nMake sure:" -ForegroundColor Yellow
    Write-Host "1. Railway deployment is complete" -ForegroundColor White
    Write-Host "2. The endpoint is accessible: $endpoint" -ForegroundColor White
    Write-Host "3. Database connection is working on Railway" -ForegroundColor White
}

Write-Host "`n"
