$content = Get-Content .env
$newContent = @()
$i = 0

while ($i -lt $content.Length) {
    $line = $content[$i]
    
    # Check if this is the OPENAI_API_KEY line and the next line is a continuation
    if ($line -match '^OPENAI_API_KEY=' -and $i+1 -lt $content.Length) {
        $nextLine = $content[$i+1]
        # If next line looks like part of the key (starts with alphanumeric)
        if ($nextLine -match '^[0-9a-zA-Z_-]+$') {
            # Combine them
            $newContent += $line + $nextLine
            $i += 2
            continue
        }
    }
    
    $newContent += $line
    $i++
}

$newContent | Set-Content .env
Write-Host "Fixed OPENAI_API_KEY - it should now be on one line"
