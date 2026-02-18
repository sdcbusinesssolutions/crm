
# Generate random user and ID variables
$randomUser = "user" + (Get-Random -Minimum 1000 -Maximum 9999)
$randomId = (Get-Random -Minimum 10000 -Maximum 99999).ToString()

# Construct the full URL with random parameters
$targetUrl = "https://n8n.srv962100.hstgr.cloud/webhook-test/2e63c779-2828-4a90-8acf-7ef6a96420a9/$randomUser/$randomId/webhook"

# Create JSON payload
$payload = @{
    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    user      = $randomUser
    id        = $randomId
    message   = "Test from PowerShell script"
} | ConvertTo-Json

# Display debug info
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Target URL: $targetUrl" -ForegroundColor Yellow
Write-Host "Payload: $payload" -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan

# Execute Request
try {
    $response = Invoke-WebRequest -Uri $targetUrl -Method Post -Body $payload -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    
    Write-Host "SUCCESS! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response Body:" -ForegroundColor Green
    Write-Host $response.Content
}
catch {
    Write-Host "REQUEST FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}
