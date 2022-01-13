@{
	# Script module or binary module file associated with this manifest.
	RootModule = 'hugoalh.GitHubActionsToolkit.psm1'

	# Version number of this module.
	ModuleVersion = '0.3.0'

	# Supported PSEditions
	# CompatiblePSEditions = @()

	# ID used to uniquely identify this module
	GUID = 'df24369f-3475-47f7-9eb3-e024afc48440'

	# Author of this module
	Author = 'hugoalh'

	# Company or vendor of this module
	CompanyName = 'hugoalh Studio'

	# Copyright statement for this module
	Copyright = 'MIT © 2021~2022 hugoalh Studio'

	# Description of the functionality provided by this module
	Description = 'Provide a better and easier way for GitHub Actions to communicate with the runner machine.'

	# Minimum version of the PowerShell engine required by this module
	PowerShellVersion = '7.2'

	# Name of the PowerShell host required by this module
	# PowerShellHostName = ''

	# Minimum version of the PowerShell host required by this module
	# PowerShellHostVersion = ''

	# Minimum version of Microsoft .NET Framework required by this module. This prerequisite is valid for the PowerShell Desktop edition only.
	# DotNetFrameworkVersion = ''

	# Minimum version of the common language runtime (CLR) required by this module. This prerequisite is valid for the PowerShell Desktop edition only.
	# ClrVersion = ''

	# Processor architecture (None, X86, Amd64) required by this module
	# ProcessorArchitecture = ''

	# Modules that must be imported into the global environment prior to importing this module
	# RequiredModules = @()

	# Assemblies that must be loaded prior to importing this module
	# RequiredAssemblies = @()

	# Script files (.ps1) that are run in the caller's environment prior to importing this module.
	# ScriptsToProcess = @()

	# Type files (.ps1xml) to be loaded when importing this module
	# TypesToProcess = @()

	# Format files (.ps1xml) to be loaded when importing this module
	# FormatsToProcess = @()

	# Modules to import as nested modules of the module specified in RootModule/ModuleToProcess
	# NestedModules = @()

	# Functions to export from this module, for best performance, do not use wildcards and do not delete the entry, use an empty array if there are no functions to export.
	FunctionsToExport = @(
		'Add-GHActionsEnvironmentVariable',
		'Add-GHActionsPATH',
		'Add-GHActionsProblemMatcher',
		'Add-GHActionsSecretMask',
		'Disable-GHActionsEchoCommand',
		'Disable-GHActionsProcessingCommand',
		'Enable-GHActionsEchoCommand',
		'Enable-GHActionsProcessingCommand',
		'Enter-GHActionsLogGroup',
		'Exit-GHActionsLogGroup',
		'Get-GHActionsInput',
		'Get-GHActionsIsDebug',
		'Get-GHActionsState',
		'Get-GHActionsWebhookEventPayload',
		'Remove-GHActionsProblemMatcher',
		'Set-GHActionsOutput',
		'Set-GHActionsState',
		'Write-GHActionsAnnotation',
		'Write-GHActionsDebug',
		'Write-GHActionsError',
		'Write-GHActionsFail',
		'Write-GHActionsNotice',
		'Write-GHActionsWarning'
	)

	# Cmdlets to export from this module, for best performance, do not use wildcards and do not delete the entry, use an empty array if there are no cmdlets to export.
	CmdletsToExport = @()

	# Variables to export from this module
	VariablesToExport = '*'

	# Aliases to export from this module, for best performance, do not use wildcards and do not delete the entry, use an empty array if there are no aliases to export.
	AliasesToExport = @(
		'Add-GHActionsEnv',
		'Add-GHActionsMask',
		'Add-GHActionsSecret',
		'Disable-GHActionsCommandEcho',
		'Disable-GHActionsCommandProcessing',
		'Enable-GHActionsCommandEcho',
		'Enable-GHActionsCommandProcessing',
		'Enter-GHActionsGroup',
		'Exit-GHActionsGroup',
		'Get-GHActionsEvent',
		'Get-GHActionsPayload',
		'Restore-GHActionsState',
		'Save-GHActionsState',
		'Write-GHActionsNote',
		'Write-GHActionsWarn'
	)

	# DSC resources to export from this module
	# DscResourcesToExport = @()

	# List of all modules packaged with this module
	# ModuleList = @()

	# List of all files packaged with this module
	# FileList = @()

	# Private data to pass to the module specified in RootModule/ModuleToProcess. This may also contain a PSData hashtable with additional module metadata used by PowerShell.
	PrivateData = @{
		PSData = @{
			# Tags applied to this module. These help with module discovery in online galleries.
			Tags = @(
				'action',
				'actions',
				'github',
				'github-action',
				'github-actions',
				'PSEdition_Core',
				'toolkit'
			)

			# A URL to the license for this module.
			LicenseUri = 'https://github.com/hugoalh-studio/ghactions-toolkit-powershell/blob/main/LICENSE.md'

			# A URL to the main website for this project.
			ProjectUri = 'https://github.com/hugoalh-studio/ghactions-toolkit-powershell'

			# A URL to an icon representing this module.
			IconUri = 'https://i.imgur.com/knmLbFg.png'

			# ReleaseNotes of this module
			ReleaseNotes = '(Please visit https://github.com/hugoalh-studio/ghactions-toolkit-powershell/releases.)'

			# Prerelease string of this module
			# Prerelease = ''

			# Flag to indicate whether the module requires explicit user acceptance for install/update/save
			RequireLicenseAcceptance = $false

			# External dependent modules of this module
			# ExternalModuleDependencies = @()
		}
	}

	# HelpInfo URI of this module
	# HelpInfoURI = ''

	# Default prefix for commands exported from this module. Override the default prefix using Import-Module -Prefix.
	# DefaultCommandPrefix = ''
}
