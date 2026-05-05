# Nexora Company Completion Audit

Generated: 2026-05-04T00:26:05.528Z

Related modules found: **73**

## Existing Completion Routes

- none

## Missing Completion Routes

- GET /api/nexora/company-completion/status
- GET /api/nexora/company-completion/owner-cockpit
- GET /api/nexora/company-completion/daily-briefing
- GET /api/nexora/company-completion/approval-board
- GET /api/nexora/company-completion/departments
- GET /api/nexora/company-completion/responsibility-map
- POST /api/nexora/company-completion/daily-run
- GET /api/nexora/company-completion/work-queue
- GET /api/nexora/company-completion/revenue-margin-board
- GET /api/nexora/company-completion/customer-supplier-board
- GET /api/nexora/company-completion/project-delivery-board
- GET /api/nexora/company-completion/learning-board

## Recommendation

Build a final company-completion adapter layer over existing modules.

## Related Modules

- `server/services/intelligence/nexora/autonomy/academy/nexoraAcademyEngine.ts` exports 4, routes 0
- `server/services/intelligence/nexora/autonomy/almighty/nexoraAlmightyCommander.ts` exports 2, routes 0
- `server/services/intelligence/nexora/autonomy/autopilot/nexoraOperationalAutopilot.ts` exports 7, routes 0
- `server/services/intelligence/nexora/autonomy/brainpack/nexoraBrainPack.ts` exports 1, routes 0
- `server/services/intelligence/nexora/autonomy/buildplanner/nexoraBuildInventory.ts` exports 1, routes 0
- `server/services/intelligence/nexora/autonomy/buildplanner/nexoraFutureBuildRoadmap.ts` exports 1, routes 0
- `server/services/intelligence/nexora/autonomy/business/nexoraBusinessPipelineEngine.ts` exports 2, routes 0
- `server/services/intelligence/nexora/autonomy/cockpit/nexoraExecutiveCockpit.ts` exports 4, routes 0
- `server/services/intelligence/nexora/autonomy/companyrun/nexoraCompanyRunEngine.ts` exports 10, routes 0
- `server/services/intelligence/nexora/autonomy/crm/nexoraCrmPipelineEngine.ts` exports 5, routes 0
- `server/services/intelligence/nexora/autonomy/exporter/nexoraExportPack.ts` exports 3, routes 0
- `server/services/intelligence/nexora/autonomy/filebus/nexoraFileBus.ts` exports 6, routes 0
- `server/services/intelligence/nexora/autonomy/finance/nexoraFinanceQuoteIntelligence.ts` exports 5, routes 0
- `server/services/intelligence/nexora/autonomy/goalcompiler/nexoraGoalCompiler.ts` exports 3, routes 0
- `server/services/intelligence/nexora/autonomy/governor/nexoraAutonomyGovernor.ts` exports 5, routes 0
- `server/services/intelligence/nexora/autonomy/humanboundary/nexoraHumanBoundaryDoctrine.ts` exports 9, routes 0
- `server/services/intelligence/nexora/autonomy/humancompany/nexoraHumanContactCompanyEngine.ts` exports 15, routes 0
- `server/services/intelligence/nexora/autonomy/humanops/nexoraHumanLoopBusinessOps.ts` exports 12, routes 0
- `server/services/intelligence/nexora/autonomy/localapprovals/nexoraLocalApprovalGate.ts` exports 4, routes 0
- `server/services/intelligence/nexora/autonomy/localcore/nexoraLocalCore.ts` exports 8, routes 0
- `server/services/intelligence/nexora/autonomy/localcrm/nexoraLocalCrm.ts` exports 4, routes 0
- `server/services/intelligence/nexora/autonomy/localprojects/nexoraLocalProjectBoard.ts` exports 4, routes 0
- `server/services/intelligence/nexora/autonomy/localquotes/nexoraLocalQuoteBook.ts` exports 4, routes 0
- `server/services/intelligence/nexora/autonomy/localsuppliers/nexoraLocalSupplierCatalogue.ts` exports 3, routes 0
- `server/services/intelligence/nexora/autonomy/maintenance/nexoraMaintenancePlanner.ts` exports 2, routes 0
- `server/services/intelligence/nexora/autonomy/migration/nexoraMigrationPlanner.ts` exports 4, routes 0
- `server/services/intelligence/nexora/autonomy/migrationpack/nexoraMigrationPackBuilder.ts` exports 2, routes 0
- `server/services/intelligence/nexora/autonomy/mission/nexoraMissionControl.ts` exports 6, routes 0
- `server/services/intelligence/nexora/autonomy/nexoraAutonomyExecutor.ts` exports 4, routes 0
- `server/services/intelligence/nexora/autonomy/nexoraAutonomyFoundation.ts` exports 9, routes 0
- `server/services/intelligence/nexora/autonomy/nexoraAutonomyOperatingPlan.ts` exports 1, routes 0
- `server/services/intelligence/nexora/autonomy/nexoraAutonomyRunner.ts` exports 3, routes 0
- `server/services/intelligence/nexora/autonomy/nexoraAutonomySupervisor.ts` exports 3, routes 0
- `server/services/intelligence/nexora/autonomy/nexoraCommandCentre.ts` exports 1, routes 0
- `server/services/intelligence/nexora/autonomy/nexoraSchedulerControl.ts` exports 4, routes 0
- `server/services/intelligence/nexora/autonomy/nexoraWorkerFactory.ts` exports 2, routes 0
- `server/services/intelligence/nexora/autonomy/officeagents/nexoraOfficeFurnitureAgents.ts` exports 8, routes 0
- `server/services/intelligence/nexora/autonomy/packagekit/nexoraPackageManifest.ts` exports 1, routes 0
- `server/services/intelligence/nexora/autonomy/persistence/nexoraDurableKernel.ts` exports 12, routes 0
- `server/services/intelligence/nexora/autonomy/playbooks/nexoraPlaybookRunner.ts` exports 4, routes 0
- `server/services/intelligence/nexora/autonomy/policy/nexoraPolicyPack.ts` exports 2, routes 0
- `server/services/intelligence/nexora/autonomy/project/nexoraProjectOpsEngine.ts` exports 4, routes 0
- `server/services/intelligence/nexora/autonomy/readiness/nexoraV1Readiness.ts` exports 1, routes 0
- `server/services/intelligence/nexora/autonomy/resilience/nexoraResilienceCore.ts` exports 7, routes 0
- `server/services/intelligence/nexora/autonomy/rewards/nexoraRewardEngine.ts` exports 7, routes 0
- `server/services/intelligence/nexora/autonomy/risksim/nexoraRiskSimulator.ts` exports 3, routes 0
- `server/services/intelligence/nexora/autonomy/routegovernance/nexoraRouteGovernance.ts` exports 3, routes 0
- `server/services/intelligence/nexora/autonomy/routes/nexoraAdvancedAutonomyRoutes.ts` exports 1, routes 11
- `server/services/intelligence/nexora/autonomy/routes/nexoraHardMountRoutes.ts` exports 1, routes 9
- `server/services/intelligence/nexora/autonomy/routes/nexoraHumanBoundaryDoctrineRoutes.ts` exports 1, routes 9
- `server/services/intelligence/nexora/autonomy/routes/nexoraHumanContactCompanyRoutes.ts` exports 1, routes 15
- `server/services/intelligence/nexora/autonomy/routes/nexoraHumanLoopBusinessOpsRoutes.ts` exports 1, routes 12
- `server/services/intelligence/nexora/autonomy/routes/nexoraLiveVerificationRoutes.ts` exports 1, routes 12
- `server/services/intelligence/nexora/autonomy/routes/nexoraLocalBusinessRoutes.ts` exports 1, routes 21
- `server/services/intelligence/nexora/autonomy/routes/nexoraMegaBuildRoutes.ts` exports 1, routes 18
- `server/services/intelligence/nexora/autonomy/routes/nexoraOfficeAgentAdapterRoutes.ts` exports 1, routes 7
- `server/services/intelligence/nexora/autonomy/routes/nexoraOfficeFurnitureAgentRoutes.ts` exports 1, routes 8
- `server/services/intelligence/nexora/autonomy/rules/nexoraDecisionRuleEngine.ts` exports 3, routes 0
- `server/services/intelligence/nexora/autonomy/seedpacks/nexoraSeedPacks.ts` exports 3, routes 0
- `server/services/intelligence/nexora/autonomy/simulation/nexoraWorkflowSimulator.ts` exports 2, routes 0
- `server/services/intelligence/nexora/autonomy/strategy/nexoraStrategyCompiler.ts` exports 8, routes 0
- `server/services/intelligence/nexora/autonomy/supplier/nexoraSupplierCommand.ts` exports 5, routes 0
- `server/services/intelligence/nexora/autonomy/supreme/nexoraSupremeOrchestrationMatrix.ts` exports 10, routes 0
- `server/services/intelligence/nexora/autonomy/teaching/nexoraTeachingEngine.ts` exports 13, routes 0
- `server/services/intelligence/nexora/autonomy/v1/nexoraV1ReleaseControls.ts` exports 2, routes 0
- `server/services/intelligence/nexora/autonomy/v1hardening/nexoraAICompanyV1Hardening.ts` exports 9, routes 0
- `server/services/intelligence/nexora/nexora-support.ts` exports 42, routes 0
- `server/services/intelligence/nexora/nexora-types.ts` exports 0, routes 0
- `server/services/intelligence/nexora/nexoraActionRouter.ts` exports 3, routes 0
- `server/services/intelligence/nexora/nexoraBusinessMandate.ts` exports 1, routes 0
- `server/services/intelligence/nexora/nexoraExecutionGate.ts` exports 9, routes 0
- `server/services/intelligence/nexora/nexoraModuleRegistry.ts` exports 6, routes 0
- `server/services/intelligence/nexora/nexoraWorkerRegistry.ts` exports 2, routes 0