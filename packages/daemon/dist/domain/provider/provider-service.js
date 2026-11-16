// Slice-04 (OPR.0.5.0.4) — the ProviderService seam. The routes (seam B) are thin over this
// interface; the real implementation (collection from rig auth + seat registry + the three lanes,
// switch composition + action recording) is seams C/D. Keeping this an interface lets the routes
// register and honestly 503 until the production service is wired.
export {};
//# sourceMappingURL=provider-service.js.map