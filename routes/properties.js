const express = require("express");
const router = express.Router();
const { query } = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  PROPERTY_UPLOADS_PATH,
  PROPERTY_UPLOADS_URL_PATH,
} = require("../config/properties");

// Ensure uploads directory exists
const ensureUploadDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Ensure the uploads directory exists
ensureUploadDirExists(PROPERTY_UPLOADS_PATH);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, PROPERTY_UPLOADS_PATH);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "property-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit for high quality images
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
});

// Helper function to format image URLs
const formatImageUrls = (images, baseUrl) => {
  if (!images) return [];

  let imageArray = [];

  // Parse images if it's a string
  if (typeof images === "string") {
    try {
      imageArray = JSON.parse(images);
    } catch (e) {
      console.error("Error parsing JSON for property images:", e);
      return [];
    }
  } else if (Array.isArray(images)) {
    imageArray = images;
  } else {
    return [];
  }

  // Format URLs - check if already has base URL to avoid duplication
  return imageArray
    .map((imagePath) => {
      if (!imagePath) return null;

      // If the path already contains the base URL, return as is
      if (imagePath.startsWith("http")) {
        return imagePath;
      }

      // If the path doesn't start with /, add it
      const formattedPath = imagePath.startsWith("/")
        ? imagePath
        : `/${imagePath}`;
      return `${baseUrl}${formattedPath}`;
    })
    .filter(Boolean); // Remove null values
};

