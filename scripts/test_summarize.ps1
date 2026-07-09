 = @{text='This is test text'; options=@{max_length=100}} | ConvertTo-Json
 = [System.Text.Encoding]::UTF8.GetBytes()
try {
     = Invoke-RestMethod -Uri http://127.0.0.1:8000/api/v1/ai/summarize -Method POST -ContentType 'application/json' -Body  -TimeoutSec 15
     | ConvertTo-Json -Depth 5
} catch {
    Write-Output ('ERROR: ' + .Exception.Message)
    if (.Exception.Response) {
         = [System.IO.StreamReader]::new(.Exception.Response.GetResponseStream())
        Write-Output ('BODY: ' + .ReadToEnd())
    }
}
