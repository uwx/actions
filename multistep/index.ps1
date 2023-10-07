#https://stackoverflow.com/a/69267542
if (-not(Get-Module -ListAvailable -Name hugoalh.GitHubActionsToolkit)) {
    Install-Module hugoalh.GitHubActionsToolkit
}
if (-not(Get-Module -ListAvailable -Name Glob)) {
    Install-Module Glob
}

Import-Module -Name hugoalh.GitHubActionsToolkit -Global
Import-Module -Name Glob -Global

$Kernel32 = Add-Type -MemberDefinition '[DllImport("kernel32.dll")] static extern bool GenerateConsoleCtrlEvent(uint dwCtrlEvent, uint dwProcessGroupId);' -Name "Win32ShowWindowAsync" -Namespace Win32Functions -PassThru

function Send-InterruptProcess {
    param (
        [uint] $ProcessToBreakPid
    )

    $CTRL_BREAK_EVENT = 1

    $Kernel32::GenerateConsoleCtrlEvent($CTRL_BREAK_EVENT, $ProcessToBreakPid)
}

function Get-GitHubActionsInputBoolean {
    param (
        [string] $Name
    )

    $Value = Get-GitHubActionsInput $Name
    return $Value -ieq "true" || $Value -ieq "on" || $Value -ieq "yes" || $Value -ieq "1"
}

# https://stackoverflow.com/a/42108420
function Using-Object
{
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [AllowEmptyCollection()]
        [AllowNull()]
        [Object]
        $InputObject,

        [Parameter(Mandatory = $true)]
        [scriptblock]
        $ScriptBlock
    )

    try
    {
        . $ScriptBlock
    }
    finally
    {
        if ($null -ne $InputObject -and $InputObject -is [System.IDisposable])
        {
            $InputObject.Dispose()
        }
    }
}

$ExecutionResult_Success = "success"
$ExecutionResult_Timeout = "timeout"
$ExecutionResult_Failure = "failure"
$ExecutionResult_Skipped = "skipped"

# https://devblogs.microsoft.com/scripting/use-a-powershell-function-to-see-if-a-command-exists/
Function Test-CommandExists {
    Param ($command)
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'stop'
    Try { if (Get-Command $command) { return $true } }
    Catch { Write-Host "$command does not exist"; return $false }
    Finally { $ErrorActionPreference = $oldPreference }
} #end function test-CommandExists

