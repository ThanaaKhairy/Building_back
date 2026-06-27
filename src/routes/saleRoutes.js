const express = require('express');
const router = express.Router();
const {
  addSale,
  getAllSales,
  getSale,
  getDailyProfit,
  getMonthlyProfit
} = require('../controllers/saleController');

router.route('/')
  .post(addSale)
  .get(getAllSales);

router.route('/:id')
  .get(getSale);

router.get('/daily-profit', getDailyProfit);
router.get('/monthly-profit', getMonthlyProfit);

module.exports = router;