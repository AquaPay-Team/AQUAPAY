$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$localDirectory = Join-Path $repoRoot ".local/digilocker-mock"
$fixtureDirectory = Join-Path $repoRoot "src/modules/kyc/document-verification/digilocker/fixtures"
$localCertificatePath = Join-Path $localDirectory "mock-signing-cert.crt"
$localKeyComponentsPath = Join-Path $localDirectory "mock-signing-key-components.json"
$expiredCertificatePath = Join-Path $fixtureDirectory "mock-expired-signing-cert.crt"

New-Item -ItemType Directory -Force -Path $localDirectory | Out-Null
New-Item -ItemType Directory -Force -Path $fixtureDirectory | Out-Null

function Write-CertificatePem([byte[]]$RawData, [string]$Path) {
  $encoded = [Convert]::ToBase64String(
    $RawData,
    [System.Base64FormattingOptions]::InsertLineBreaks
  )
  $pem = "-----BEGIN CERTIFICATE-----`n$encoded`n-----END CERTIFICATE-----`n"
  [System.IO.File]::WriteAllText($Path, $pem, [System.Text.UTF8Encoding]::new($false))
}

$createdCertificates = [System.Collections.Generic.List[string]]::new()
try {
  $now = Get-Date
  $certificate = New-SelfSignedCertificate `
    -Subject "CN=AquaPay Local DigiLocker Mock Signer" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -Provider "Microsoft Software Key Storage Provider" `
    -HashAlgorithm SHA256 `
    -KeyUsage DigitalSignature `
    -KeyExportPolicy Exportable `
    -NotBefore $now.AddMinutes(-5) `
    -NotAfter $now.AddYears(5)
  $createdCertificates.Add($certificate.Thumbprint)

  $rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($certificate)
  $parameters = $rsa.ExportParameters($true)
  $keyComponents = [ordered]@{
    Modulus = [Convert]::ToBase64String($parameters.Modulus)
    Exponent = [Convert]::ToBase64String($parameters.Exponent)
    D = [Convert]::ToBase64String($parameters.D)
    P = [Convert]::ToBase64String($parameters.P)
    Q = [Convert]::ToBase64String($parameters.Q)
    DP = [Convert]::ToBase64String($parameters.DP)
    DQ = [Convert]::ToBase64String($parameters.DQ)
    InverseQ = [Convert]::ToBase64String($parameters.InverseQ)
  }
  [System.IO.File]::WriteAllText(
    $localKeyComponentsPath,
    (ConvertTo-Json $keyComponents -Compress),
    [System.Text.UTF8Encoding]::new($false)
  )
  Write-CertificatePem $certificate.RawData $localCertificatePath
  $rsa.Dispose()

  $expiredCertificate = New-SelfSignedCertificate `
    -Subject "CN=AquaPay Expired DigiLocker Mock Signer" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -Provider "Microsoft Software Key Storage Provider" `
    -HashAlgorithm SHA256 `
    -KeyUsage DigitalSignature `
    -KeyExportPolicy Exportable `
    -NotBefore $now.AddYears(-2) `
    -NotAfter $now.AddYears(-1)
  $createdCertificates.Add($expiredCertificate.Thumbprint)
  Write-CertificatePem $expiredCertificate.RawData $expiredCertificatePath

  $env:IDTO_MOCK_SIGNING_CERT_PATH = $localCertificatePath
  $env:IDTO_MOCK_SIGNING_KEY_PATH = $localKeyComponentsPath
  & node (Join-Path $repoRoot "scripts/sign-digilocker-mock-fixtures.js")
  if ($LASTEXITCODE -ne 0) {
    throw "Mock DigiLocker fixture signing failed"
  }

  Write-Output "Generated local mock signing key and signed fictional DigiLocker fixtures."
  Write-Output "Private key: .local/digilocker-mock/mock-signing-key.pem (gitignored)"
  Write-Output "Public certificate: src/modules/kyc/document-verification/digilocker/fixtures/mock-signing-cert.crt"
} finally {
  Remove-Item -LiteralPath $localKeyComponentsPath -ErrorAction SilentlyContinue
  Remove-Item Env:IDTO_MOCK_SIGNING_CERT_PATH -ErrorAction SilentlyContinue
  Remove-Item Env:IDTO_MOCK_SIGNING_KEY_PATH -ErrorAction SilentlyContinue
  foreach ($thumbprint in $createdCertificates) {
    Remove-Item "Cert:\CurrentUser\My\$thumbprint" -ErrorAction SilentlyContinue
  }
}
