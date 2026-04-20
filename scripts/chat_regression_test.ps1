param(
  [string]$ChatUrl = 'http://localhost:3000/api/ai/chat',
  [int]$UserId = 1,
  [int]$TimeoutSec = 60,
  [ValidateSet('strict', 'balanced', 'smoke')]
  [string]$Profile = 'balanced',
  [string]$ReportPath = 'scripts/chat_regression_report.json'
)

$ErrorActionPreference = 'Stop'

function Get-ProfileConfig([string]$name) {
  switch ($name) {
    'strict' {
      return @{
        name = 'strict'
        description = 'Chat quality gate with strict wording/product signal checks.'
        enforceAnswerAny = $true
        enforceProductsAny = $true
        enforceForbiddenSignals = $true
        enforceAnswerLength = $true
        maxAnswerLength = 550
        minProductsRelax = 0
        runPairChecks = $true
        caseIds = @()
      }
    }
    'smoke' {
      return @{
        name = 'smoke'
        description = 'Fast CI smoke checks on representative scenarios.'
        enforceAnswerAny = $false
        enforceProductsAny = $false
        enforceForbiddenSignals = $true
        enforceAnswerLength = $true
        maxAnswerLength = 850
        minProductsRelax = 1
        runPairChecks = $true
        caseIds = @(
          'cmp_phone_01',
          'cmp_laptop_01',
          'advice_phone_02',
          'advice_laptop_01',
          'budget_phone_01',
          'budget_laptop_01',
          'need_office_01',
          'need_photo_01'
        )
      }
    }
    default {
      return @{
        name = 'balanced'
        description = 'Default profile to reduce false-fail from wording drift while preserving intent checks.'
        enforceAnswerAny = $false
        enforceProductsAny = $true
        enforceForbiddenSignals = $true
        enforceAnswerLength = $true
        maxAnswerLength = 700
        minProductsRelax = 0
        runPairChecks = $true
        caseIds = @()
      }
    }
  }
}

function Normalize-Text([string]$text) {
  if (-not $text) { return '' }
  $normalized = $text.Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object System.Text.StringBuilder
  foreach ($ch in $normalized.ToCharArray()) {
    $uc = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
    if ($uc -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($ch)
    }
  }
  $out = $builder.ToString().ToLowerInvariant()
  $out = [Regex]::Replace($out, '[^a-z0-9\s]', ' ')
  $out = [Regex]::Replace($out, '\s+', ' ').Trim()
  return $out
}

function Contains-Any([string]$haystackNorm, [string[]]$needles) {
  if (-not $needles -or $needles.Count -eq 0) { return $true }
  foreach ($n in $needles) {
    if ([string]::IsNullOrWhiteSpace($n)) { continue }
    $nn = Normalize-Text $n
    if ($nn -and $haystackNorm.Contains($nn)) { return $true }
  }
  return $false
}

function Contains-None([string]$haystackNorm, [string[]]$needles) {
  if (-not $needles -or $needles.Count -eq 0) { return $true }
  foreach ($n in $needles) {
    if ([string]::IsNullOrWhiteSpace($n)) { continue }
    $nn = Normalize-Text $n
    if ($nn -and $haystackNorm.Contains($nn)) { return $false }
  }
  return $true
}

function Build-Case(
  [string]$id,
  [string]$group,
  [string]$message,
  [int]$minProducts,
  [string[]]$answerAny,
  [string[]]$answerNone,
  [string[]]$productsAny,
  [string[]]$productsNone
) {
  return [PSCustomObject]@{
    id = $id
    group = $group
    message = $message
    minProducts = $minProducts
    answerMustContainAny = $answerAny
    answerMustNotContainAny = $answerNone
    productsMustContainAny = $productsAny
    productsMustNotContainAny = $productsNone
  }
}

