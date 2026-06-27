const express = require('express');
const router = express.Router();
const {
  addProduct,
  getAllProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  addStock
} = require('../controllers/productController');

// Routes
router.route('/')
  .post(addProduct)
  .get(getAllProducts);

router.route('/:id')
  .get(getProduct)
  .put(updateProduct)
  .delete(deleteProduct);

router.post('/:id/add-stock', addStock);

module.exports = router;