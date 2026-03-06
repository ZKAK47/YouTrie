export const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err);
  
    const status = err.status || 500;
    const response = {
      error: err.message || 'Erreur interne',
      ...(err.redirect && { redirect: err.redirect })
    };
  
    if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack;
    }
  
    res.status(status).json(response);
};