function Start-RunProcessWithTimeout {
    Param(
        [string] $Cwd,
        [string] $Shell,
        [string] $Command,
        [string[]] $Arguments,
        [long] $Timeout,
        [ref] $wroteToStdErr,
        [ref] $exitCode
    )

    # TODO: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process?view=powershell-7.3#example-9-create-a-detached-process-on-linux
    # $proc = Start-Process -FilePath $command -ArgumentList $arguments -WorkingDirectory $Cwd -PassThru -Verb Open

    #$outputText = [System.Text.StringBuilder]::new()
    #$errorText = [System.Text.StringBuilder]::new()

    $wroteToStdErr = $false

    if (-not [File]::Exists($command)) {
        $command = (Get-Command $command).Path
    }

    Using-Object ($proc = [Process]::Start([ProcessStartInfo]@{
        FileName = $command
        Arguments = $arguments
        RedirectStandardError = $true
        RedirectStandardOutput = $true
        UseShellExecute = $false
    })) {
        $proc.add_OutputDataReceived({
            param($sendingProcess, $outLine)

            #$outputText::AppendLine($outLine.Data)
            Write-Output $outLine.Data
        })

        $proc.add_ErrorDataReceived({
            param($sendingProcess, $errorLine)

            if (-not $wroteToStdErr && -not [string]::IsNullOrWhiteSpace($errorLine)) {
                $wroteToStdErr = $true
            }
            #$errorText::AppendLine($errorLine.Data)
            Write-Error $errorLine.Data
        })

        $proc::BeginOutputReadLine()
        $proc::BeginErrorReadLine()
        #$proc::WaitForExit();

        if ($Timeout -eq 0) {
            $proc::WaitForExit()
            $exitCode = $proc.ExitCode
            return $ExecutionResult_Success
        }

        # keep track of timeout event
        $timedOut = $null

        # wait up to x seconds for normal termination
        $proc | Wait-Process -Timeout ($Timeout / 1000) -ErrorAction SilentlyContinue -ErrorVariable timedOut

        if ($timedOut)
        {
            $maxRetries = 3
            for ($i = 0; $i -lt $maxRetries; $i++)
            {
                Write-Output "Sending CTRL+BREAK to process $proc attempt $($i+1) of $maxRetries";
                Send-InterruptProcess $proc.Id

                $proc | Wait-Process -Timeout 3 -ErrorAction SilentlyContinue -ErrorVariable didNotEnd

                if (-not $didNotEnd)
                {
                    $exitCode = $proc.ExitCode
                    return $ExecutionResult_Timeout
                }
            }

            $proc | Wait-Process -Timeout 10 -ErrorAction SilentlyContinue -ErrorVariable didNotEnd2

            if (-not $didNotEnd2)
            {
                $exitCode = $proc.ExitCode
                return $ExecutionResult_Timeout
            }

            # terminate the process
            Write-Output "Killing process $proc";
            $proc | Stop-Process -Force

            $exitCode = $proc.ExitCode
            return $ExecutionResult_Timeout
        }
        elseif ($proc.ExitCode -ne 0)
        {
            $exitCode = $proc.ExitCode
            return $ExecutionResult_Failure
        }

        $exitCode = $proc.ExitCode
        return $ExecutionResult_Success
    }
}

function Get-WrapInShell {
    param($command, $shell)

    switch (shell) {
        'pwsh' {
            if (Test-CommandExists pwsh) {
                $pwshPath = (Get-Command pwsh).Path
                Write-Output "Using pwsh at path: $pwshPath"
                return [PSCustomObject]@{
                    Command = $pwshPath
                    Arguments = @(
                        '-NoLogo',
                        '-NoProfile',
                        '-NonInteractive',
                        '-ExecutionPolicy',
                        'Unrestricted',
                        '-Command',
                        $command
                    )
                }
            } else {
                $powershellPath = (Get-Command powershell).Path
                Write-Output "Using powershell at path: $powershellPath"
                return [PSCustomObject]@{
                    Command = $powershellPath
                    Arguments = @(
                        '-NoLogo',
                        '-Sta',
                        '-NoProfile',
                        '-NonInteractive',
                        '-ExecutionPolicy',
                        'Unrestricted',
                        '-Command',
                        $command
                    )
                }
            }
        }
        'python' {
            return [PSCustomObject]@{
                Command = 'python'
                Arguments = @('-u', '-c', $command)
            }
        }
        'node' {
            return [PSCustomObject]@{
                Command = 'node'
                Arguments = @('-e', $command) # aka --eval
            }
        }
        'cmd' {
            return [PSCustomObject]@{
                Command = 'cmd.exe'
                Arguments = @('/c', $command)
            }
        }
        'none' {
            return $null;
        }
    }
    return $null;
}