$cases = @(
  # So sanh
  (Build-Case 'cmp_phone_01' 'so_sanh' 'So sanh iPhone 15 Pro va Samsung S24 Ultra, nen chon may nao?' 2 @('so sanh', 'nghieng ve', 'uu tien') @() @('iphone', 's24', 'ultra', 'samsung') @()),
  (Build-Case 'cmp_laptop_01' 'so_sanh' 'So sanh MacBook Pro M3 va Dell XPS 15 cho cong viec do hoa' 2 @('so sanh', 'windows', 'apple', 'nghieng ve') @() @('macbook', 'xps', 'dell') @()),
  (Build-Case 'cmp_budget_phone_01' 'so_sanh' 'So sanh Samsung A54 va Nothing Phone 2a trong tam gia re' 2 @('so sanh', 'goi y', 'uu tien') @() @('a54', 'nothing') @('iphone 15 pro', 's24 ultra')),
  (Build-Case 'cmp_gaming_laptop_01' 'so_sanh' 'So sanh laptop gaming tam trung va laptop van phong cho sinh vien CNTT' 2 @('so sanh', 'neu', 'uu tien') @() @('laptop') @()),
  (Build-Case 'cmp_camera_phone_01' 'so_sanh' 'So sanh 2 dien thoai chup anh dep trong tam gia 15 trieu' 2 @('so sanh', 'camera', 'goi y') @() @('dien thoai', 'phone') @()),
  (Build-Case 'cmp_work_laptop_01' 'so_sanh' 'Nen chon MacBook hay laptop Windows de lam viec van phong va hop online?' 2 @('nen', 'chon', 'nghieng', 'uu tien') @() @('macbook', 'laptop') @()),

  # Tu van
  (Build-Case 'advice_phone_01' 'tu_van' 'Toi can tu van dien thoai pin trau duoi 10 trieu' 2 @('khuyen', 'uu tien', 'goi y') @() @('a54', 'nothing', 'realme', 'phone') @('iphone 15 pro', 's24 ultra')),
  (Build-Case 'advice_phone_02' 'tu_van' 'Tu van cho toi dien thoai cao cap uu tien camera quay video' 2 @('khuyen', 'uu tien', 'camera') @() @('iphone', 's24', 'pixel') @('a54', 'nothing phone 2a')),
  (Build-Case 'advice_laptop_01' 'tu_van' 'Toi can tu van laptop cho do hoa va pin tot' 2 @('khuyen', 'uu tien', 'do hoa', 'pin') @() @('laptop', 'macbook', 'xps', 'vivobook') @()),
  (Build-Case 'advice_laptop_02' 'tu_van' 'Tu van laptop hoc tap va lap trinh cho sinh vien nam nhat' 2 @('khuyen', 'goi y', 'uu tien') @() @('laptop') @()),
  (Build-Case 'advice_audio_01' 'tu_van' 'Tu van tai nghe cho hop online va nghe nhac' 2 @('khuyen', 'goi y', 'uu tien') @() @('tai nghe', 'headphone', 'earbuds') @()),
  (Build-Case 'advice_display_01' 'tu_van' 'Tu van man hinh lam viec tai nha, can nhin de lau moi mat' 2 @('khuyen', 'goi y', 'man hinh') @() @('monitor', 'man hinh') @()),
  (Build-Case 'advice_combo_01' 'tu_van' 'Goi y combo gaming gom laptop, chuot va tai nghe trong tam gia 30 trieu' 3 @('combo', 'goi y', 'uu tien') @() @('laptop', 'mouse', 'tai nghe', 'headphone') @()),
  (Build-Case 'advice_accessory_01' 'tu_van' 'Tu van phu kien cho macbook de lam viec tu xa' 2 @('goi y', 'uu tien', 'phu kien') @() @('hub', 'webcam', 'keyboard', 'mouse', 'charger') @()),

  # Ngan sach
  (Build-Case 'budget_phone_01' 'ngan_sach' 'Goi y dien thoai re tien duoi 8 trieu' 2 @('tiet kiem', 'gia tot', 'goi y') @() @('a54', 'nothing', 'realme', 'phone') @('iphone 15 pro', 's24 ultra')),
  (Build-Case 'budget_phone_02' 'ngan_sach' 'Toi co 6 trieu, nen mua dien thoai nao ngon?' 2 @('goi y', 'khuyen', 'gia') @() @('phone', 'dien thoai') @('iphone 15 pro', 's24 ultra')),
  (Build-Case 'budget_laptop_01' 'ngan_sach' 'Laptop duoi 15 trieu cho hoc tap va code' 2 @('goi y', 'khuyen', 'ngan sach') @() @('laptop') @()),
  (Build-Case 'budget_accessory_01' 'ngan_sach' 'Goi y bo phu kien re de setup goc hoc tap' 3 @('goi y', 'setup', 'goc') @() @('keyboard', 'mouse', 'webcam', 'monitor', 'hub') @()),
  (Build-Case 'budget_storage_01' 'ngan_sach' 'Toi can SSD gia re de nang cap may tinh' 2 @('goi y', 'ssd', 'gia') @() @('ssd', 'nvme', 'hdd') @()),
  (Build-Case 'budget_power_01' 'ngan_sach' 'Tu van sac nhanh gia mem cho dien thoai' 2 @('goi y', 'sac', 'gia') @() @('charger', 'sac', 'gan', 'power bank') @()),

  # Nhu cau su dung
  (Build-Case 'need_office_01' 'nhu_cau' 'Toi can setup goc lam viec tai nha de hop zoom va lam excel' 3 @('goc lam viec', 'setup', 'uu tien') @() @('monitor', 'webcam', 'keyboard', 'mouse') @()),
  (Build-Case 'need_video_01' 'nhu_cau' 'Goi y thiet bi de edit video 4k tai nha' 3 @('goi y', 'uu tien', 'video') @() @('ssd', 'monitor', 'laptop') @()),
  (Build-Case 'need_travel_01' 'nhu_cau' 'Toi hay di cong tac, can laptop nhe pin lau' 2 @('khuyen', 'uu tien', 'pin') @() @('gram', 'laptop', 'macbook') @()),
  (Build-Case 'need_stream_01' 'nhu_cau' 'Toi muon livestream ban hang, can webcam va mic tot' 2 @('goi y', 'uu tien', 'livestream') @() @('webcam', 'mic') @()),
  (Build-Case 'need_student_01' 'nhu_cau' 'Goi y bo thiet bi cho sinh vien IT hoc online va code' 3 @('goi y', 'hoc', 'code') @() @('laptop', 'monitor', 'keyboard', 'mouse') @()),
  (Build-Case 'need_photo_01' 'nhu_cau' 'Can dien thoai chup dem dep va pin tot de di du lich' 2 @('khuyen', 'uu tien', 'camera', 'pin') @() @('iphone', 's24', 'pixel', 'phone') @())
)

