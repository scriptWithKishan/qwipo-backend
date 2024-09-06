const express = require("express");
const path = require("path");
const cors = require("cors");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
const dbPath = path.join(__dirname, "customer.db");
let db = null;

app.use(express.json());

const corsOptions = {
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
};

app.use(cors(corsOptions));

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(8000, () => {
      console.log("Server Running at http://localhost:8000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// Create customer
app.post("/customers", async (req, res) => {
  const { first_name, last_name, phone_number, email } = req.body;

  const createCustomerQuery = `
      INSERT INTO customer (first_name, last_name, phone_number, email)
      VALUES (?, ?, ?, ?);
    `;

  try {
    const result = await db.run(createCustomerQuery, [
      first_name,
      last_name,
      phone_number,
      email,
    ]);

    res.json({ id: result.lastID });
  } catch (error) {
    console.error("Error creating customer:", error.message);
    res.status(500).send("Error creating customer.");
  }
});

// Create address
app.post("/addresses", async (req, res) => {
  const { customer_id, address, city, state } = req.body;

  if (!address) {
    return res.status(400).send("Address is required.");
  }

  const createAddressQuery = `
    INSERT INTO address (customer_id, address, city, state)
    VALUES (?, ?, ?, ?);
  `;

  try {
    await db.run(createAddressQuery, [customer_id, address, city, state]);
    res.send("Address created successfully.");
  } catch (error) {
    console.error("Error creating address:", error.message);
    res.status(500).send("Error creating address.");
  }
});

// Read customers with pagination and filtering
app.get("/customers", async (req, res) => {
  const {
    _page = 1,
    _limit = 10,
    search = "",
    filterName = "",
    filterCity = "",
  } = req.query;

  let query = `
    SELECT customer.id, customer.first_name, customer.last_name, customer.email, address.city
    FROM customer
    LEFT JOIN address ON customer.id = address.customer_id
    WHERE 1=1`;

  if (search) {
    query += ` AND (customer.first_name LIKE '%${search}%' OR customer.last_name LIKE '%${search}%')`;
  }

  if (filterName) {
    query += ` AND (customer.first_name LIKE '%${filterName}%' OR customer.last_name LIKE '%${filterName}%')`;
  }

  if (filterCity) {
    query += ` AND address.city LIKE '%${filterCity}%'`;
  }

  query += ` GROUP BY customer.id
    LIMIT ${_limit} OFFSET ${(parseInt(_page) - 1) * parseInt(_limit)}`;

  try {
    const customers = await db.all(query);
    const total = await db.get(
      "SELECT COUNT(DISTINCT customer.id) AS count FROM customer"
    );
    res.json({ customers, total: total.count });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).send("Error fetching customers.");
  }
});

// Get customer by ID
app.get("/customers/:id", async (req, res) => {
  const { id } = req.params;
  const getCustomerQuery = `
    SELECT * FROM customer WHERE id = ?;
  `;

  try {
    const customer = await db.get(getCustomerQuery, [id]);
    if (customer) {
      res.json(customer);
    } else {
      res.status(404).send("Customer not found.");
    }
  } catch (error) {
    console.error("Error fetching customer:", error.message);
    res.status(500).send("Error fetching customer.");
  }
});

// Get addresses by customer ID
app.get("/addresses/:customerId", async (req, res) => {
  const { customerId } = req.params;
  const getAddressesQuery = `
    SELECT * FROM address WHERE customer_id = ?;
  `;

  try {
    const addresses = await db.all(getAddressesQuery, [customerId]);
    res.json(addresses);
  } catch (error) {
    console.error("Error fetching addresses:", error.message);
    res.status(500).send("Error fetching addresses.");
  }
});

// Update customer
app.put("/customers/:id", async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, phone_number, email } = req.body;

  const updateCustomerQuery = `
    UPDATE customer
    SET first_name = ?, last_name = ?, phone_number = ?, email = ?
    WHERE id = ?;
  `;

  try {
    await db.run(updateCustomerQuery, [
      first_name,
      last_name,
      phone_number,
      email,
      id,
    ]);
    res.send("Customer updated successfully.");
  } catch (error) {
    console.error("Error updating customer:", error.message);
    res.status(500).send("Error updating customer.");
  }
});

// Delete customer
app.delete("/customers/:id", async (req, res) => {
  const { id } = req.params;
  const deleteCustomerQuery = `
    DELETE FROM customer WHERE id = ?;
  `;

  try {
    await db.run(deleteCustomerQuery, [id]);

    const deleteAddressesQuery = `
      DELETE FROM address WHERE customer_id = ?;
    `;
    await db.run(deleteAddressesQuery, [id]);

    res.send("Customer deleted successfully.");
  } catch (error) {
    console.error("Error deleting customer:", error.message);
    res.status(500).send("Error deleting customer.");
  }
});

// Update address
app.put("/addresses/:id", async (req, res) => {
  const { id } = req.params;
  const { address } = req.body;

  const updateAddressQuery = `
    UPDATE address
    SET address = ?
    WHERE id = ?;
  `;

  try {
    await db.run(updateAddressQuery, [address, id]);
    res.send("Address updated successfully.");
  } catch (error) {
    console.error("Error updating address:", error.message);
    res.status(500).send("Error updating address.");
  }
});

// Delete address
app.delete("/addresses/:id", async (req, res) => {
  const { id } = req.params;

  const deleteAddressQuery = `
    DELETE FROM address WHERE id = ?;
  `;

  try {
    await db.run(deleteAddressQuery, [id]);
    res.send("Address deleted successfully.");
  } catch (error) {
    console.error("Error deleting address:", error.message);
    res.status(500).send("Error deleting address.");
  }
});