function Start-RunShellCommandWithTimeout {
    param (
        [string] $Command,
        [string] $Cwd,
        [bool] $FailOnStdErr,
        [string] $Shell,
        [int[]] $IgnoreExitCodes,
        [long] $Timeout
    )

    $CommandLines = $Command -split '\r?\n'

    if ($Shell -eq "none") {
        foreach ($Line in $CommandLines) {
            Write-GitHubActionsAnnotation "Executing command: $Line"

            $wroteToStdErr = $false
            $exitCode = 0

            # https://stackoverflow.com/a/60328737
            # Parse into command name and arguments array, via Invoke-Expression
            # and Write-Output.
            $lineCommand, $lineArguments = Invoke-Expression ("Write-Output -- $Command")

            $result = Start-RunProcessWithTimeout @{
                Cwd = $Cwd
                Shell = $Shell
                Command = $lineCommand
                Arguments = $lineArguments
                Timeout = $Timeout
                wroteToStdErr = [ref]$wroteToStdErr
                exitCode = [ref]$exitCode
            }

            if ($wroteToStdErr && $FailOnStdErr) {
                return [PSCustomObject]@{
                    outcome = $ExecutionResult_Failure
                    failCase = "Command $Line standard error output was not empty"
                }
            }

            if ($result -eq $ExecutionResult_Failure && $IgnoreExitCodes -contains $exitCode) {
                return [PSCustomObject]@{
                    outcome = $ExecutionResult_Timeout
                    failCase = "Return code was in ignore-return-codes list: $exitCode"
                }
            }

            switch ($result) {
                $ExecutionResult_Timeout {
                    return [PSCustomObject]@{
                        outcome = $result
                        failCase = "'exec' timed out"
                    }
                }
                $ExecutionResult_Failure {
                    return [PSCustomObject]@{
                        outcome = $result
                        failCase = "Command $Line returned exit code: $exitCode"
                    }
                }
            }
        }
    } else {
        Write-GitHubActionsAnnotation "Executing command: $Line"

        $wroteToStdErr = $false
        $exitCode = 0

        $wrapped = Get-WrapInShell $Command $Shell

        $result = Start-RunProcessWithTimeout @{
            Cwd = $Cwd
            IgnoreReturnCode = $IgnoreReturnCode
            Shell = $Shell
            Command = $wrapped.Command
            Arguments = $wrapped.Arguments
            Timeout = $Timeout
            wroteToStdErr = [ref]$wroteToStdErr
            exitCode = [ref]$exitCode
        }

        if ($wroteToStdErr && $FailOnStdErr) {
            return [PSCustomObject]@{
                outcome = $ExecutionResult_Failure
                failCase = "Command $Line standard error output was not empty"
            }
        }

        if ($result -eq $ExecutionResult_Failure && $IgnoreExitCodes -contains $exitCode) {
            return [PSCustomObject]@{
                outcome = $ExecutionResult_Timeout
                failCase = "Return code was in ignore-return-codes list: $exitCode"
            }
        }

        switch ($result) {
            $ExecutionResult_Timeout {
                return [PSCustomObject]@{
                    outcome = $result
                    failCase = "'exec' timed out"
                }
            }
            $ExecutionResult_Failure {
                return [PSCustomObject]@{
                    outcome = $result
                    failCase = "$Shell command '$Command' returned exit code: $exitCode"
                }
            }
        }
    }

    return [PSCustomObject]@{
        outcome = $success
        failCase = $Null
    }
}

function Get-DateTimeToUnixTimeMilliseconds {
    param (
        [DateTime] $DateTime
    )

    $dto = [DateTimeOffset]::new($DateTime::ToUniversalTime())
    return $dto::ToUnixTimeMilliseconds()::ToString();
}

function Get-DateTimeFromUnixTimeMilliseconds {
    param ($UnixTimeMilliseconds)

    return [DateTimeOffset]::FromUnixTimeMilliseconds($UnixTimeMilliseconds).DateTime
}
function Invoke-GitHubActionsLogGroup {
    param {
        [Parameter(Mandatory = $true)] [string] $Name,
        [Parameter(Mandatory = $true)] [scriptblock] $Action
    }

    Enter-GitHubActionsLogGroup $Name
    Try
    {
        . $Action
    }
    Finally
    {
        Exit-GitHubActionsLogGroup
    }
}

# commands
$Run = Get-GitHubActionsInput run -Mandatory
$BeforeRun = Get-GitHubActionsInput before-run -EmptyStringAsNull
$AfterRun = Get-GitHubActionsInput after-run -EmptyStringAsNull

# paths
$Cwd = (Get-GitHubActionsInput cwd -EmptyStringAsNull) ?? (Get-Item .).FullName
$TarballRoot = Join-Path $Cwd (Get-GitHubActionsInput tarball-root -Mandatory)
$TarballGlob = Join-Path $Cwd ((Get-GitHubActionsInput tarball-pattern -EmptyStringAsNull) ?? $TarballRoot)

