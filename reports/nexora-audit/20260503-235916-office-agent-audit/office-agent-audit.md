# Nexora Office Agent Audit

Generated: 2026-05-03T23:59:17.657Z

Office/business modules found: **45**
Useful exports found: **38**

## Existing Office Agent Routes

- none

## Missing Office Agent Routes

- GET /api/nexora/office-agents/status
- POST /api/nexora/office-agents/tick
- POST /api/nexora/office-agents/lead/intake
- POST /api/nexora/office-agents/quote/draft
- POST /api/nexora/office-agents/supplier/request
- POST /api/nexora/office-agents/followup/draft
- POST /api/nexora/office-agents/project/scope


## Recommendation

Office/business capabilities exist, but office-agent facade routes are missing or incomplete. Build adapter only.

## Useful Exports

- `createNexoraBusinessPipeline` from `server/services/intelligence/nexora/autonomy/business/nexoraBusinessPipelineEngine.ts`
- `runNexoraBulkBusinessPipeline` from `server/services/intelligence/nexora/autonomy/business/nexoraBusinessPipelineEngine.ts`
- `registerNexoraCrmWorkers` from `server/services/intelligence/nexora/autonomy/crm/nexoraCrmPipelineEngine.ts`
- `scoreNexoraLead` from `server/services/intelligence/nexora/autonomy/crm/nexoraCrmPipelineEngine.ts`
- `draftNexoraFollowup` from `server/services/intelligence/nexora/autonomy/crm/nexoraCrmPipelineEngine.ts`
- `queueNexoraCrmPipeline` from `server/services/intelligence/nexora/autonomy/crm/nexoraCrmPipelineEngine.ts`
- `getNexoraCrmStatus` from `server/services/intelligence/nexora/autonomy/crm/nexoraCrmPipelineEngine.ts`
- `analyseNexoraQuote` from `server/services/intelligence/nexora/autonomy/finance/nexoraFinanceQuoteIntelligence.ts`
- `queueNexoraQuoteAnalysis` from `server/services/intelligence/nexora/autonomy/finance/nexoraFinanceQuoteIntelligence.ts`
- `upsertNexoraLocalLead` from `server/services/intelligence/nexora/autonomy/localcrm/nexoraLocalCrm.ts`
- `getNexoraLocalLead` from `server/services/intelligence/nexora/autonomy/localcrm/nexoraLocalCrm.ts`
- `listNexoraLocalLeads` from `server/services/intelligence/nexora/autonomy/localcrm/nexoraLocalCrm.ts`
- `getNexoraLocalCrmStatus` from `server/services/intelligence/nexora/autonomy/localcrm/nexoraLocalCrm.ts`
- `createNexoraLocalProject` from `server/services/intelligence/nexora/autonomy/localprojects/nexoraLocalProjectBoard.ts`
- `updateNexoraLocalProjectStage` from `server/services/intelligence/nexora/autonomy/localprojects/nexoraLocalProjectBoard.ts`
- `listNexoraLocalProjects` from `server/services/intelligence/nexora/autonomy/localprojects/nexoraLocalProjectBoard.ts`
- `getNexoraLocalProjectStatus` from `server/services/intelligence/nexora/autonomy/localprojects/nexoraLocalProjectBoard.ts`
- `createNexoraLocalQuote` from `server/services/intelligence/nexora/autonomy/localquotes/nexoraLocalQuoteBook.ts`
- `getNexoraLocalQuote` from `server/services/intelligence/nexora/autonomy/localquotes/nexoraLocalQuoteBook.ts`
- `listNexoraLocalQuotes` from `server/services/intelligence/nexora/autonomy/localquotes/nexoraLocalQuoteBook.ts`
- `getNexoraLocalQuoteBookStatus` from `server/services/intelligence/nexora/autonomy/localquotes/nexoraLocalQuoteBook.ts`
- `upsertNexoraLocalSupplier` from `server/services/intelligence/nexora/autonomy/localsuppliers/nexoraLocalSupplierCatalogue.ts`
- `listNexoraLocalSuppliers` from `server/services/intelligence/nexora/autonomy/localsuppliers/nexoraLocalSupplierCatalogue.ts`
- `getNexoraLocalSupplierStatus` from `server/services/intelligence/nexora/autonomy/localsuppliers/nexoraLocalSupplierCatalogue.ts`
- `registerNexoraProjectWorkers` from `server/services/intelligence/nexora/autonomy/project/nexoraProjectOpsEngine.ts`
- `createNexoraProjectPlan` from `server/services/intelligence/nexora/autonomy/project/nexoraProjectOpsEngine.ts`
- `queueNexoraProjectOps` from `server/services/intelligence/nexora/autonomy/project/nexoraProjectOpsEngine.ts`
- `getNexoraProjectStatus` from `server/services/intelligence/nexora/autonomy/project/nexoraProjectOpsEngine.ts`
- `registerNexoraGovernorBusinessRoutes` from `server/services/intelligence/nexora/autonomy/routes/nexoraGovernorBusinessRoutes.ts`
- `registerNexoraLocalBusinessRoutes` from `server/services/intelligence/nexora/autonomy/routes/nexoraLocalBusinessRoutes.ts`
- `registerNexoraSupplierWorkers` from `server/services/intelligence/nexora/autonomy/supplier/nexoraSupplierCommand.ts`
- `buildNexoraSupplierMatrix` from `server/services/intelligence/nexora/autonomy/supplier/nexoraSupplierCommand.ts`
- `draftNexoraSupplierRfq` from `server/services/intelligence/nexora/autonomy/supplier/nexoraSupplierCommand.ts`
- `queueNexoraSupplierSweep` from `server/services/intelligence/nexora/autonomy/supplier/nexoraSupplierCommand.ts`
- `getNexoraSupplierStatus` from `server/services/intelligence/nexora/autonomy/supplier/nexoraSupplierCommand.ts`
- `scoreNexoraBusinessAction` from `server/services/intelligence/nexora/nexoraBusinessMandate.ts`
- `approveFollowUpAction` from `server/services/intelligence/nexora/nexoraExecutionGate.ts`
- `approveProcurementAction` from `server/services/intelligence/nexora/nexoraExecutionGate.ts`