router.post("/featured", async (req, res) => {
  try {
    const sqlQuery = `
      SELECT *
      FROM properties
      WHERE is_featured = 1
      ORDER BY created_at DESC
      LIMIT 8
    `;

    const featuredProperties = await query(sqlQuery);

    // Get the base URL from the request
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // Process each property
    const formattedProperties = featuredProperties.map((property) => {
      property.images = formatImageUrls(property.images, baseUrl);
      return property;
    });

    // Send JSON response
    res.status(200).json({
      count: formattedProperties.length,
      featuredProperties: formattedProperties,
    });
  } catch (error) {
    console.error("API Error [POST /properties/featured]:", error);
    res.status(500).json({
      message: "Error fetching featured properties. Please try again later.",
      error: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const propertyId = req.params.id;
    const sqlQuery = `
      SELECT *
      FROM properties
      WHERE id = ?
    `;
    const [property] = await query(sqlQuery, [propertyId]);

    if (!property) {
      return res.status(404).json({
        message: "Property not found",
      });
    }

    // Get the base URL from the request
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // Format images
    property.images = formatImageUrls(property.images, baseUrl);

    // Send JSON response
    res.status(200).json(property);
  } catch (error) {
    console.error("API Error [GET /properties/:id]:", error);
    res.status(500).json({
      message: "Error fetching property. Please try again later.",
      error: error.message,
    });
  }
});

// GET all properties endpoint
router.get("/", async (req, res) => {
  try {
    const sqlQuery = `
      SELECT *
      FROM properties
      ORDER BY created_at DESC;
    `;
    const properties = await query(sqlQuery);

    // Get the base URL from the request
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // Process each property
    const formattedProperties = properties.map((property) => {
      property.images = formatImageUrls(property.images, baseUrl);
      return property;
    });

    // Send JSON response
    res.status(200).json(formattedProperties);
  } catch (error) {
    console.error("API Error [GET /properties]:", error);
    res.status(500).json({
      message: "Error fetching properties. Please try again later.",
    });
  }
});

router.post("/", upload.array("images", 10), async (req, res) => {
  try {
    // Extract data from request body
    const {
      title,
      description,
      category,
      sub_category,
      status,
      price,
      size,
      location,
      bedroom,
      bathroom,
      view,
      parking,
      agentId,
      is_featured,
      amenities,
    } = req.body;

    // Convert values to match database schema types
    const bathroomValue = parseInt(bathroom) || 0;
    const featuredValue =
      is_featured === "true" || is_featured === true ? 1 : 0;

    // Get uploaded file paths - store relative paths without base URL
    const imageFiles = req.files || [];
    const imagePaths = imageFiles.map(
      (file) => `${PROPERTY_UPLOADS_URL_PATH}${file.filename}`
    );

    // Log for debugging
    console.log("Image files uploaded:", imageFiles.length);
    console.log("Image paths:", imagePaths);

    // Create current timestamp for created_at and updated_at
    const currentDateTime = new Date()
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    // Insert property data into database
    const insertQuery = `
      INSERT INTO properties (
        title, 
        description, 
        category, 
        sub_category, 
        price, 
        location, 
        view, 
        parking,
        status, 
        size, 
        bedroom, 
        bathroom, 
        agent_id, 
        is_featured,
        images,
        amenities,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(insertQuery, [
      title,
      description,
      category,
      sub_category,
      price,
      location,
      view,
      parking,
      status,
      size,
      bedroom || "",
      bathroomValue,
      agentId || null,
      featuredValue,
      JSON.stringify(imagePaths), // Store relative paths
      amenities,
      currentDateTime,
      currentDateTime,
    ]);

    // Get the base URL for response
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const formattedImagePaths = formatImageUrls(imagePaths, baseUrl);

    res.status(201).json({
      message: "Property added successfully",
      propertyId: result.insertId,
      property: {
        id: result.insertId,
        title,
        description,
        category,
        sub_category,
        price,
        location,
        view,
        parking,
        status,
        size,
        bedroom: bedroom || "",
        bathroom: bathroomValue,
        agent_id: agentId || null,
        is_featured: featuredValue,
        images: formattedImagePaths, // Return formatted URLs
        amenities,
        created_at: currentDateTime,
        updated_at: currentDateTime,
      },
    });
  } catch (error) {
    console.error("API Error [POST /properties]:", error);

    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).json({
        message:
          "Image file size exceeds the 20MB limit. Please upload a smaller file.",
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Error adding property. Please try again later.",
      error: error.message,
    });
  }
});

router.put("/:id", upload.array("images", 10), async (req, res) => {
  try {
    const propertyId = req.params.id;

    // Extract data from request body
    const {
      title,
      description,
      category,
      sub_category,
      status,
      price,
      size,
      location,
      bedroom,
      bathroom,
      view,
      parking,
      agentId,
      is_featured,
      existingImages,
      amenities,
    } = req.body;

    // Convert values to match database schema types
    const bathroomValue = parseInt(bathroom) || 0;
    const featuredValue =
      is_featured === "true" || is_featured === true ? 1 : 0;

    // First, get the current property data to identify images to delete
    const getCurrentPropertyQuery = `SELECT * FROM properties WHERE id = ?`;
    const [currentProperty] = await query(getCurrentPropertyQuery, [
      propertyId,
    ]);

    if (!currentProperty) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Get current images (stored as relative paths)
    let currentImagePaths = [];
    if (currentProperty.images) {
      try {
        currentImagePaths =
          typeof currentProperty.images === "string"
            ? JSON.parse(currentProperty.images)
            : currentProperty.images;
      } catch (e) {
        console.error("Error parsing current images:", e);
        currentImagePaths = [];
      }
    }

    // Parse existing images from JSON string (these are the ones user wants to keep)
    // These might come as full URLs, so we need to extract relative paths
    let imagePaths = [];
    if (existingImages) {
      try {
        const existingImagesArray =
          typeof existingImages === "string"
            ? JSON.parse(existingImages)
            : existingImages;

        // Convert full URLs back to relative paths for comparison and storage
        imagePaths = existingImagesArray.map((imagePath) => {
          if (typeof imagePath === "string" && imagePath.includes("://")) {
            // Extract relative path from full URL
            const url = new URL(imagePath);
            return url.pathname;
          }
          return imagePath;
        });
      } catch (e) {
        console.error("Error parsing existing images:", e);
        imagePaths = [];
      }
    }

    // Identify images to delete (images in currentImagePaths but not in imagePaths)
    const imagesToDelete = currentImagePaths.filter(
      (currentPath) => !imagePaths.includes(currentPath)
    );

    // Delete the images that are no longer needed
    if (imagesToDelete.length > 0) {
      imagesToDelete.forEach((imagePath) => {
        try {
          const filename = imagePath.split("/").pop();
          const filePath = path.join(PROPERTY_UPLOADS_PATH, filename);

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted image: ${filePath}`);
          }
        } catch (e) {
          console.error(`Error deleting image: ${imagePath}`, e);
        }
      });
    }

    // Add new image uploads (store as relative paths)
    const imageFiles = req.files || [];
    const newImagePaths = imageFiles.map(
      (file) => `${PROPERTY_UPLOADS_URL_PATH}${file.filename}`
    );

    // Combine existing and new images (all as relative paths)
    imagePaths = [...imagePaths, ...newImagePaths];

    console.log("Final image paths to store:", imagePaths);

    // Create current timestamp for updated_at
    const currentDateTime = new Date()
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    // Update property data in database
    const updateQuery = `
      UPDATE properties 
      SET 
        title = ?, 
        description = ?, 
        category = ?, 
        sub_category = ?, 
        price = ?, 
        location = ?, 
        view = ?, 
        parking = ?,
        status = ?, 
        size = ?, 
        bedroom = ?, 
        bathroom = ?, 
        agent_id = ?, 
        is_featured = ?,
        images = ?,
        amenities = ?,
        updated_at = ?
      WHERE id = ?
    `;

    await query(updateQuery, [
      title,
      description,
      category,
      sub_category,
      price,
      location,
      view,
      parking,
      status,
      size,
      bedroom || "",
      bathroomValue,
      agentId || null,
      featuredValue,
      JSON.stringify(imagePaths), // Store relative paths
      amenities,
      currentDateTime,
      propertyId,
    ]);

    // Get updated property
    const getUpdatedProperty = `SELECT * FROM properties WHERE id = ?`;
    const [updatedProperty] = await query(getUpdatedProperty, [propertyId]);

    // Format the response by adding base URL to image paths
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    updatedProperty.images = formatImageUrls(updatedProperty.images, baseUrl);

    res.status(200).json({
      message: "Property updated successfully",
      property: updatedProperty,
    });
  } catch (error) {
    console.error("API Error [PUT /properties/:id]:", error);

    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).json({
        message:
          "Image file size exceeds the 20MB limit. Please upload a smaller file.",
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Error updating property. Please try again later.",
      error: error.message,
    });
  }
});