# archiving
$TarballArtifactName = Get-GitHubActionsInput tarball-artifact-name
$TarballFileName = Get-GitHubActionsInput tarball-file-name
$LoadTarballArtifactIfExists = Get-GitHubActionsInputBoolean load-tarball-artifact-if-exists
$SaveTarballArtifact = Get-GitHubActionsInputBoolean "save-tarball-artifact"

# execution
$Shell = Get-GitHubActionsInput shell
$Input = Get-GitHubActionsInput input -EmptyStringAsNull
$InputEncoding = (Get-GitHubActionsInput input-encoding -EmptyStringAsNull) ?? 'utf-8'
$FailOnStdErr = Get-GitHubActionsInputBoolean fail-on-stderr
$IgnoreExitCodes = (Get-GitHubActionsInput "ignore-exit-codes") -Split ',' | ForEach-Object {
    if ([int]::TryParse($_, [ref]$ConvertedInt)) {
        return $ConvertedInt
    }
    return $Null
} | Where-Object { $_ -ne $Null }

# timeout
$TimeoutKey = Get-GitHubActionsInput key
$Timeout = Get-GitHubActionsInput timeout

Invoke-GitHubActionsLogGroup "Downloading and extracting artifact" {
    if ($LoadTarballArtifactIfExists) {
        $Ok = $False
        Try {
            Import-GitHubActionsArtifact -Name $TarballArtifactName -Destination $TarballRoot
            $Ok = $True
        } Catch {
            if ($_.Reason -ne "Unable to find any artifacts for the associated workflow" && $_.Reason -ne "Unable to find an artifact with the name: $TarballArtifactName") {
                Throw
                Write-Host $_
            }
        }

        if ($Ok) {
            Push-Location $TarballRoot
            7z x -y (Join-Path $TarballRoot $TarballFileName)
            Remove-Item -Force (Join-Path $TarballRoot $TarballFileName)
            Pop-Location
        }
    }
}

$EndTime = $Null

function Get-IsExecutionTimedOut {
    return $Null -ne $EndTime && $EndTime -ge [DateTime]::Now
}

function Get-CalcTimeout {
    return $Null -ne $EndTime ? [Math]::Max($EndTime - [DateTime]::Now, 1) : 1
}

if(($item = Get-Item "env:STAGE_END_$TimeoutKey" -ErrorAction SilentlyContinue)) {
    $EndTime = Get-DateTimeFromUnixTimeMilliseconds $item
    Write-GitHubActionsNote This build stage will time out at $EndTime
}

if ($Null -ne $BeforeRun) {
    if (Get-IsExecutionTimedOut) {
        Set-GitHubActionsOutput results-per-command '[]'
        Set-GitHubActionsOutput before-run-outcome $ExecutionResult_Timeout
        Set-GitHubActionsOutput outcome $ExecutionResult_Timeout
        Set-GitHubActionsOutput after-run-outcome ($Null -ne $AfterRun ? $ExecutionResult_Timeout : $ExecutionResult_Skipped)
        Write-GitHubActionsNotice Timed out before before-hook execution
        Return
    }

    $result = Start-RunShellCommandWithTimeout $BeforeRun -Cwd $Cwd -FailOnStdErr $FailOnStdErr -Shell $Shell -IgnoreExitCodes $IgnoreExitCodes

    Set-GitHubActionsOutput before-run-outcome $result.outcome
    if ($result.outcome -eq $ExecutionResult_Failure) {
        Set-GitHubActionsOutput outcome $ExecutionResult_Failure
        Write-GitHubActionsFail Before-run hook failed: $failCase
    }
} else {
    Set-GitHubActionsOutput before-run-outcome $ExecutionResult_Skipped
}

