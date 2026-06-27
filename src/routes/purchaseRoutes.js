const express = require('express');
const router = express.Router();
const {
  addPurchase,
  getAllPurchases,
  getPurchase
} = require('../controllers/purchaseController');

router.route('/')
  .post(addPurchase)
  .get(getAllPurchases);

router.route('/:id')
  .get(getPurchase);

module.exports = router;