// DELETE property endpoint
router.delete("/:id", async (req, res) => {
  try {
    const propertyId = req.params.id;

    // First get the property to check if it exists and to get image files
    const getPropertyQuery = `SELECT * FROM properties WHERE id = ?`;
    const [property] = await query(getPropertyQuery, [propertyId]);

    if (!property) {
      return res.status(404).json({
        message: "Property not found",
      });
    }

    // Delete the property from database
    const deleteQuery = `DELETE FROM properties WHERE id = ?`;
    await query(deleteQuery, [propertyId]);

    // Delete associated image files
    if (property.images) {
      let imagePaths = [];
      try {
        imagePaths =
          typeof property.images === "string"
            ? JSON.parse(property.images)
            : property.images;

        // For each image path, extract the filename and delete the file
        imagePaths.forEach((imagePath) => {
          try {
            const filename = imagePath.split("/").pop();
            const filePath = path.join(PROPERTY_UPLOADS_PATH, filename);

            // Check if file exists before trying to delete
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`Deleted image: ${filePath}`);
            }
          } catch (e) {
            console.error(`Error deleting individual image: ${imagePath}`, e);
          }
        });
      } catch (e) {
        console.error("Error processing property images for deletion:", e);
      }
    }

    res.status(200).json({
      message: "Property deleted successfully",
      id: propertyId,
    });
  } catch (error) {
    console.error("API Error [DELETE /properties/:id]:", error);
    res.status(500).json({
      message: "Error deleting property. Please try again later.",
      error: error.message,
    });
  }
});

