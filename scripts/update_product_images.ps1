$ErrorActionPreference = 'Stop'
$root = 'u:\ki2_nam4\KTTK\AI-Eco\services\product-service\public\images\products'
$items = Invoke-RestMethod -Method Get -Uri 'http://localhost:3002/' -TimeoutSec 30

function Slug([string]$s) {
  return (($s.ToLower() -replace '[^a-z0-9]+', '-') -replace '^-+|-+$', '')
}

$phoneImgs = @(
  'https://images.unsplash.com/photo-1592286927505-1def25115558?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1585060544812-6b45742d762f?auto=format&fit=crop&w=1200&q=80'
)

$laptopImgs = @(
  'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1484788984921-03950022c9ef?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=80'
)

$accImgs = @(
  'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1601593346740-925612772716?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1625946473915-07f2f57e85f8?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1587826080692-47f30e8c75d9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1200&q=80'
)

$idxPhone = 0
$idxLaptop = 0
$idxAcc = 0
$ok = 0
$fail = 0

foreach ($it in $items) {
  $slug = Slug $it.name
  $out = Join-Path $root ($slug + '.jpg')

  if ($it.category -eq 'phone') {
    $url = $phoneImgs[$idxPhone % $phoneImgs.Count]
    $idxPhone++
  } elseif ($it.category -eq 'laptop') {
    $url = $laptopImgs[$idxLaptop % $laptopImgs.Count]
    $idxLaptop++
  } else {
    $url = $accImgs[$idxAcc % $accImgs.Count]
    $idxAcc++
  }

  try {
    Invoke-WebRequest -Uri $url -OutFile $out -TimeoutSec 90
    $ok++
  } catch {
    $fail++
    Write-Output ('WARN fail: ' + $it.name)
  }
}

Write-Output ('UPDATED_OK=' + $ok + '; FAIL=' + $fail)
