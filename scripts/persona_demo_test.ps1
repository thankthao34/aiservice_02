$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000/api'

function New-PersonaResult($label, $email, $userId, $orderId, $orderTotal, $segment, $score, $chatAnswer, $sources) {
  $preview = ($chatAnswer -replace "`r|`n", ' ')
  if ($preview.Length -gt 180) { $preview = $preview.Substring(0, 180) }
  return [PSCustomObject]@{
    persona = $label
    email = $email
    userId = $userId
    orderId = $orderId
    orderTotal = $orderTotal
    segment = $segment
    confidence = $score
    chatPreview = $preview
    sources = ($sources -join ' | ')
  }
}

$products = Invoke-RestMethod -Method Get -Uri "$base/products" -TimeoutSec 20
$byName = @{}
foreach ($p in $products) {
  $byName[$p.name] = $p
}

$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$personas = @(
  @{
    label = 'cheap_hunter'
    email = "cheap_demo_$now@test.com"
    question = 'Toi muon mua phu kien tiet kiem'
    items = @(
      @{ product_id = $byName['Cable USB-C'].id; quantity = 1 },
      @{ product_id = $byName['Phone Case'].id; quantity = 1 },
      @{ product_id = $byName['Screen Protector'].id; quantity = 1 }
    )
  },
  @{
    label = 'normal_user'
    email = "normal_demo_$($now+1)@test.com"
    question = 'Nen mua dien thoai nao can bang gia va hieu nang?'
    items = @(
      @{ product_id = $byName['Samsung A54'].id; quantity = 1 },
      @{ product_id = $byName['AirPods Pro'].id; quantity = 1 }
    )
  },
  @{
    label = 'premium_user'
    email = "premium_demo_$($now+2)@test.com"
    question = 'Goi y laptop tot nhat cho toi'
    items = @(
      @{ product_id = $byName['MacBook Pro M3'].id; quantity = 1 },
      @{ product_id = $byName['iPhone 15 Pro'].id; quantity = 1 }
    )
  }
)

$results = @()

foreach ($pr in $personas) {
  $pwd = '123456'
  $reg = Invoke-RestMethod -Method Post -Uri "$base/users/register" -ContentType 'application/json' -Body (@{ name = $pr.label; email = $pr.email; password = $pwd } | ConvertTo-Json) -TimeoutSec 20
  $uid = $reg.id

  $order = Invoke-RestMethod -Method Post -Uri "$base/orders/create" -ContentType 'application/json' -Body (@{ user_id = $uid; items = $pr.items } | ConvertTo-Json -Depth 7) -TimeoutSec 30
  Invoke-RestMethod -Method Post -Uri "$base/orders/pay/$($order.id)" -ContentType 'application/json' -TimeoutSec 80 | Out-Null

  $profile = Invoke-RestMethod -Method Get -Uri "$base/users/profile/$uid" -TimeoutSec 20
  $chat = Invoke-RestMethod -Method Post -Uri "$base/ai/chat" -ContentType 'application/json' -Body (@{ user_id = $uid; message = $pr.question } | ConvertTo-Json) -TimeoutSec 90

  $results += New-PersonaResult $pr.label $pr.email $uid $order.id $order.total $profile.segment $profile.segment_score $chat.answer $chat.sources
}

$results | ConvertTo-Json -Depth 6
