"use strict";

(() => {
  const API_BASE = String(window.ANSAR_CONFIG?.API_BASE_URL || "").replace(/\/+$/, "");
  const $ = (id) => document.getElementById(id);

  const els = {
    loginPanel: $("loginPanel"),
    loginForm: $("loginForm"),
    username: $("username"),
    password: $("password"),
    loginMessage: $("loginMessage"),
    dashboard: $("dashboard"),
    adminIdentity: $("adminIdentity"),
    logoutBtn: $("logoutBtn"),
    refreshBtn: $("refreshBtn"),
    totalCount: $("totalCount"),
    pendingCount: $("pendingCount"),
    confirmedCount: $("confirmedCount"),
    rejectedCount: $("rejectedCount"),
    filters: $("filters"),
    searchForm: $("searchForm"),
    searchInput: $("searchInput"),
    clearSearch: $("clearSearch"),
    dashboardMessage: $("dashboardMessage"),
    bookingList: $("bookingList"),
    prevBtn: $("prevBtn"),
    pageLabel: $("pageLabel"),
    nextBtn: $("nextBtn"),
    bookingDialog: $("bookingDialog"),
    dialogBookingId: $("dialogBookingId"),
    closeDialog: $("closeDialog"),
    bookingDetails: $("bookingDetails"),
    adminNote: $("adminNote"),
    confirmBtn: $("confirmBtn"),
    rejectBtn: $("rejectBtn"),
    customerWhatsApp: $("customerWhatsApp"),
    bookingHistory: $("bookingHistory"),
    dialogMessage: $("dialogMessage")
  };

  const PAGE_SIZE = 50;
  let token = sessionStorage.getItem("ansar_admin_token") || "";
  let currentStatus = "Pending";
  let currentSearch = "";
  let currentOffset = 0;
  let currentBooking = null;
  let totalBookings = 0;

  function message(element, text, error = false) {
    if (!element) return;
    element.textContent = text || "";
    element.style.color = error ? "#b42318" : "";
  }

  function setLoggedIn(loggedIn) {
    els.loginPanel.hidden = loggedIn;
    els.dashboard.hidden = !loggedIn;
    els.logoutBtn.hidden = !loggedIn;
    els.adminIdentity.textContent = loggedIn ? "Administrator" : "";
  }

  async function api(path, options = {}) {
    if (!API_BASE) {
      throw new Error("API URL configured nahi hai. Backend deploy hone ke baad config.js update karo.");
    }

    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");

    if (token) headers.set("Authorization", `Bearer ${token}`);

    if (options.body) headers.set("Content-Type", "application/json");

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      logout();
      throw new Error("Session expire ho gaya. Dobara login karo.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = data.detail;
      throw new Error(typeof detail === "string" ? detail : `Request failed (${response.status})`);
    }

    return data;
  }

  function logout() {
    token = "";
    sessionStorage.removeItem("ansar_admin_token");
    currentBooking = null;
    setLoggedIn(false);
    message(els.loginMessage, "Please login.");
  }

  async function login(event) {
    event.preventDefault();
    message(els.loginMessage, "Logging in...");

    const button = els.loginForm.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
      const data = await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          username: els.username.value.trim(),
          password: els.password.value
        })
      });

      if (!data.access_token) throw new Error("Server ne access token return nahi kiya.");

      token = data.access_token;
      sessionStorage.setItem("ansar_admin_token", token);
      els.password.value = "";
      setLoggedIn(true);
      currentOffset = 0;
      await loadBookings();
    } catch (error) {
      message(els.loginMessage, error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  function makeElement(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN");
  }

  function formatTime(value) {
    if (!value) return "—";
    const [hour, minute] = value.split(":");
    const date = new Date();
    date.setHours(Number(hour), Number(minute), 0, 0);
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }

  function addDetail(container, label, value) {
    const item = makeElement("div", "detail-item");
    item.append(
      makeElement("span", "detail-label", label),
      makeElement("strong", "detail-value", value ?? "—")
    );
    container.append(item);
  }

  function renderBookings(bookings) {
    els.bookingList.replaceChildren();

    if (!bookings.length) {
      els.bookingList.append(makeElement("p", "empty-state", "No bookings found."));
      return;
    }

    bookings.forEach((booking) => {
      const card = makeElement("article", "booking-card");
      const heading = makeElement("div", "booking-card-header");
      const title = makeElement("strong", "", booking.booking_id);
      const status = makeElement("span", `status-badge status-${booking.status.toLowerCase()}`, booking.status);
      heading.append(title, status);

      const info = makeElement("div", "booking-card-info");
      info.append(
        makeElement("p", "", `${booking.customer_name} · ${booking.customer_phone}`),
        makeElement("p", "", `${booking.pickup} → ${booking.destination}`),
        makeElement("p", "", `${formatDate(booking.travel_date)} · ${formatTime(booking.travel_time)}`)
      );

      const openButton = makeElement("button", "secondary-btn", "View details");
      openButton.type = "button";
      openButton.addEventListener("click", () => openBooking(booking.booking_id));

      card.append(heading, info, openButton);
      els.bookingList.append(card);
    });
  }

  async function loadBookings() {
    message(els.dashboardMessage, "Loading bookings...");
    els.refreshBtn.disabled = true;

    try {
      const params = new URLSearchParams({
        status: currentStatus,
        limit: String(PAGE_SIZE),
        offset: String(currentOffset)
      });

      if (currentSearch) params.set("search", currentSearch);

      const data = await api(`/api/admin/bookings?${params.toString()}`);
      const bookings = Array.isArray(data) ? data : (data.items || data.bookings || []);

      totalBookings = Array.isArray(data)
        ? bookings.length
        : Number(data.total ?? data.total_count ?? bookings.length);

      renderBookings(bookings);

      try {
        const stats = await api("/api/admin/stats");
        els.totalCount.textContent = String(stats.total);
        els.pendingCount.textContent = String(stats.pending);
        els.confirmedCount.textContent = String(stats.confirmed);
        els.rejectedCount.textContent = String(stats.rejected);
      } catch (statsError) {
        els.totalCount.textContent = "—";
        els.pendingCount.textContent = "—";
        els.confirmedCount.textContent = "—";
        els.rejectedCount.textContent = "—";
        console.error("Could not load booking statistics:", statsError);
      }

      const page = Math.floor(currentOffset / PAGE_SIZE) + 1;
      els.pageLabel.textContent = `Page ${page}`;
      els.prevBtn.disabled = currentOffset === 0;
      els.nextBtn.disabled = bookings.length < PAGE_SIZE;

      message(els.dashboardMessage, `${bookings.length} bookings loaded.`);
    } catch (error) {
      message(els.dashboardMessage, error.message, true);
      if (!token) setLoggedIn(false);
    } finally {
      els.refreshBtn.disabled = false;
    }
  }

  async function openBooking(bookingId) {
    message(els.dialogMessage, "Loading booking...");
    els.bookingDetails.replaceChildren();
    els.bookingHistory.replaceChildren();
    els.bookingDialog.showModal();

    try {
      const booking = await api(`/api/admin/bookings/${encodeURIComponent(bookingId)}`);
      currentBooking = booking;

      els.dialogBookingId.textContent = booking.booking_id;
      els.adminNote.value = booking.admin_note || "";

      addDetail(els.bookingDetails, "Customer", booking.customer_name);
      addDetail(els.bookingDetails, "Phone", booking.customer_phone);
      addDetail(els.bookingDetails, "Service", booking.service);
      addDetail(els.bookingDetails, "Pickup", booking.pickup);
      addDetail(els.bookingDetails, "Destination", booking.destination);
      addDetail(els.bookingDetails, "Travel date", formatDate(booking.travel_date));
      addDetail(els.bookingDetails, "Travel time", formatTime(booking.travel_time));
      addDetail(els.bookingDetails, "Trip type", booking.trip_type);
      addDetail(els.bookingDetails, "Vehicle", booking.vehicle);
      addDetail(els.bookingDetails, "Passengers", String(booking.passengers));
      addDetail(els.bookingDetails, "Distance", booking.distance_km == null ? "Not available" : `${booking.distance_km} km`);
      addDetail(els.bookingDetails, "Estimated fare", booking.estimated_fare == null ? "To be confirmed" : `₹${booking.estimated_fare}`);
      addDetail(els.bookingDetails, "Status", booking.status);

      const phone = String(booking.customer_phone || "").replace(/\D/g, "");
      els.customerWhatsApp.href = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hello ${booking.customer_name}, regarding your ANSAR TAXI booking ${booking.booking_id}.`)}`
        : "#";
      els.customerWhatsApp.hidden = !phone;

      const canUpdate = booking.status === "Pending";
      els.confirmBtn.hidden = !canUpdate;
      els.rejectBtn.hidden = !canUpdate;

      await loadHistory(booking.booking_id);
      message(els.dialogMessage, "");
    } catch (error) {
      message(els.dialogMessage, error.message, true);
    }
  }

  async function loadHistory(bookingId) {
    const history = await api(`/api/admin/bookings/${encodeURIComponent(bookingId)}/history`);

    els.bookingHistory.replaceChildren();

    if (!Array.isArray(history) || history.length === 0) {
      els.bookingHistory.append(makeElement("p", "empty-state", "No status changes recorded."));
      return;
    }

    history.forEach((entry) => {
      const item = makeElement("div", "history-item");
      item.append(
        makeElement("strong", "", `${entry.old_status || "New"} → ${entry.new_status}`),
        makeElement("p", "", entry.admin_note || "No admin note"),
        makeElement("small", "", `${entry.changed_by || "Admin"} · ${entry.created_at || ""}`)
      );
      els.bookingHistory.append(item);
    });
  }

  async function updateStatus(status) {
    if (!currentBooking) return;

    const button = status === "Confirmed" ? els.confirmBtn : els.rejectBtn;
    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = "Saving...";
    message(els.dialogMessage, "Updating booking...");

    try {
      await api(`/api/admin/bookings/${encodeURIComponent(currentBooking.booking_id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          admin_note: els.adminNote.value.trim() || null
        })
      });

      message(els.dialogMessage, `Booking ${status.toLowerCase()} successfully.`);
      await openBooking(currentBooking.booking_id);
      await loadBookings();
    } catch (error) {
      message(els.dialogMessage, error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = previousText;
    }
  }

  els.loginForm.addEventListener("submit", login);
  els.logoutBtn.addEventListener("click", logout);
  els.refreshBtn.addEventListener("click", () => loadBookings());

  els.filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-status]");
    if (!button) return;

    currentStatus = button.dataset.status;
    currentOffset = 0;

    els.filters.querySelectorAll("[data-status]").forEach((item) => {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-pressed", item === button ? "true" : "false");
    });

    loadBookings();
  });

  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    currentSearch = els.searchInput.value.trim();
    currentOffset = 0;
    loadBookings();
  });

  els.clearSearch.addEventListener("click", () => {
    els.searchInput.value = "";
    currentSearch = "";
    currentOffset = 0;
    loadBookings();
  });

  els.prevBtn.addEventListener("click", () => {
    currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
    loadBookings();
  });

  els.nextBtn.addEventListener("click", () => {
    currentOffset += PAGE_SIZE;
    loadBookings();
  });

  els.closeDialog.addEventListener("click", () => els.bookingDialog.close());
  els.confirmBtn.addEventListener("click", () => updateStatus("Confirmed"));
  els.rejectBtn.addEventListener("click", () => updateStatus("Rejected"));

  setLoggedIn(false);

  if (token) {
    setLoggedIn(true);
    loadBookings();
  }
})();
