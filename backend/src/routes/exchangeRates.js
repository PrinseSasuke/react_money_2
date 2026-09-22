const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getLatestRates } = require("../services/exchangeRates");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const rates = await getLatestRates();
    res.json(rates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка получения курсов валют" });
  }
});

module.exports = router;
