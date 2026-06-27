const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.stack);

  let error = { ...err };
  error.message = err.message;

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    const message = `${field} موجود بالفعل`;
    return res.status(400).json({
      success: false,
      message,
      field
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'خطأ في التحقق من البيانات',
      errors
    });
  }

  // Cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'معرف غير صحيح'
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: error.message || 'حدث خطأ في السيرفر',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;