if ($Null -eq $EndTime) {
    $EndTime = [DateTime]::Now.AddMilliseconds($Timeout)
    Set-GitHubActionsEnvironmentVariable "STAGE_END_$TimeoutKey" (Get-DateTimeToUnixTimeMilliseconds $EndTime)
    Write-GitHubActionsNote This build stage will time out at $EndTime
}

if (Get-IsExecutionTimedOut) {
    Save-BuildArtifacts

    Set-GitHubActionsOutput results-per-command '[]'
    Set-GitHubActionsOutput outcome $ExecutionResult_Timeout
    Set-GitHubActionsOutput after-run-outcome ($Null -ne $AfterRun ? $ExecutionResult_Timeout : $ExecutionResult_Skipped)
    Write-GitHubActionsNotice Timed out before main command execution
    Return
}

{
    $result = Start-RunShellCommandWithTimeout $Run -Cwd $Cwd -FailOnStdErr $FailOnStdErr -Shell $Shell -IgnoreExitCodes $IgnoreExitCodes

    switch ($result.outcome) {
        $ExecutionResult_Failure {
            Set-GitHubActionsOutput outcome $ExecutionResult_Failure
            Set-GitHubActionsOutput after-run-outcome $ExecutionResult_Skipped
            Write-GitHubActionsFail $failCase
        }
        $ExecutionResult_Timeout {
            Set-GitHubActionsOutput outcome $ExecutionResult_Timeout
            Set-GitHubActionsOutput after-run-outcome $ExecutionResult_Skipped
            Save-BuildArtifacts
            Write-GitHubActionsNotice Execution has timed out
        }
        $ExecutionResult_Success {
            Set-GitHubActionsOutput outcome $ExecutionResult_Success

            if ($Null -ne $AfterRun) {
                $result = Start-RunShellCommandWithTimeout $AfterRun -Cwd $Cwd -FailOnStdErr $FailOnStdErr -Shell $Shell -IgnoreExitCodes $IgnoreExitCodes

                Set-GitHubActionsOutput after-run-outcome $result.outcome
                if ($result.outcome -eq $ExecutionResult_Failure) {
                    Set-GitHubActionsOutput outcome $ExecutionResult_Failure
                    Write-GitHubActionsFail After-run hook failed: $failCase
                } else {
                    Set-GitHubActionsOutput outcome $ExecutionResult_Success
                }
            } else {
                Set-GitHubActionsOutput after-run-outcome $ExecutionResult_Skipped
                Set-GitHubActionsOutput outcome $ExecutionResult_Success
            }
        }
    }
}

function Save-BuildArtifacts {
    Start-Sleep -Seconds 5

    if ($SaveTarballArtifact) {
        #console.time('glob');

        $globbed = Find-GlobFile -Path . -Include (Join-Path $TarballGlob '**')

        #console.timeEnd('glob');
        Write-Output Globbed $($globbed.Length) files

        Invoke-GitHubActionsLogGroup "Tarballing build files" {
            # Write source directories to manifest.txt to avoid command length limits
            $manifestFilename = "manifest.txt"
            $globbed | Out-File -FilePath (Join-Path $tarballRoot $manifestFilename)

            $tarFileName = Join-Path $tarballRoot $tarballFileName
            Push-Location $tarballRoot
            7z a $tarFileName -m0=zstd -mx2 "@$manifestFilename" "-x!$tarFileName" "-x!$manifestFilename"
            Pop-Location

            Remove-Item (Join-Path $tarballRoot $manifestFilename)
        }

        Invoke-GitHubActionsLogGroup "Upload artifact" {
            $maxRetries = 5
            for ($i = 0; $i -lt $maxRetries; $i++) {
                try
                {
                    Export-GitHubActionsArtifact -Name $tarballArtifactName -Path (Join-Path $TarballRoot, $TarballFileName) -RootDirectory $TarballRoot -RetentionDays 3
                    break
                }
                catch
                {
                    Start-Sleep -Seconds 3
                    Write-Error "Exporting artifact failed: $_. Attempt $($i + 1) of $maxRetries"
                }
            }
        }
    }
}