$profileConfig = Get-ProfileConfig $Profile
if (@($profileConfig.caseIds).Count -gt 0) {
  $cases = @($cases | Where-Object { $_.id -in $profileConfig.caseIds })
}

$results = New-Object System.Collections.Generic.List[Object]

function Add-CaseResult($obj) {
  $results.Add($obj) | Out-Null
}

foreach ($case in $cases) {
  $ok = $true
  $reasons = New-Object System.Collections.Generic.List[string]
  $answer = ''
  $confidence = 0
  $products = @()

  try {
    $payload = @{ user_id = $UserId; message = $case.message } | ConvertTo-Json
    $resp = Invoke-RestMethod -Method Post -Uri $ChatUrl -ContentType 'application/json' -Body $payload -TimeoutSec $TimeoutSec

    $answer = [string]$resp.answer
    $confidence = [double]($resp.confidence | ForEach-Object { $_ })
    $products = @($resp.product_links | ForEach-Object { [string]$_.name })

    if ([string]::IsNullOrWhiteSpace($answer)) {
      $ok = $false
      $reasons.Add('answer_empty') | Out-Null
    }

    $requiredMinProducts = [Math]::Max(1, [int]$case.minProducts - [int]$profileConfig.minProductsRelax)
    if ($products.Count -lt $requiredMinProducts) {
      $ok = $false
      $reasons.Add("products_lt_min:$($products.Count)/$requiredMinProducts") | Out-Null
    }

    $answerNorm = Normalize-Text $answer
    $productsNorm = Normalize-Text ($products -join ' | ')

    if ([bool]$profileConfig.enforceAnswerAny) {
      if (-not (Contains-Any $answerNorm $case.answerMustContainAny)) {
        $ok = $false
        $reasons.Add('answer_missing_expected_signal') | Out-Null
      }
    }

    if ([bool]$profileConfig.enforceForbiddenSignals) {
      if (-not (Contains-None $answerNorm $case.answerMustNotContainAny)) {
        $ok = $false
        $reasons.Add('answer_contains_forbidden_signal') | Out-Null
      }
    }

    if ([bool]$profileConfig.enforceProductsAny) {
      if (-not (Contains-Any $productsNorm $case.productsMustContainAny)) {
        $ok = $false
        $reasons.Add('products_missing_expected_signal') | Out-Null
      }
    }

    if ([bool]$profileConfig.enforceForbiddenSignals) {
      if (-not (Contains-None $productsNorm $case.productsMustNotContainAny)) {
        $ok = $false
        $reasons.Add('products_contains_forbidden_signal') | Out-Null
      }
    }

    if ([bool]$profileConfig.enforceAnswerLength) {
      if ($answerNorm.Length -gt [int]$profileConfig.maxAnswerLength) {
        $ok = $false
        $reasons.Add('answer_too_long') | Out-Null
      }
    }
  }
  catch {
    $ok = $false
    $reasons.Add(("request_error:" + $_.Exception.Message)) | Out-Null
  }

  $preview = $answer -replace "`r|`n", ' '
  if ($preview.Length -gt 180) { $preview = $preview.Substring(0, 180) }

  Add-CaseResult ([PSCustomObject]@{
    id = $case.id
    group = $case.group
    pass = $ok
    reasons = @($reasons)
    confidence = [Math]::Round($confidence, 3)
    productCount = $products.Count
    products = $products
    answerPreview = $preview
    message = $case.message
  })
}

