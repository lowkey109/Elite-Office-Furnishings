import {
  detectNexoraDuplicateSkus,
  exportNexoraInternalMarginCsv,
  exportNexoraQuotePackMarkdown,
  exportNexoraSupplierRfqMarkdown,
  getNexoraProductImportExportStatus,
  importNexoraProductsFromCsv,
  importNexoraSupplierCostsFromJson,
  validateNexoraProductCatalogue,
} from "../productimportexport/nexoraProductImportExportEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraProductImportExportRoutes(app: any) {
  app.get("/api/nexora/product-import-export/status", (_req: any, res: any) => {
    try { res.json(getNexoraProductImportExportStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/product-import-export/products/csv", (req: any, res: any) => {
    try { res.json(importNexoraProductsFromCsv(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/product-import-export/supplier-costs/json", (req: any, res: any) => {
    try { res.json(importNexoraSupplierCostsFromJson(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/product-import-export/validate", (req: any, res: any) => {
    try { res.json(validateNexoraProductCatalogue(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/product-import-export/duplicates", (_req: any, res: any) => {
    try { res.json(detectNexoraDuplicateSkus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/product-import-export/quote/markdown", (req: any, res: any) => {
    try { res.json(exportNexoraQuotePackMarkdown(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/product-import-export/margin/csv", (req: any, res: any) => {
    try { res.json(exportNexoraInternalMarginCsv(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/product-import-export/supplier-rfq/markdown", (req: any, res: any) => {
    try { res.json(exportNexoraSupplierRfqMarkdown(req.body || {})); } catch (error) { sendError(res, error); }
  });
}
