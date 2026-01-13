# PowerShell script to create Super Admin via API route
# Make sure ADMIN_CREATE_SECRET is set in Railway variables first!

$apiUrl = "https://mannystoolbox.com/api/admin/create"
$secret = "create-admin-2024"  # Change this to match your Railway variable

$body = @{
    email = "enmaeladio@gmail.com"
    name = "Emmanuel Suero"
    password = "En220193"
} | ConvertTo-Json

Write-Host "Creating Super Admin user via API..." -ForegroundColor Cyan
Write-Host "URL: $apiUrl" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $apiUrl `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $secret"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Super Admin created: enmaeladio@gmail.com" -ForegroundColor Green
    Write-Host "You can now log in at https://mannystoolbox.com" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "1. ADMIN_CREATE_SECRET is set in Railway variables" -ForegroundColor White
    Write-Host "2. The secret matches: $secret" -ForegroundColor White
    Write-Host "3. Railway service is deployed and running" -ForegroundColor White
}
