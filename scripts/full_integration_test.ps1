$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000/api'
$results = New-Object System.Collections.Generic.List[Object]

function Add-Result($name, $ok, $detail) {
  $results.Add([PSCustomObject]@{ test = $name; ok = $ok; detail = $detail }) | Out-Null
}

function Run-Test($name, [ScriptBlock]$block) {
  try {
    $detail = & $block
    Add-Result $name $true $detail
  } catch {
    Add-Result $name $false $_.Exception.Message
  }
}

Run-Test 'health.gateway' { (Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/health' -TimeoutSec 12) | ConvertTo-Json -Compress }
Run-Test 'health.user' { (Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/health' -TimeoutSec 12) | ConvertTo-Json -Compress }
Run-Test 'health.product' { (Invoke-RestMethod -Method Get -Uri 'http://localhost:3002/health' -TimeoutSec 12) | ConvertTo-Json -Compress }
Run-Test 'health.order' { (Invoke-RestMethod -Method Get -Uri 'http://localhost:3003/health' -TimeoutSec 12) | ConvertTo-Json -Compress }
Run-Test 'health.ai' { (Invoke-RestMethod -Method Get -Uri 'http://localhost:8000/health' -TimeoutSec 12) | ConvertTo-Json -Compress }
Run-Test 'health.frontend' { (Invoke-WebRequest -UseBasicParsing -Method Get -Uri 'http://localhost:5273' -TimeoutSec 12).StatusCode }

$tag = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$email = "fulltest_$tag@test.com"
$pwd = '123456'
$userId = $null
$orderId = $null
$productA = $null
$productB = $null

Run-Test 'auth.register.success' {
  $reg = Invoke-RestMethod -Method Post -Uri "$base/users/register" -ContentType 'application/json' -Body (@{name='Full Test';email=$email;password=$pwd} | ConvertTo-Json) -TimeoutSec 20
  $script:userId = $reg.id
  "userId=$($reg.id),email=$($reg.email)"
}

Run-Test 'auth.register.duplicate.rejected' {
  try {
    Invoke-RestMethod -Method Post -Uri "$base/users/register" -ContentType 'application/json' -Body (@{name='Dup';email=$email;password=$pwd} | ConvertTo-Json) -TimeoutSec 20 | Out-Null
    throw 'Duplicate register unexpectedly succeeded'
  } catch {
    if ($_.Exception.Message -match '400|already exists') { 'duplicate rejected as expected' } else { throw }
  }
}

Run-Test 'auth.login.success' {
  $login = Invoke-RestMethod -Method Post -Uri "$base/users/login" -ContentType 'application/json' -Body (@{email=$email;password=$pwd} | ConvertTo-Json) -TimeoutSec 20
  if (-not $login.token) { throw 'Missing token' }
  "login_user=$($login.user.email)"
}

Run-Test 'auth.login.wrong-password.rejected' {
  try {
    Invoke-RestMethod -Method Post -Uri "$base/users/login" -ContentType 'application/json' -Body (@{email=$email;password='wrong'} | ConvertTo-Json) -TimeoutSec 20 | Out-Null
    throw 'Wrong password unexpectedly succeeded'
  } catch {
    if ($_.Exception.Message -match '401|Invalid credentials') { 'wrong password rejected as expected' } else { throw }
  }
}

Run-Test 'user.profile.get' {
  $profile = Invoke-RestMethod -Method Get -Uri "$base/users/profile/$userId" -TimeoutSec 20
  if ($profile.email -ne $email) { throw 'Profile email mismatch' }
  "segment=$($profile.segment),spent=$($profile.total_spent)"
}

Run-Test 'products.list' {
  $items = Invoke-RestMethod -Method Get -Uri "$base/products" -TimeoutSec 20
  if (@($items).Count -lt 10) { throw 'Too few products returned' }
  $script:productA = $items[0]
  $script:productB = $items[1]
  "count=$(@($items).Count),p1=$($productA.id),p2=$($productB.id)"
}

Run-Test 'products.filter.category' {
  $phones = Invoke-RestMethod -Method Get -Uri "$base/products?category=phone" -TimeoutSec 20
  if (@($phones).Count -lt 1) { throw 'No phone products' }
  $bad = @($phones | Where-Object { $_.category -ne 'phone' }).Count
  if ($bad -gt 0) { throw 'Filter category returned wrong category' }
  "count=$(@($phones).Count)"
}

Run-Test 'products.filter.price-range' {
  $set = Invoke-RestMethod -Method Get -Uri "$base/products?minPrice=10&maxPrice=100" -TimeoutSec 20
  $bad = @($set | Where-Object { [double]$_.price -lt 10 -or [double]$_.price -gt 100 }).Count
  if ($bad -gt 0) { throw 'Price filter out-of-range item found' }
  "count=$(@($set).Count)"
}

Run-Test 'products.featured' {
  $featured = Invoke-RestMethod -Method Get -Uri "$base/products/featured" -TimeoutSec 20
  if (@($featured).Count -lt 1) { throw 'No featured products' }
  "count=$(@($featured).Count)"
}

Run-Test 'products.detail.by-id' {
  $detail = Invoke-RestMethod -Method Get -Uri "$base/products/$($productA.id)" -TimeoutSec 20
  if ($detail.id -ne $productA.id) { throw 'Detail id mismatch' }
  "name=$($detail.name)"
}

Run-Test 'products.by-ids' {
  $set = Invoke-RestMethod -Method Get -Uri "$base/products/by-ids?ids=$($productA.id),$($productB.id)" -TimeoutSec 20
  if (@($set).Count -lt 2) { throw 'by-ids returned too few' }
  "count=$(@($set).Count)"
}

Run-Test 'orders.create.invalid.rejected' {
  try {
    Invoke-RestMethod -Method Post -Uri "$base/orders/create" -ContentType 'application/json' -Body (@{user_id=$userId;items=@()} | ConvertTo-Json -Depth 5) -TimeoutSec 20 | Out-Null
    throw 'Invalid create unexpectedly succeeded'
  } catch {
    if ($_.Exception.Message -match '400|Missing user_id or items') { 'invalid create rejected as expected' } else { throw }
  }
}

Run-Test 'orders.create.success' {
  $order = Invoke-RestMethod -Method Post -Uri "$base/orders/create" -ContentType 'application/json' -Body (@{user_id=$userId;items=@(@{product_id=$productA.id;quantity=1},@{product_id=$productB.id;quantity=2})} | ConvertTo-Json -Depth 6) -TimeoutSec 30
  $script:orderId = $order.id
  if (-not $order.id) { throw 'Missing order id' }
  "orderId=$($order.id),total=$($order.total)"
}

Run-Test 'orders.pay.success' {
  $pay = Invoke-RestMethod -Method Post -Uri "$base/orders/pay/$orderId" -ContentType 'application/json' -TimeoutSec 60
  if (-not $pay.ok) { throw 'Pay not ok' }
  "segment=$($pay.segmentResult.segment),confidence=$($pay.segmentResult.confidence)"
}

Run-Test 'orders.pay.idempotent' {
  $again = Invoke-RestMethod -Method Post -Uri "$base/orders/pay/$orderId" -ContentType 'application/json' -TimeoutSec 30
  if (-not $again.alreadyPaid) { throw 'Second pay did not return alreadyPaid' }
  'alreadyPaid=true'
}

Run-Test 'orders.history.user' {
  $history = Invoke-RestMethod -Method Get -Uri "$base/orders/user/$userId" -TimeoutSec 20
  if (@($history).Count -lt 1) { throw 'No history returned' }
  "count=$(@($history).Count),latestStatus=$($history[0].status)"
}

Run-Test 'user.profile.updated-after-pay' {
  $profile = Invoke-RestMethod -Method Get -Uri "$base/users/profile/$userId" -TimeoutSec 20
  if ([double]$profile.total_spent -le 0) { throw 'total_spent not updated' }
  if ([int]$profile.purchase_count -lt 1) { throw 'purchase_count not updated' }
  if (-not $profile.segment) { throw 'segment missing' }
  "segment=$($profile.segment),spent=$($profile.total_spent),purchase_count=$($profile.purchase_count)"
}

Run-Test 'ai.segment.direct' {
  $seg = Invoke-RestMethod -Method Post -Uri "$base/ai/segment" -ContentType 'application/json' -Body (@{user_id=$userId;avg_price=120;total_spent=240;purchase_count=2;fav_category='accessory'} | ConvertTo-Json) -TimeoutSec 20
  if (-not $seg.segment) { throw 'No segment returned' }
  "segment=$($seg.segment),confidence=$($seg.confidence)"
}

Run-Test 'ai.recommend' {
  $rec = Invoke-RestMethod -Method Get -Uri "$base/ai/recommend/$userId" -TimeoutSec 30
  if (@($rec.products).Count -lt 1) { throw 'No recommendations' }
  "segment=$($rec.segment),count=$(@($rec.products).Count)"
}

Run-Test 'ai.chat' {
  $chat = Invoke-RestMethod -Method Post -Uri "$base/ai/chat" -ContentType 'application/json' -Body (@{user_id=$userId;message='Goi y dien thoai va laptop cho sinh vien'} | ConvertTo-Json) -TimeoutSec 80
  if (-not $chat.answer) { throw 'Empty chat answer' }
  if (@($chat.sources).Count -lt 1) { throw 'No chat sources' }
  $preview = ($chat.answer -replace "`r|`n", ' ')
  if ($preview.Length -gt 140) { $preview = $preview.Substring(0,140) }
  "segment=$($chat.segment),sources=$(@($chat.sources).Count),preview=$preview"
}

$allResults = @()
foreach ($it in $results) {
  $allResults += $it
}

$failedTests = @($allResults | Where-Object { -not $_.ok })
$totalCount = $allResults.Count
$passedCount = @($allResults | Where-Object { $_.ok }).Count
$failedCount = $failedTests.Count

Write-Output '===TEST_RESULTS_START==='
$allResults | ConvertTo-Json -Depth 6
Write-Output '===TEST_SUMMARY_START==='
@{
  total = $totalCount
  passed = $passedCount
  failed = $failedCount
  failures = $failedTests
} | ConvertTo-Json -Depth 8
if ($failedCount -gt 0) { exit 1 } else { exit 0 }
