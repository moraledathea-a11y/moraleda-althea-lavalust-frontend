import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = "/api";

const cleanResponse = (data) => {
  if (typeof data !== "string") {
    return data;
  }

  const cleaned = data
    .replace(/^\uFEFF/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Invalid JSON response from server.");
  }
};

function App() {
  // =====================================================
  // LOGIN
  // =====================================================

  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // =====================================================
  // PRODUCTS
  // =====================================================

  const [products, setProducts] = useState([]);

  // =====================================================
  // PRODUCT FORM
  // =====================================================

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [editingId, setEditingId] = useState(null);

  // =====================================================
  // STATUS
  // =====================================================

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // =====================================================
  // INVENTORY TOTALS
  // =====================================================

  const totalUnits = products.reduce(
    (total, product) =>
      total + Number(product.quantity || 0),
    0
  );

  const stockValue = products.reduce(
    (total, product) =>
      total +
      Number(product.price || 0) *
        Number(product.quantity || 0),
    0
  );

  // =====================================================
  // TOKEN
  // =====================================================

  const getToken = () => {
    return localStorage.getItem("access_token");
  };

  const getHeaders = () => {
    const token = getToken();

    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  // =====================================================
  // LOAD PRODUCTS
  // =====================================================

  const loadProducts = async () => {
    const token = getToken();

    if (!token) {
      return;
    }

    try {
      setError("");

      const response = await axios.get(
        `${API_URL}/products`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = cleanResponse(response.data);

      console.log("PRODUCT API RESPONSE:", result);

      /*
       * LavaLust ApiProductController returns:
       *
       * {
       *   "products": [...]
       * }
       *
       * This is the important fix.
       */

      if (Array.isArray(result?.products)) {
        setProducts(result.products);
      }

      /*
       * These additional formats make the frontend
       * compatible with other possible API responses.
       */
      else if (Array.isArray(result?.data?.products)) {
        setProducts(result.data.products);
      }

      else if (Array.isArray(result?.data)) {
        setProducts(result.data);
      }

      else if (Array.isArray(result)) {
        setProducts(result);
      }

      else {
        setProducts([]);
      }

    } catch (err) {
      console.error(
        "LOAD PRODUCTS ERROR:",
        err
      );

      if (err.response?.status === 401) {
        logout();
        return;
      }

      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Failed to load products."
      );
    }
  };

  // =====================================================
  // CHECK EXISTING LOGIN
  // =====================================================

  useEffect(() => {
    const token =
      localStorage.getItem("access_token");

    if (token) {
      setLoggedIn(true);
      loadProducts();
    }
  }, []);

  // =====================================================
  // LOGIN
  // =====================================================

  const login = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/login`,
        {
          username: username.trim(),
          password: password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result =
        cleanResponse(response.data);

      console.log("LOGIN RESPONSE:", result);

      const accessToken =
        result?.access_token ||
        result?.data?.tokens?.access_token;

      if (!accessToken) {
        throw new Error(
          "Access token was not returned by the server."
        );
      }

      localStorage.setItem(
        "access_token",
        accessToken
      );

      localStorage.setItem(
        "username",
        result?.username ||
          result?.data?.username ||
          username.trim()
      );

      setLoggedIn(true);
      setPassword("");
      setError("");

      await loadProducts();

    } catch (err) {
      console.error(
        "LOGIN ERROR:",
        err
      );

      let message =
        "Login failed. Please check your username and password.";

      if (err.response) {
        try {
          const serverData =
            cleanResponse(
              err.response.data
            );

          message =
            serverData?.error ||
            serverData?.message ||
            message;

        } catch {
          message =
            err.message || message;
        }

      } else {
        message =
          err.message || message;
      }

      setError(message);

    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = () => {
    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem(
      "username"
    );

    setLoggedIn(false);
    setUsername("");
    setPassword("");
    setProducts([]);

    resetForm();
    setError("");
  };

  // =====================================================
  // RESET FORM
  // =====================================================

  const resetForm = () => {
    setProductName("");
    setDescription("");
    setPrice("");
    setQuantity("");
    setEditingId(null);
  };

  // =====================================================
  // SAVE PRODUCT
  // =====================================================

  const saveProduct = async (e) => {
    e.preventDefault();

    setError("");

    if (!productName.trim()) {
      setError(
        "Product name is required."
      );
      return;
    }

    if (
      price === "" ||
      Number(price) < 0
    ) {
      setError(
        "Please enter a valid price."
      );
      return;
    }

    if (
      quantity === "" ||
      Number(quantity) < 0
    ) {
      setError(
        "Please enter a valid quantity."
      );
      return;
    }

    try {
      setLoading(true);

      const productData = {
        product_name:
          productName.trim(),

        description:
          description.trim(),

        price: Number(price),

        quantity: Number(quantity),
      };

      console.log(
        "SENDING PRODUCT:",
        productData
      );

      if (editingId !== null) {

        // ==========================================
        // UPDATE PRODUCT
        // ==========================================

        const response =
          await axios.put(
            `${API_URL}/products/${editingId}`,
            productData,
            {
              headers: getHeaders(),
            }
          );

        console.log(
          "UPDATE RESPONSE:",
          response.data
        );

      } else {

        // ==========================================
        // ADD PRODUCT
        // ==========================================

        const response =
          await axios.post(
            `${API_URL}/products`,
            productData,
            {
              headers: getHeaders(),
            }
          );

        console.log(
          "ADD RESPONSE:",
          response.data
        );
      }

      // Clear the form
      resetForm();

      // Reload products from database
      await loadProducts();

    } catch (err) {
      console.error(
        "SAVE PRODUCT ERROR:",
        err
      );

      if (
        err.response?.status === 401
      ) {
        logout();
        return;
      }

      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Failed to save product."
      );

    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // EDIT PRODUCT
  // =====================================================

  const editProduct = (product) => {
    setEditingId(product.id);

    setProductName(
      product.product_name || ""
    );

    setDescription(
      product.description || ""
    );

    setPrice(
      product.price ?? ""
    );

    setQuantity(
      product.quantity ?? ""
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =====================================================
  // DELETE PRODUCT
  // =====================================================

  const deleteProduct = async (id) => {
    const confirmed =
      window.confirm(
        "Delete this product from inventory?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setLoading(true);

      const response =
        await axios.delete(
          `${API_URL}/products/${id}`,
          {
            headers: getHeaders(),
          }
        );

      console.log(
        "DELETE RESPONSE:",
        response.data
      );

      await loadProducts();

    } catch (err) {
      console.error(
        "DELETE PRODUCT ERROR:",
        err
      );

      if (
        err.response?.status === 401
      ) {
        logout();
        return;
      }

      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Failed to delete product."
      );

    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // FORMAT MONEY
  // =====================================================

  const formatMoney = (value) => {
    return Number(
      value || 0
    ).toLocaleString(
      "en-PH",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  };

  // =====================================================
  // LOGIN SCREEN
  // =====================================================

  if (!loggedIn) {
    return (
      <div className="login-page">

        <div className="topographic topographic-login" />

        <div className="login-layout">

          <div className="login-brand">

            <div className="brand-name">
              Product Management System
            </div>

          </div>

          <div className="login-card">

            <div className="login-card-top">
              <span>
                ADMIN PORTAL
              </span>

              <span>
                01
              </span>
            </div>

            <h1>
              Sign in
            </h1>

            <p className="login-description">
              Enter your account details to
              access the inventory.
            </p>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <form onSubmit={login}>

              <div className="input-group">

                <label>
                  Username
                </label>

                <input
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                    )
                  }
                  placeholder="Enter username"
                  autoComplete="username"
                  required
                />

              </div>

              <div className="input-group">

                <label>
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />

              </div>

              <button
                className="login-button"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Signing in..."
                  : "Sign in"}

                <span>
                  →
                </span>
              </button>

            </form>

            <div className="login-footer">
              LavaLust · Stockroom
            </div>

          </div>

        </div>
      </div>
    );
  }

  // =====================================================
  // MAIN APPLICATION
  // =====================================================

  return (
    <div className="app">

      <div className="topographic topographic-app" />

      {/* HEADER */}

      <header className="app-header">

        <div className="header-brand">
        </div>

        <div className="header-account">

          <div className="account-info">

            <span className="account-label">
              SIGNED IN AS
            </span>

            <strong>
              {localStorage.getItem(
                "username"
              ) || "admin"}
            </strong>

          </div>

          <button
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>

        </div>

      </header>

      {/* MAIN CONTENT */}

      <main className="main-container">

        {/* PAGE HEADER */}

        <section className="dashboard-heading">

          <div>

            <h2>
              Product Inventory
            </h2>

            <p>
              Manage products, pricing, and
              stock quantities.
            </p>

          </div>

        </section>

        {/* ERROR */}

        {error && (
          <div className="error-message app-error">
            {error}
          </div>
        )}

        {/* STATISTICS */}

        <section className="stats-grid">

          <article className="stat-card stat-main">

            <span className="stat-label">
              PRODUCTS
            </span>

            <strong>
              {products.length
                .toString()
                .padStart(2, "0")}
            </strong>

            <small>
              unique products
            </small>

          </article>

          <article className="stat-card">

            <span className="stat-label">
              TOTAL UNITS
            </span>

            <strong>
              {totalUnits.toLocaleString(
                "en-PH"
              )}
            </strong>

            <small>
              units in stock
            </small>

          </article>

          <article className="stat-card">

            <span className="stat-label">
              INVENTORY VALUE
            </span>

            <strong className="money">
              ₱
              {stockValue.toLocaleString(
                "en-PH",
                {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }
              )}
            </strong>

            <small>
              current stock value
            </small>

          </article>

        </section>

        {/* WORKSPACE */}

        <section className="workspace">

          {/* ADD / EDIT PRODUCT */}

          <div className="form-panel">

            <div className="panel-header">

              <div>

                <span className="panel-number">
                  02
                </span>

                <h3>
                  {editingId !== null
                    ? "Edit Product"
                    : "Add Product"}
                </h3>

              </div>

              {editingId !== null && (
                <span className="editing-badge">
                  EDITING
                </span>
              )}

            </div>

            <p className="panel-description">

              {editingId !== null
                ? "Update the product information below."
                : "Add a new product to your inventory."}

            </p>

            <form
              className="product-form"
              onSubmit={saveProduct}
            >

              <div className="input-group">

                <label>
                  Product Name
                </label>

                <input
                  type="text"
                  value={productName}
                  onChange={(e) =>
                    setProductName(
                      e.target.value
                    )
                  }
                  placeholder="e.g. iPhone 18"
                  required
                />

              </div>

              <div className="input-group">

                <label>

                  Description

                  <span>
                    Optional
                  </span>

                </label>

                <input
                  type="text"
                  value={description}
                  onChange={(e) =>
                    setDescription(
                      e.target.value
                    )
                  }
                  placeholder="e.g. 256GB"
                />

              </div>

              <div className="form-row">

                <div className="input-group">

                  <label>

                    Price

                    <span>
                      PHP ₱
                    </span>

                  </label>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) =>
                      setPrice(
                        e.target.value
                      )
                    }
                    placeholder="0.00"
                    required
                  />

                </div>

                <div className="input-group">

                  <label>
                    Quantity
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        e.target.value
                      )
                    }
                    placeholder="0"
                    required
                  />

                </div>

              </div>

              <div className="form-actions">

                <button
                  className="primary-button"
                  type="submit"
                  disabled={loading}
                >

                  {loading
                    ? "Saving..."
                    : editingId !== null
                    ? "Save Changes"
                    : "Add Product"}

                  <span>
                    →
                  </span>

                </button>

                {editingId !== null && (

                  <button
                    className="cancel-button"
                    type="button"
                    onClick={resetForm}
                  >
                    Cancel
                  </button>

                )}

              </div>

            </form>

          </div>

          {/* PRODUCTS */}

          <div className="products-panel">

            <div className="panel-header products-header">

              <div>

                <span className="panel-number">
                  03
                </span>

                <h3>
                  Product List
                </h3>

                <p className="product-count">

                  {products.length}{" "}

                  {products.length === 1
                    ? "product"
                    : "products"}

                </p>

              </div>

              <button
                className="refresh-button"
                onClick={loadProducts}
                title="Refresh products"
              >
                ↻
              </button>

            </div>

            {products.length === 0 ? (

              <div className="empty-state">

                <div className="empty-icon">
                  +
                </div>

                <h4>
                  No products yet
                </h4>

                <p>
                  Add your first product to
                  start managing inventory.
                </p>

              </div>

            ) : (

              <div className="table-container">

                <table>

                  <thead>

                    <tr>

                      <th>
                        ID
                      </th>

                      <th>
                        Product
                      </th>

                      <th>
                        Description
                      </th>

                      <th>
                        Price
                      </th>

                      <th>
                        Quantity
                      </th>

                      <th>
                        Date Added
                      </th>

                      <th>
                        Actions
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {products.map(
                      (product) => (

                        <tr
                          key={product.id}
                        >

                          <td>

                            <span className="product-id">

                              LL-

                              {String(
                                product.id
                              ).padStart(
                                3,
                                "0"
                              )}

                            </span>

                          </td>

                          <td>

                            <strong className="table-product-name">

                              {
                                product.product_name
                              }

                            </strong>

                          </td>

                          <td>

                            <span className="table-description">

                              {
                                product.description ||
                                "—"
                              }

                            </span>

                          </td>

                          <td>

                            <strong>

                              ₱
                              {formatMoney(
                                product.price
                              )}

                            </strong>

                          </td>

                          <td>

                            <span
                              className={
                                Number(
                                  product.quantity
                                ) <= 5
                                  ? "quantity low"
                                  : "quantity"
                              }
                            >

                              {
                                product.quantity
                              }

                            </span>

                          </td>

                          <td>

                            <span className="date-cell">

                              {
                                product.created_at
                              }

                            </span>

                          </td>

                          <td>

                            <div className="table-actions">

                              <button
                                className="edit-button"
                                onClick={() =>
                                  editProduct(
                                    product
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                className="delete-button"
                                onClick={() =>
                                  deleteProduct(
                                    product.id
                                  )
                                }
                              >
                                Delete
                              </button>

                            </div>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </section>

        {/* FOOTER */}

        <footer className="app-footer">
        </footer>

      </main>

    </div>
  );
}

export default App;