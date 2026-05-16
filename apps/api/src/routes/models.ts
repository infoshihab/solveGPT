import { Router } from "express";
import { MODEL_CATALOG, PROVIDERS } from "@solvegpt/model-catalog";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/** Catalog of providers and chat models (IDs match vendor APIs). */
router.get("/", requireAuth, (_req, res) => {
  res.json({
    providers: PROVIDERS,
    models: MODEL_CATALOG,
  });
});

export const modelsRouter = router;
