param(
    [string]$BaseUrl = "http://127.0.0.1:8080"
)

$loginBody = @{
    username = "admin"
    password = "123456"
} | ConvertTo-Json

$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/login" -ContentType "application/json" -Body $loginBody
$token = $login.data.token

Write-Host "Token acquired"

$headers = @{
    Authorization = "Bearer $token"
}

$employees = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/employees?page=1&page_size=10" -Headers $headers
$departments = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/departments" -Headers $headers
$leaves = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/leaves?page=1&page_size=10" -Headers $headers

Write-Host "Employees:" $employees.data.total
Write-Host "Departments:" $departments.data.Count
Write-Host "Leaves:" $leaves.data.total
