import { config } from "../config/constants.js";

export const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err);
  
    const status = err.status || 500;
    const response = {
      error: err.message || 'Erreur interne',
      ...(err.redirect && { redirect: err.redirect })
    };
  
    if (config.NODE_ENV === 'development') {
      response.stack = err.stack; // Put the detailed error in response
    }
  
    res.status(status).json(response);
};