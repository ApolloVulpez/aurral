import { validateExternalUrl } from "../../middleware/urlValidator.js";
import { NavidromeClient } from "../../services/navidrome.js";

export async function testNavidromeConnection(req, res) {
  try {
    const url = String(req.body?.url || "").trim().replace(/\/+$/, "");
    const username = String(req.body?.username || "").trim();
    const password = req.body?.password ?? "";
    if (!url || !username || !password) {
      return res.status(400).json({ error: "URL, username, and password are required" });
    }
    const validation = validateExternalUrl(url);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    await new NavidromeClient(validation.url, username, password).ping();
    return res.json({ success: true, message: "Connection successful" });
  } catch (error) {
    return res.status(400).json({
      error: "Connection failed",
      message: error.message,
    });
  }
}
