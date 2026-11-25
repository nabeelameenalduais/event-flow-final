$ErrorActionPreference = 'Stop'

$docPath = Join-Path $PSScriptRoot 'EventFlow_Arabic_Graduation_Report.docx'

if (-not (Test-Path -LiteralPath $docPath)) {
    throw "DOCX not found: $docPath"
}

$word = $null
$doc = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.ScreenUpdating = $false
    $word.Options.UpdateFieldsAtPrint = $false

    $doc = $word.Documents.Open($docPath, $false, $false, $false, '', '', $false)
    $doc.Repaginate()

    # Update the table of contents, list of figures and list of tables once each.
    foreach ($toc in $doc.TablesOfContents) {
        $toc.Update() | Out-Null
    }

    # Update PAGE, SEQ and other fields in the main document story.
    $doc.Fields.Update() | Out-Null

    $doc.Save()
    Write-Output "Updated Word fields in: $docPath"
}
finally {
    if ($null -ne $doc) {
        $doc.Close($true)
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc)
    }
    if ($null -ne $word) {
        $word.Quit()
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
