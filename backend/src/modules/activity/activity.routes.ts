import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { validate } from "../../lib/validation.js";
import { requireRole } from "../../middleware/require-role.js";
import { activityListSchema } from "./activity.schemas.js";
import { listActivity } from "./activity.service.js";

const router = Router();

router.use(requireRole("admin"));
router.get("/", validate("query", activityListSchema), asyncHandler(async (request, response) => {
  response.json(await listActivity(request.validatedQuery as never));
}));

export { router as activityRouter };
