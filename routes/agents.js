// routes/agents.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { pool } = require("../config/db");

// Get the upload path from properties
const { UPLOADS_PATH, UPLOADS_URL_PATH } = require("../config/properties");

// Configure multer for file uploads to cPanel
// Ensure the upload directory exists
if (!fs.existsSync(UPLOADS_PATH)) {
  try {
    fs.mkdirSync(UPLOADS_PATH, { recursive: true });
  } catch (error) {
    console.error("Error creating uploads directory:", error);
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_PATH);
  },
  filename: function (req, file, cb) {
    // Create a unique filename to avoid overwriting
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, "agent-" + uniqueSuffix + extension);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Error: Images only!"));
    }
  },
});

// API 1: Add a new agent
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name, mobile_number } = req.body;

    // Validate inputs
    if (!name || !mobile_number) {
      return res
        .status(400)
        .json({ error: "Name and mobile number are required" });
    }

    // For cPanel we'll store only the relative URL path in database
    let imageUrlPath = null;
    if (req.file) {
      const fileName = path.basename(req.file.path);
      imageUrlPath = UPLOADS_URL_PATH + fileName;
    }

    // Get connection from pool
    const connection = await pool.getConnection();

    try {
      // Insert data into the agents table
      const [result] = await connection.execute(
        "INSERT INTO agents (name, image, mobile_number) VALUES (?, ?, ?)",
        [name, imageUrlPath, mobile_number]
      );

      connection.release();

      res.status(201).json({
        message: "Agent added successfully",
        agent_id: result.insertId,
      });
    } catch (dbError) {
      connection.release();
      throw dbError;
    }
  } catch (error) {
    console.error("Error adding agent:", error);
    res.status(500).json({ error: "Failed to add agent" });
  }
});

// API 2: Get all agents or a specific agent by ID
router.get("/:id?", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const { id } = req.params;

    try {
      let query,
        params = [];

      if (id) {
        query = "SELECT * FROM agents WHERE id = ?";
        params = [id];
      } else {
        query = "SELECT * FROM agents";
      }

      const [rows] = await connection.execute(query, params);
      connection.release();

      if (id && rows.length === 0) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Format the response - images are already stored as URL paths
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const agents = rows.map((agent) => ({
        ...agent,
        // Use the full URL for image paths
        image: agent.image ? `${baseUrl}${agent.image}` : null,
      }));

      res.json(id ? agents[0] : agents);
    } catch (dbError) {
      connection.release();
      throw dbError;
    }
  } catch (error) {
    console.error("Error retrieving agents:", error);
    res.status(500).json({ error: "Failed to retrieve agents" });
  }
});

// API 3: Edit an agent
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mobile_number } = req.body;

    // Get connection from pool
    const connection = await pool.getConnection();

    try {
      // Check if agent exists
      const [existing] = await connection.execute(
        "SELECT * FROM agents WHERE id = ?",
        [id]
      );

      if (existing.length === 0) {
        connection.release();
        return res.status(404).json({ message: "Agent not found" });
      }

      const existingAgent = existing[0];

      // Handle image update
      let imageUrlPath = existingAgent.image;

      if (req.file) {
        // Delete old image if it exists (get physical path from URL path)
        if (existingAgent.image) {
          const oldFileName = path.basename(existingAgent.image);
          const oldFilePath = path.join(UPLOADS_PATH, oldFileName);

          if (fs.existsSync(oldFilePath)) {
            try {
              fs.unlinkSync(oldFilePath);
            } catch (err) {
              console.error("Error deleting old image:", err);
            }
          }
        }

        // Add new image URL path
        const fileName = path.basename(req.file.path);
        imageUrlPath = UPLOADS_URL_PATH + fileName;
      }

      // Update agent data
      await connection.execute(
        "UPDATE agents SET name = ?, image = ?, mobile_number = ? WHERE id = ?",
        [
          name || existingAgent.name,
          imageUrlPath,
          mobile_number || existingAgent.mobile_number,
          id,
        ]
      );

      connection.release();

      res.json({
        message: "Agent updated successfully",
        agent_id: id,
      });
    } catch (dbError) {
      connection.release();
      throw dbError;
    }
  } catch (error) {
    console.error("Error updating agent:", error);
    res.status(500).json({ error: "Failed to update agent" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get connection from pool
    const connection = await pool.getConnection();

    try {
      // First, get the agent to find the image path
      const [existing] = await connection.execute(
        "SELECT * FROM agents WHERE id = ?",
        [id]
      );

      if (existing.length === 0) {
        connection.release();
        return res.status(404).json({ message: "Agent not found" });
      }

      const existingAgent = existing[0];

      // Delete the image file if it exists
      if (existingAgent.image) {
        const fileName = path.basename(existingAgent.image);
        const filePath = path.join(UPLOADS_PATH, fileName);

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`Deleted image file: ${filePath}`);
          } catch (err) {
            console.error("Error deleting image file:", err);
          }
        }
      }

      // Delete the agent from the database
      const [result] = await connection.execute(
        "DELETE FROM agents WHERE id = ?",
        [id]
      );

      connection.release();

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "Agent not found or already deleted" });
      }

      res.json({
        message: "Agent deleted successfully",
        agent_id: id,
      });
    } catch (dbError) {
      connection.release();
      throw dbError;
    }
  } catch (error) {
    console.error("Error deleting agent:", error);
    res.status(500).json({ error: "Failed to delete agent" });
  }
});

module.exports = router;
