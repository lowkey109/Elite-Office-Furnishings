import {
  createNexoraProductBundle,
  exportNexoraProductCatalogue,
  getNexoraProduct,
  getNexoraProductCatalogueStatus,
  importNexoraProductsFromJson,
  listNexoraProducts,
  listNexoraSupplierCosts,
  seedNexoraDefaultProductCatalogue,
  upsertNexoraProduct,
  upsertNexoraSupplierCost,
} from "../productcatalogue/nexoraProductCatalogueEngine";
import {
  createNexoraCustomerQuoteDraft,
  createNexoraQuotePack,
  getNexoraQuotePackStatus,
  listNexoraQuotePackApprovals,
  listNexoraQuotePacks,
} from "../quotepack/nexoraQuotePackGenerator";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraProductCatalogueQuoteRoutes(app: any) {
  app.get("/api/nexora/product-catalogue/status", (_req: any, res: any) => {
    try { res.json(getNexoraProductCatalogueStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/product-catalogue/seed", (_req: any, res: any) => {
    try { res.json(seedNexoraDefaultProductCatalogue()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/product-catalogue/product/upsert", (req: any, res: any) => {
    try { res.json(upsertNexoraProduct(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/product-catalogue/product", (req: any, res: any) => {
    try { res.json(getNexoraProduct({ sku: req.query?.sku || "" })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/product-catalogue/products", (req: any, res: any) => {
    try { res.json(listNexoraProducts({ category: req.query?.category || "", status: req.query?.status || "", q: req.query?.q || "", limit: Number(req.query?.limit || 200) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/product-catalogue/supplier-cost/upsert", (req: any, res: any) => {
    try { res.json(upsertNexoraSupplierCost(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/product-catalogue/supplier-costs", (req: any, res: any) => {
    try { res.json(listNexoraSupplierCosts({ sku: req.query?.sku || "", supplierId: req.query?.supplierId || "", limit: Number(req.query?.limit || 200) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/product-catalogue/bundle/create", (req: any, res: any) => {
    try { res.json(createNexoraProductBundle(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/product-catalogue/import/json", (req: any, res: any) => {
    try { res.json(importNexoraProductsFromJson(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/product-catalogue/export", (_req: any, res: any) => {
    try { res.json(exportNexoraProductCatalogue()); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/quote-pack/status", (_req: any, res: any) => {
    try { res.json(getNexoraQuotePackStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/quote-pack/create", (req: any, res: any) => {
    try { res.json(createNexoraQuotePack(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/quote-pack/customer-draft", (req: any, res: any) => {
    try { res.json(createNexoraCustomerQuoteDraft(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/quote-pack/list", (req: any, res: any) => {
    try { res.json(listNexoraQuotePacks({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/quote-pack/approvals", (req: any, res: any) => {
    try { res.json(listNexoraQuotePackApprovals({ limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });
}
