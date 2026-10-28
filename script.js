"use strict";

const BUSINESS_WHATSAPP = "918660629533";

const bookingForm = document.getElementById("bookingForm");
const formStatus = document.getElementById("formStatus");
const travelDate = document.getElementById("travelDate");
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

// Prevent selecting a date in the past.
function setMinimumTravelDate() {
  if (!travelDate) return;

  const now = new Date();
  const localDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");

  travelDate.min = localDate;
}

setMinimumTravelDate();

// Mobile navigation.
if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation menu" : "Open navigation menu"
    );
    menuToggle.textContent = isOpen ? "✕" : "☰";
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation menu");
      menuToggle.textContent = "☰";
    });
  });
}

// Service and vehicle shortcuts.
document.querySelectorAll("[data-service]").forEach((link) => {
  link.addEventListener("click", () => {
    const serviceSelect = document.getElementById("service");
    if (serviceSelect) {
      serviceSelect.value = link.dataset.service;
    }
  });
});

document.querySelectorAll("[data-vehicle]").forEach((link) => {
  link.addEventListener("click", () => {
    const vehicleSelect = document.getElementById("vehicle");
    if (vehicleSelect) {
      vehicleSelect.value = link.dataset.vehicle;
    }
  });
});

// Build a booking enquiry and open WhatsApp.
if (bookingForm) {
  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!bookingForm.reportValidity()) return;

    const data = new FormData(bookingForm);

    const customerName = String(data.get("customerName") || "").trim();
    const customerPhone = String(data.get("customerPhone") || "").trim();
    const pickup = String(data.get("pickup") || "").trim();
    const destination = String(data.get("destination") || "").trim();

    if (!customerName || !customerPhone || !pickup || !destination) {
      formStatus.textContent = "Please complete all required fields.";
      return;
    }

    const selectedDate = String(data.get("travelDate") || "");
    const selectedTime = String(data.get("travelTime") || "");

    if (!selectedDate || !selectedTime) {
      formStatus.textContent = "Please select your travel date and time.";
      return;
    }

    const requestedDateTime = new Date(
      `${selectedDate}T${selectedTime}`
    );

    if (Number.isNaN(requestedDateTime.getTime()) ||
        requestedDateTime.getTime() < Date.now()) {
      formStatus.textContent =
        "Please select a future date and time for your journey.";
      return;
    }

    const message = [
      "Hello ANSARTAXISERVICE!",
      "",
      "I would like to enquire about a taxi booking.",
      "",
      `Name: ${customerName}`,
      `Customer mobile: ${customerPhone}`,
      `Service: ${data.get("service")}`,
      `Pickup: ${pickup}`,
      `Destination: ${destination}`,
      `Travel date: ${selectedDate}`,
      `Pickup time: ${selectedTime}`,
      `Trip type: ${data.get("tripType")}`,
      `Vehicle preference: ${data.get("vehicle")}`,
      `Passengers: ${data.get("passengers")}`,
      "",
      "Please confirm vehicle availability and the total fare.",
      "I understand this is a booking enquiry, not a confirmed reservation."
    ].join("\n");

    const whatsappURL =
      `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(message)}`;

    const whatsappWindow = window.open(
      whatsappURL,
      "_blank",
      "noopener,noreferrer"
    );

    // Fallback for browsers that block a new tab.
    if (!whatsappWindow) {
      window.location.href = whatsappURL;
    }

    formStatus.textContent =
      "Opening WhatsApp with your booking enquiry. Please send the message to contact us.";
  });
}

// Footer year.
const currentYear = document.getElementById("currentYear");
if (currentYear) {
  currentYear.textContent = String(new Date().getFullYear());
}
