// config/properties.js
const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  UPLOADS_PATH: isProduction
    ? "/home/global/public_html/uploads/agents/"
    : "./public/uploads/agents/",
  PROPERTY_UPLOADS_PATH: isProduction
    ? "/home/global/public_html/uploads/properties/"
    : "./public/uploads/properties/",
  UPLOADS_URL_PATH: "/uploads/agents/",
  PROPERTY_UPLOADS_URL_PATH: "/uploads/properties/",
};