# Pairwise anti-overlap checks for opposite intents.
function Product-OverlapRatio([string[]]$left, [string[]]$right) {
  $l = @($left | ForEach-Object { Normalize-Text $_ } | Where-Object { $_ })
  $r = @($right | ForEach-Object { Normalize-Text $_ } | Where-Object { $_ })
  if ($l.Count -eq 0 -or $r.Count -eq 0) { return 1.0 }
  $set = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($x in $l) { [void]$set.Add($x) }
  $inter = 0
  foreach ($x in $r) { if ($set.Contains($x)) { $inter++ } }
  return $inter / [Math]::Max($l.Count, $r.Count)
}

$pairChecks = @(
  @{ left = 'advice_phone_02'; right = 'budget_phone_01'; maxOverlap = 0.34; label = 'premium_vs_budget_phone' },
  @{ left = 'cmp_laptop_01'; right = 'budget_laptop_01'; maxOverlap = 0.67; label = 'highend_vs_budget_laptop' }
)

if ($Profile -eq 'smoke') {
  $pairChecks = @(
    @{ left = 'advice_phone_02'; right = 'budget_phone_01'; maxOverlap = 0.40; label = 'premium_vs_budget_phone' }
  )
}

$pairResults = New-Object System.Collections.Generic.List[Object]
if ([bool]$profileConfig.runPairChecks) {
foreach ($pc in $pairChecks) {
  $l = $results | Where-Object { $_.id -eq $pc.left } | Select-Object -First 1
  $r = $results | Where-Object { $_.id -eq $pc.right } | Select-Object -First 1
  $ratio = Product-OverlapRatio @($l.products) @($r.products)
  $pairPass = $ratio -le [double]$pc.maxOverlap

  if (-not $pairPass) {
    # Mark both cases as failed for quick regression visibility.
    foreach ($cid in @($pc.left, $pc.right)) {
      $item = $results | Where-Object { $_.id -eq $cid } | Select-Object -First 1
      if ($item) {
        $item.pass = $false
        $newReasons = New-Object System.Collections.Generic.List[string]
        foreach ($rs in @($item.reasons)) { $newReasons.Add([string]$rs) | Out-Null }
        $newReasons.Add("pair_overlap_fail:$($pc.label):$([Math]::Round($ratio,2))") | Out-Null
        $item.reasons = @($newReasons)
      }
    }
  }

  $pairResults.Add([PSCustomObject]@{
    name = $pc.label
    pass = $pairPass
    overlapRatio = [Math]::Round($ratio, 3)
    maxAllowed = [double]$pc.maxOverlap
    left = $pc.left
    right = $pc.right
  }) | Out-Null
}
}

$all = @()
foreach ($it in $results) {
  $all += $it
}
$failed = @($all | Where-Object { -not $_.pass })
$byGroup = @{}
foreach ($g in @($all.group | Select-Object -Unique)) {
  $grp = @($all | Where-Object { $_.group -eq $g })
  $byGroup[$g] = @{
    total = $grp.Count
    passed = @($grp | Where-Object { $_.pass }).Count
    failed = @($grp | Where-Object { -not $_.pass }).Count
  }
}

$summary = @{
  total = $all.Count
  passed = @($all | Where-Object { $_.pass }).Count
  failed = $failed.Count
  passRate = [Math]::Round((@($all | Where-Object { $_.pass }).Count * 100.0) / [Math]::Max(1, $all.Count), 2)
  byGroup = $byGroup
}

$pairChecksArray = @()
foreach ($pr in $pairResults) {
  $pairChecksArray += $pr
}

$casesArray = @()
foreach ($c in $all) {
  $casesArray += $c
}

$report = @{
  generatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  profile = $profileConfig.name
  profileDescription = $profileConfig.description
  chatUrl = $ChatUrl
  userId = $UserId
  timeoutSec = $TimeoutSec
  summary = $summary
  pairChecks = $pairChecksArray
  cases = $casesArray
}

$reportDir = Split-Path -Path $ReportPath -Parent
if ($reportDir -and -not (Test-Path $reportDir)) {
  New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

$report | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 -Path $ReportPath

Write-Output '===CHAT_REGRESSION_SUMMARY_START==='
$summary | ConvertTo-Json -Depth 8
Write-Output '===CHAT_REGRESSION_PROFILE_START==='
@{ profile = $profileConfig.name; description = $profileConfig.description; caseCount = $all.Count } | ConvertTo-Json -Depth 8
Write-Output '===CHAT_REGRESSION_PAIR_CHECKS_START==='
$pairResults | ConvertTo-Json -Depth 8
Write-Output '===CHAT_REGRESSION_FAILED_CASES_START==='
$failed | Select-Object id, group, reasons, confidence, productCount, answerPreview | ConvertTo-Json -Depth 8
Write-Output "Report saved: $ReportPath"

if ($summary.failed -gt 0) { exit 1 } else { exit 0 }
