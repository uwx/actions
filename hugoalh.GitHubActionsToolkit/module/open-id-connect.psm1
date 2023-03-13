#Requires -PSEdition Core
#Requires -Version 7.2
Import-Module -Name (
	@(
		'log',
		'nodejs-wrapper',
		'utility'
	) |
		ForEach-Object -Process { Join-Path -Path $PSScriptRoot -ChildPath "$_.psm1" }
) -Prefix 'GitHubActions' -Scope 'Local'
<#
.SYNOPSIS
GitHub Actions - Get OpenID Connect Token
.DESCRIPTION
Interact with the GitHub OpenID Connect (OIDC) provider and get a JSON Web Token (JWT) ID token which would help to get access token from third party cloud providers.
.PARAMETER Audience
Audience.
.OUTPUTS
[String] A JSON Web Token (JWT) ID token.
#>
Function Get-OpenIdConnectToken {
	[CmdletBinding(HelpUri = 'https://github.com/hugoalh-studio/ghactions-toolkit-powershell/wiki/api_function_getgithubactionsopenidconnecttoken')]
	[OutputType([String])]
	Param (
		[Parameter(Position = 0, ValueFromPipeline = $True, ValueFromPipelineByPropertyName = $True)][String]$Audience,
		[Parameter(ValueFromPipelineByPropertyName = $True)][Alias('NodeJs', 'NodeJsWrapper', 'UseNodeJs')][Switch]$UseNodeJsWrapper# Deprecated, keep as legacy.
	)
	Process {
		[Hashtable]$InputObject = @{}
		If ($Audience.Length -igt 0) {
			$InputObject.Audience = $Audience
		}
		(Invoke-GitHubActionsNodeJsWrapper -Name 'open-id-connect/get-token' -InputObject $InputObject)?.Token |
			Write-Output
	}
}
Set-Alias -Name 'Get-OidcToken' -Value 'Get-OpenIdConnectToken' -Option 'ReadOnly' -Scope 'Local'
Export-ModuleMember -Function @(
	'Get-OpenIdConnectToken'
) -Alias @(
	'Get-OidcToken'
)
