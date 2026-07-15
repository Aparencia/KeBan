try {
     = Invoke-WebRequest -Uri 'https://entropydecrease.com/health/quick' -Method GET -UseBasicParsing -TimeoutSec 10
    Write-Host " Health Status:  \
 Write-Host \Health Content:  \
} catch {
 = .Exception.Response
 if () {
 Write-Host \Health Status: 0  \
 } else {
 Write-Host \Health Error:  \
 }
}
try {
 = Invoke-WebRequest -Uri 'https://entropydecrease.com/api/v1/ai/summarize' -Method POST -UseBasicParsing -TimeoutSec 10 -ContentType 'application/json' -Body '{}'
 Write-Host \Summarize Status:  \
 Write-Host \Summarize Content:  \
} catch {
 = .Exception.Response
 if () {
 Write-Host \Summarize Status: 0  \
 = .GetResponseStream()
 = New-Object System.IO.StreamReader()
 Write-Host \Summarize Body:  \
 } else {
 Write-Host \Summarize Error:  \
 }
}