// POST endpoint for filtered properties
router.post("/filter", async (req, res) => {
  try {
    // Extract filter parameters from request body
    const {
      search,
      status,
      category,
      sub_category,
      bedroom,
      size,
      price_range,
    } = req.body;

    // Build the base query
    let sqlQuery = `
      SELECT * 
      FROM properties 
      WHERE 1=1
    `;

    // Array to store query parameters
    const queryParams = [];

    // Add search condition (for title or location)
    if (search && search.trim() !== "") {
      sqlQuery += ` AND (title LIKE ? OR location LIKE ?)`;
      const searchTerm = `%${search.trim()}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    // Add exact match for status
    if (status && status.trim() !== "") {
      sqlQuery += ` AND status = ?`;
      queryParams.push(status.trim());
    }

    // Add exact match for category
    if (category && category.trim() !== "") {
      sqlQuery += ` AND category = ?`;
      queryParams.push(category.trim());
    }

    // Add exact match for sub_category
    if (sub_category && sub_category.trim() !== "") {
      sqlQuery += ` AND sub_category = ?`;
      queryParams.push(sub_category.trim());
    }

    // Add exact match for bedroom
    if (bedroom !== undefined && bedroom !== null && bedroom !== "") {
      const bedroomValue = parseInt(bedroom);
      if (!isNaN(bedroomValue)) {
        sqlQuery += ` AND bedroom = ?`;
        queryParams.push(bedroomValue);
      }
    }

    // Add exact match for size
    if (size !== undefined && size !== null && size !== "") {
      const sizeValue = parseFloat(size);
      if (!isNaN(sizeValue)) {
        sqlQuery += ` AND size = ?`;
        queryParams.push(sizeValue);
      }
    }

    // Add price range filter
    if (price_range) {
      let minPrice, maxPrice;

      if (typeof price_range === "string") {
        [minPrice, maxPrice] = price_range.split("-").map(Number);
      } else if (typeof price_range === "object") {
        minPrice = price_range.min ? Number(price_range.min) : NaN;
        maxPrice = price_range.max ? Number(price_range.max) : NaN;
      }

      if (!isNaN(minPrice) && !isNaN(maxPrice)) {
        sqlQuery += ` AND price >= ? AND price <= ?`;
        queryParams.push(minPrice, maxPrice);
      } else if (!isNaN(minPrice)) {
        sqlQuery += ` AND price >= ?`;
        queryParams.push(minPrice);
      } else if (!isNaN(maxPrice)) {
        sqlQuery += ` AND price <= ?`;
        queryParams.push(maxPrice);
      }
    }

    // Order by creation date (most recent first)
    sqlQuery += ` ORDER BY created_at DESC`;

    // Execute the query
    const properties = await query(sqlQuery, queryParams);

    // Get the base URL from the request for image paths
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // Process each property to format image URLs
    const formattedProperties = properties.map((property) => {
      property.images = formatImageUrls(property.images, baseUrl);
      return property;
    });

    // Send JSON response
    res.status(200).json({
      count: formattedProperties.length,
      properties: formattedProperties,
      filters_applied: {
        search: search || null,
        status: status || null,
        category: category || null,
        sub_category: sub_category || null,
        bedroom:
          bedroom !== undefined && bedroom !== null && bedroom !== ""
            ? parseInt(bedroom)
            : null,
        size:
          size !== undefined && size !== null && size !== ""
            ? parseFloat(size)
            : null,
        price_range: price_range || null,
      },
    });
  } catch (error) {
    console.error("API Error [POST /properties/filter]:", error);
    res.status(500).json({
      message: "Error filtering properties. Please try again later.",
      error: error.message,
    });
  }
});

module.exports = router;
